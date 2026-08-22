// Ruta destino: C:\Users\Usuario\Documents\sistema-habitus-sd\src\app\tienda\producto\[slug]\page.tsx
//
// Página de detalle de un producto puntual (una variante/sabor = una URL
// propia, indexable). Lee de articulos_catalogo_web, igual que el listado —
// nunca de la tabla articulos directo (esa vista ya excluye costo_sin_iva
// y demás columnas internas).

import { createClient } from '@/lib/supabase/server'
import { idDesdeSlugProducto, armarSlugProducto } from '@/lib/slug'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Package, ChevronRight, ChevronLeft } from 'lucide-react'
import DetalleAgregar from '@/components/tienda/DetalleAgregar'
import CarritoBoton from '@/components/tienda/CarritoBoton'
import { Mail, Phone, MapPin } from 'lucide-react'
import type { Metadata } from 'next'

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

const fmt = (n: number) => '$' + n.toLocaleString('es-AR', { minimumFractionDigits: 2 })

async function buscarProducto(slug: string) {
  const id = idDesdeSlugProducto(slug)
  if (id === null) return null

  const supabase = await createClient()
  const { data: producto } = await supabase
    .from('articulos_catalogo_web')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!producto) return null

  // Mismo criterio de agrupación que el listado (tienda/page.tsx): variantes
  // = mismo nombre_base + misma marca. Si no tiene nombre_base, es un
  // artículo suelto sin sabores para elegir.
  let variantes: ArticuloCatalogo[] = [producto]
  if (producto.nombre_base) {
    let query = supabase
      .from('articulos_catalogo_web')
      .select('*')
      .eq('nombre_base', producto.nombre_base)

    query = producto.marca_id === null ? query.is('marca_id', null) : query.eq('marca_id', producto.marca_id)

    const { data } = await query
    if (data && data.length > 0) variantes = data
  }

  variantes = [...variantes].sort((a, b) => (a.sabor || 'zzz').localeCompare(b.sabor || 'zzz'))

  return { producto: producto as ArticuloCatalogo, variantes: variantes as ArticuloCatalogo[] }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const resultado = await buscarProducto(slug)
  if (!resultado) return { title: 'Producto no encontrado — Hábitus SD' }

  const { producto } = resultado
  const titulo = producto.nombre_base || producto.nombre
  const descripcionCorta = producto.descripcion
    ? producto.descripcion.slice(0, 155)
    : `${titulo}${producto.marca ? ` — ${producto.marca}` : ''}. Comprá online con envío en Cinco Saltos, Río Negro.`

  return {
    title: `${titulo}${producto.marca ? ` — ${producto.marca}` : ''} | Hábitus SD`,
    description: descripcionCorta,
    openGraph: {
      title: titulo,
      description: descripcionCorta,
      images: producto.imagen_url ? [producto.imagen_url] : [],
    },
  }
}

export default async function DetalleProductoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const resultado = await buscarProducto(slug)
  if (!resultado) notFound()

  const { producto, variantes } = resultado
  const titulo = producto.nombre_base || producto.nombre
  const tieneVariantes = variantes.length > 1
  const sinStock = producto.stock <= 0

  // Casi todo el contenido de la descripción (composición, beneficios, modo
  // de uso) es igual entre sabores de un mismo producto — solo cambia el
  // sabor puntual. Si esta variante no tiene descripción propia cargada,
  // se usa la de cualquier hermana del mismo grupo que sí la tenga, en vez
  // de dejarlo en blanco. Así alcanza con cargar UNA descripción por
  // familia de producto, no una por cada sabor.
  const descripcionAMostrar = producto.descripcion || variantes.find(v => v.descripcion)?.descripcion || null

  // JSON-LD — mismos datos que después van a alimentar los feeds de
  // Facebook/Google Shopping, reutilizados acá para que Google entienda
  // precio/disponibilidad/marca de la página directamente.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: titulo,
    description: descripcionAMostrar || undefined,
    image: producto.imagen_url || undefined,
    brand: producto.marca ? { '@type': 'Brand', name: producto.marca } : undefined,
    sku: String(producto.id),
    offers: {
      '@type': 'Offer',
      priceCurrency: 'ARS',
      price: producto.precio,
      availability: sinStock ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
      url: `https://www.habitussd.com/tienda/producto/${armarSlugProducto(producto.id, titulo)}`,
    },
  }

  return (
    <div className="min-h-screen bg-surface-subtle">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Header — igual al del listado */}
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

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <Link
          href="/tienda"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-charcoal hover:text-offer-teal transition-colors mb-4"
        >
          <ChevronLeft className="w-4 h-4" />
          Volver al catálogo
        </Link>

        {/* Breadcrumb */}
        <nav aria-label="Ruta de navegación" className="flex items-center gap-1.5 text-xs text-medium-gray mb-5 flex-wrap">
          <Link href="/tienda" className="hover:text-charcoal transition-colors">Tienda</Link>
          {producto.rubro && (
            <>
              <ChevronRight className="w-3 h-3" />
              <Link href={`/tienda?rubro=${encodeURIComponent(producto.rubro)}`} className="hover:text-charcoal transition-colors">
                {producto.rubro}
              </Link>
            </>
          )}
          <ChevronRight className="w-3 h-3" />
          <span className="text-charcoal">{titulo}</span>
        </nav>

        <div className="bg-white border border-border-gray rounded-xl overflow-hidden grid grid-cols-1 md:grid-cols-2 gap-0">
          {/* Imagen */}
          <div className="aspect-square bg-surface-light flex items-center justify-center relative">
            {producto.imagen_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={producto.imagen_url} alt={titulo} className="w-full h-full object-cover" />
            ) : (
              <Package className="w-16 h-16 text-gray-300" />
            )}
            {producto.en_oferta && !sinStock && (
              <span className="absolute top-3 left-3 bg-offer-teal text-white text-xs font-semibold px-2.5 py-1 rounded-full">
                OFERTA
              </span>
            )}
            {sinStock && (
              <span className="absolute top-3 left-3 bg-gray-500 text-white text-xs font-semibold px-2.5 py-1 rounded-full">
                SIN STOCK
              </span>
            )}
          </div>

          {/* Datos */}
          <div className="p-6 flex flex-col">
            {producto.marca && <p className="text-xs text-medium-gray uppercase tracking-wide">{producto.marca}</p>}
            <h1 className="text-xl sm:text-2xl font-semibold text-charcoal leading-snug mt-1">{titulo}</h1>

            {/* Selector de sabor — links reales, cada uno con su propia URL indexable */}
            {tieneVariantes && (
              <div className="mt-4">
                <p className="text-xs font-medium text-medium-gray mb-1.5">
                  {producto.atributo_valor !== null ? 'Sabor' : 'Variante'}
                </p>
                <div role="group" aria-label="Variantes disponibles" className="flex flex-wrap gap-1.5">
                  {variantes.map(v => {
                    const esActual = v.id === producto.id
                    return (
                      <Link
                        key={v.id}
                        href={`/tienda/producto/${armarSlugProducto(v.id, titulo)}`}
                        title={v.stock <= 0 ? `${v.sabor} — sin stock` : v.sabor || ''}
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                          esActual
                            ? 'bg-offer-teal text-white border-offer-teal'
                            : v.stock <= 0
                            ? 'bg-white text-gray-300 border-border-gray'
                            : 'bg-white text-gray-600 border-gray-300 hover:border-offer-teal'
                        }`}
                      >
                        {v.sabor || 'Sabor'}
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}

            {!tieneVariantes && producto.atributo_valor && (
              <p className="text-sm text-medium-gray mt-2">{producto.atributo_valor}</p>
            )}

            <p className="text-2xl font-bold text-charcoal mt-4">{fmt(producto.precio)}</p>

            <div className="mt-4">
              <DetalleAgregar
                articuloId={producto.id}
                titulo={titulo}
                sabor={producto.sabor}
                marca={producto.marca}
                rubro={producto.rubro}
                precio={producto.precio}
                imagenUrl={producto.imagen_url}
                stock={producto.stock}
              />
            </div>

            {descripcionAMostrar && (
              <div className="mt-6 pt-6 border-t border-border-gray">
                <h2 className="text-sm font-semibold text-charcoal mb-2">Descripción</h2>
                <p className="text-sm text-medium-gray whitespace-pre-line leading-relaxed">{descripcionAMostrar}</p>
              </div>
            )}

            <Link
              href="/tienda"
              className="mt-6 text-xs text-medium-gray hover:text-charcoal transition-colors underline w-fit"
            >
              ← Volver al catálogo
            </Link>
          </div>
        </div>
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
