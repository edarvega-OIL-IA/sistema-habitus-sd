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
import CarritoBoton from '@/components/tienda/CarritoBoton'
import FiltrosTienda from '@/components/tienda/FiltrosTienda'
import OrdenTienda from '@/components/tienda/OrdenTienda'

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

// Mismo criterio de búsqueda que el resto del sistema: tokenizada, sin
// acentos/mayúsculas (ver Artículos, Actualizar Precios, Actualizar Fotos).
function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
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

function precioMinimo(g: GrupoProducto): number {
  return Math.min(...g.variantes.map(v => v.precio))
}

export default async function TiendaPage({
  searchParams,
}: {
  searchParams: Promise<{ rubro?: string; marca?: string; stock?: string; q?: string; orden?: string }>
}) {
  const { rubro: rubroParam, marca: marcaParam, stock: stockParam, q: busquedaParam, orden: ordenParam } = await searchParams
  const rubrosSeleccionados = (rubroParam || '').split(',').filter(Boolean)
  const marcasSeleccionadas = (marcaParam || '').split(',').filter(Boolean)
  const soloConStock = stockParam === 'con'
  const busqueda = normalizar((busquedaParam || '').trim())
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

  let gruposFiltrados = grupos.filter(g => {
    if (rubrosSeleccionados.length > 0 && (!g.rubro || !rubrosSeleccionados.includes(g.rubro))) return false
    if (marcasSeleccionadas.length > 0 && (!g.marca || !marcasSeleccionadas.includes(g.marca))) return false
    if (soloConStock && !g.variantes.some(v => v.stock > 0)) return false
    if (busqueda) {
      const texto = normalizar(`${g.titulo} ${g.marca || ''}`)
      if (!texto.includes(busqueda)) return false
    }
    return true
  })

  // Ordenamiento con dos niveles: primero con stock / sin stock, luego el
  // criterio elegido (nombre/precio). Los SIN STOCK siempre van al final,
  // sin importar qué opción tenga seleccionada "Ordenar por".
  gruposFiltrados = [...gruposFiltrados].sort((a, b) => {
    const stockA = a.variantes.some(v => v.stock > 0) ? 1 : 0
    const stockB = b.variantes.some(v => v.stock > 0) ? 1 : 0

    // Primer nivel: productos con stock primero
    if (stockA !== stockB) return stockB - stockA

    // Segundo nivel: criterio del dropdown
    if (ordenParam === 'precio_asc') {
      return precioMinimo(a) - precioMinimo(b)
    } else if (ordenParam === 'precio_desc') {
      return precioMinimo(b) - precioMinimo(a)
    } else if (ordenParam === 'nombre_desc') {
      return b.titulo.localeCompare(a.titulo)
    } else {
      // Por defecto ('relevancia' o 'nombre_asc'): alfabético por título (nombre_base o nombre)
      return a.titulo.localeCompare(b.titulo)
    }
  })

  return (
    <div className="min-h-screen bg-surface-subtle">
      {/* Header */}
      <header className="bg-charcoal text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex items-center justify-between">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-habitus.png" alt="Hábitus SD — Suplementos Deportivos" className="h-12 w-auto" />
            <p className="text-sm text-white/60 mt-1">Suplementos deportivos en Cinco Saltos</p>
          </div>
          <CarritoBoton />
        </div>
      </header>

      {/* Skip link */}
      <a href="#productos" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-charcoal focus:text-white focus:px-4 focus:py-2 focus:rounded-lg">
        Saltar al catálogo
      </a>

      {/* Sidebar de filtros + grid de productos */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col md:flex-row gap-6">
        <FiltrosTienda rubros={rubros} marcas={marcas} />

        <main id="productos" className="flex-1 min-w-0">
          <h2 className="sr-only">Resultados</h2>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-medium-gray">
              {gruposFiltrados.length} {gruposFiltrados.length === 1 ? 'producto' : 'productos'}
            </p>
            <OrdenTienda />
          </div>

          {error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center text-sm text-red-700">
              No se pudo cargar el catálogo. Probá de nuevo en un momento.
            </div>
          ) : gruposFiltrados.length === 0 ? (
            <div className="bg-white border border-border-gray rounded-lg p-12 text-center text-sm text-medium-gray">
              No hay productos con los filtros aplicados.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {gruposFiltrados.map(g => (
                <ProductoCard
                  key={g.key}
                  titulo={g.titulo}
                  marca={g.marca}
                  rubro={g.rubro}
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
      </div>

      <footer className="border-t border-border-gray py-6 text-center text-xs text-medium-gray">
        <p>Av. Roca 54, Cinco Saltos, Río Negro — Hábitus SD</p>
        <a
          href="https://www.instagram.com/habitussd/"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Seguinos en Instagram"
          className="inline-flex items-center justify-center mt-2 text-medium-gray hover:text-offer-teal transition-colors"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" aria-hidden="true">
            <path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.43.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.43.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.72 3.72 0 0 1-1.38-.9 3.72 3.72 0 0 1-.9-1.38c-.16-.43-.36-1.06-.41-2.23-.06-1.27-.07-1.65-.07-4.85s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.43-.16 1.06-.36 2.23-.41 1.27-.06 1.65-.07 4.85-.07M12 0C8.74 0 8.33.01 7.05.07c-1.28.06-2.15.26-2.91.56a5.88 5.88 0 0 0-2.13 1.38A5.88 5.88 0 0 0 .63 4.14c-.3.76-.5 1.63-.56 2.91C.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.28.26 2.15.56 2.91.3.79.71 1.46 1.38 2.13.67.67 1.34 1.08 2.13 1.38.76.3 1.63.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.28-.06 2.15-.26 2.91-.56a5.88 5.88 0 0 0 2.13-1.38 5.88 5.88 0 0 0 1.38-2.13c.3-.76.5-1.63.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.28-.26-2.15-.56-2.91a5.88 5.88 0 0 0-1.38-2.13A5.88 5.88 0 0 0 19.86.63c-.76-.3-1.63-.5-2.91-.56C15.67.01 15.26 0 12 0Zm0 5.84A6.16 6.16 0 1 0 18.16 12 6.16 6.16 0 0 0 12 5.84Zm0 10.16A4 4 0 1 1 16 12a4 4 0 0 1-4 4Zm6.41-10.4a1.44 1.44 0 1 1-1.44-1.44 1.44 1.44 0 0 1 1.44 1.44Z"/>
          </svg>
        </a>
      </footer>
    </div>
  )
}
