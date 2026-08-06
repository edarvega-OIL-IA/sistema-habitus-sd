// Ruta destino: C:\Users\Usuario\Documents\sistema-habitus-sd\src\app\tienda\page.tsx
//
// Catálogo público de la Vitrina web. Sin login (ver excepción en src/proxy.ts).
// Lee de la vista articulos_catalogo_web — NUNCA de la tabla articulos directo,
// para no correr riesgo de exponer costo_sin_iva ni otras columnas internas.
//
// Agrupa por nombre_base + marca cuando el artículo ya está migrado al sistema
// de Sabores (5 rubros por ahora: Proteínas, Creatinas, Barras, Geles, Bebidas
// Isotónicas) — ProductoCard muestra un selector de sabor. El resto del
// catálogo (nombre_base = null) se sigue mostrando suelto, sin agrupar.

import { createClient } from '@/lib/supabase/server'
import ProductoCard from '@/components/tienda/ProductoCard'
import FiltrosTienda from '@/components/tienda/FiltrosTienda'

interface ArticuloCatalogo {
  id: number
  nombre: string
  nombre_base: string | null
  descripcion: string | null
  precio: number
  en_oferta: boolean
  rubro_id: number | null
  rubro: string | null
  marca_id: number | null
  marca: string | null
  peso_kg: number | null
  atributo_valor: string | null
  sabor: string | null
  stock: number
  imagen_url: string | null
}

interface GrupoProducto {
  key: string
  titulo: string
  marca: string | null
  rubro: string | null
  variantes: ArticuloCatalogo[]
}

function agrupar(articulos: ArticuloCatalogo[]): GrupoProducto[] {
  const mapa = new Map<string, GrupoProducto>()
  for (const a of articulos) {
    const key = a.nombre_base ? `${a.nombre_base}||${a.marca_id ?? ''}` : `single-${a.id}`
    const existente = mapa.get(key)
    if (existente) {
      existente.variantes.push(a)
    } else {
      mapa.set(key, {
        key,
        titulo: a.nombre_base || a.nombre,
        marca: a.marca,
        rubro: a.rubro,
        variantes: [a],
      })
    }
  }
  // Sabor alfabético dentro de cada grupo (los sin sabor van al final)
  for (const g of mapa.values()) {
    g.variantes.sort((a, b) => (a.sabor || 'zzz').localeCompare(b.sabor || 'zzz'))
  }
  return [...mapa.values()]
}

export default async function TiendaPage({
  searchParams,
}: {
  searchParams: Promise<{ rubro?: string; marca?: string; stock?: string }>
}) {
  const { rubro: rubroSeleccionado, marca: marcaParam, stock: stockParam } = await searchParams
  const marcasSeleccionadas = (marcaParam || '').split(',').filter(Boolean)
  const soloConStock = stockParam === 'con'
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('articulos_catalogo_web')
    .select('*')
    .order('nombre')

  const articulos: ArticuloCatalogo[] = data || []
  const grupos = agrupar(articulos)

  const rubros = [...new Set(articulos.map(a => a.rubro).filter((r): r is string => !!r))].sort()
  // Marca es un filtro que cruza todos los rubros (igual que en Empretienda:
  // /productos?marca=X mezcla categorías) — por eso la lista sale de TODO el
  // catálogo, no solo del rubro elegido, para poder combinar ambos filtros.
  const marcas = [...new Set(articulos.map(a => a.marca).filter((m): m is string => !!m))].sort()

  const gruposFiltrados = grupos.filter(g => {
    if (rubroSeleccionado && g.rubro !== rubroSeleccionado) return false
    if (marcasSeleccionadas.length > 0 && (!g.marca || !marcasSeleccionadas.includes(g.marca))) return false
    if (soloConStock && !g.variantes.some(v => v.stock > 0)) return false
    return true
  })

  return (
    <div className="min-h-screen bg-[#ededed]">
      {/* Header */}
      <header className="bg-[#3c3c3b] text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
          <h1 className="text-2xl font-bold tracking-tight">
            HÁBITUS <span className="text-[#00a19a]">SD</span>
          </h1>
          <p className="text-sm text-white/60 mt-1">Suplementos deportivos en Cinco Saltos</p>
        </div>
      </header>

      {/* Filtro de rubros + Filtros (marca/stock) */}
      {(rubros.length > 0 || marcas.length > 0) && (
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center gap-2">
            <a
              href={`/tienda?${new URLSearchParams({ ...(marcasSeleccionadas.length > 0 && { marca: marcasSeleccionadas.join(',') }), ...(soloConStock && { stock: 'con' }) }).toString()}`}
              className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                !rubroSeleccionado
                  ? 'bg-[#00a19a] text-white border-[#00a19a]'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-[#00a19a]'
              }`}
            >
              Todos
            </a>
            {rubros.map(r => (
              <a
                key={r}
                href={`/tienda?${new URLSearchParams({ rubro: r, ...(marcasSeleccionadas.length > 0 && { marca: marcasSeleccionadas.join(',') }), ...(soloConStock && { stock: 'con' }) }).toString()}`}
                className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  rubroSeleccionado === r
                    ? 'bg-[#00a19a] text-white border-[#00a19a]'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-[#00a19a]'
                }`}
              >
                {r}
              </a>
            ))}
            {marcas.length > 0 && <FiltrosTienda marcas={marcas} />}
          </div>
        </div>
      )}

      {/* Grid de productos */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center text-sm text-red-700">
            No se pudo cargar el catálogo. Probá de nuevo en un momento.
          </div>
        ) : gruposFiltrados.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-12 text-center text-sm text-gray-400">
            Todavía no hay productos cargados para la tienda online.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {gruposFiltrados.map(g => (
              <ProductoCard
                key={g.key}
                titulo={g.titulo}
                marca={g.marca}
                variantes={g.variantes.map(v => ({
                  id: v.id,
                  sabor: v.sabor,
                  atributo_valor: v.atributo_valor,
                  precio: v.precio,
                  en_oferta: v.en_oferta,
                  stock: v.stock,
                  imagen_url: v.imagen_url,
                }))}
              />
            ))}
          </div>
        )}
      </main>

      <footer className="border-t border-gray-200 py-6 text-center text-xs text-gray-400">
        Av. Roca 54, Cinco Saltos, Río Negro — Hábitus SD
      </footer>
    </div>
  )
}
