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
import Link from 'next/link'
import ProductoCard from '@/components/tienda/ProductoCard'
import CarritoBoton from '@/components/tienda/CarritoBoton'
import FiltrosTienda from '@/components/tienda/FiltrosTienda'
import OrdenTienda from '@/components/tienda/OrdenTienda'
import { Mail, Phone, MapPin } from 'lucide-react'

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

// Banners de categoría — solo las 6 con imagen armada por ahora (las de
// "Cafeínas" se dejaron afuera para no generar ambigüedad de nombre con el
// rubro real "Energía"; las de "Envíos a toda Argentina" quedan pendientes
// hasta que se implemente la fase de envíos a domicilio).
const CATEGORIAS_BANNER = [
  { rubro: 'Proteínas', imagen: '/categorias/proteinas.png' },
  { rubro: 'Creatinas', imagen: '/categorias/creatinas.png' },
  { rubro: 'Pre-entrenamiento', imagen: '/categorias/pre-entreno.png' },
  { rubro: 'Colágenos', imagen: '/categorias/colagenos.png' },
  { rubro: 'Quemadores', imagen: '/categorias/quemadores.png' },
  { rubro: 'Bebidas Isotónicas', imagen: '/categorias/isotonicas.png' },
]

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
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 relative flex items-center justify-center">
          <Link href="/tienda">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-habitus.png" alt="Hábitus SD — Suplementos Deportivos" className="h-20 w-auto" />
          </Link>
          <div className="absolute right-4 sm:right-6 top-1/2 -translate-y-1/2">
            <CarritoBoton />
          </div>
        </div>
      </header>

      {/* Skip link */}
      <a href="#productos" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-charcoal focus:text-white focus:px-4 focus:py-2 focus:rounded-lg">
        Saltar al catálogo
      </a>

      {/* Banners de categoría — solo en la vista "landing", sin filtro ni búsqueda activa */}
      {rubrosSeleccionados.length === 0 && marcasSeleccionadas.length === 0 && !busqueda && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6">
          <h2 className="text-lg font-semibold text-charcoal mb-3">Categorías</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {CATEGORIAS_BANNER.map(c => (
              <Link
                key={c.rubro}
                href={`/tienda?rubro=${encodeURIComponent(c.rubro)}`}
                className="block rounded-lg overflow-hidden border border-border-gray hover:opacity-90 transition-opacity"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.imagen} alt={c.rubro} className="w-full h-auto block" loading="lazy" />
              </Link>
            ))}
          </div>
        </div>
      )}

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

      <footer className="bg-charcoal text-white mt-6">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-sm">
          <a href="mailto:habitus.sd@gmail.com" className="flex items-center gap-2 hover:text-offer-teal transition-colors">
            <Mail className="w-4 h-4 text-offer-teal shrink-0" />
            habitus.sd@gmail.com
          </a>
          <a href="tel:+5492993244332" className="flex items-center gap-2 hover:text-offer-teal transition-colors">
            <Phone className="w-4 h-4 text-offer-teal shrink-0" />
            +54 9 299 324-4332
          </a>
          <p className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-offer-teal shrink-0" />
            Avenida Roca 54 — Cinco Saltos — Río Negro — Patagonia
          </p>
        </div>
      </footer>
    </div>
  )
}
