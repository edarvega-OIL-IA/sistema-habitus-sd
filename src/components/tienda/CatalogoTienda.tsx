// Ruta destino: C:\Users\Usuario\Documents\sistema-habitus-sd\src\components\tienda\CatalogoTienda.tsx
'use client'

// Catálogo interactivo de la Vitrina. Recibe del servidor la lista COMPLETA
// de productos ya agrupada y en orden alfabético fijo (así tienda/page.tsx
// puede quedar en caché de Vercel) y hace todo lo que antes hacía el
// servidor en cada visita: filtrar por rubro/marca/stock, buscar, ordenar y
// mezclar al azar. La URL (?rubro=…&q=…) se sigue actualizando para poder
// compartir links, pero con history.pushState: no se le pide nada al servidor.
//
// IMPORTANTE: useSearchParams NO se usa en este componente sino solo en el
// mini-componente SincronizarUrl (abajo), envuelto en su propio <Suspense>. En
// una página estática, useSearchParams obliga a renderizar en el navegador todo
// lo que tenga adentro su Suspense; si estuviera acá, el HTML que ven Google y
// los bots quedaría sin productos. Así solo ese componente (que no dibuja nada)
// se resuelve en el navegador.

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import ProductoCard from './ProductoCard'
import CarruselCategorias from './CarruselCategorias'
import FiltrosTienda from './FiltrosTienda'
import OrdenTienda from './OrdenTienda'
import {
  barajar,
  coincideBusqueda,
  hayStock,
  normalizar,
  precioMinimo,
  type GrupoProducto,
} from '@/lib/tienda/catalogoUtil'

// Banners de categoría — se muestran en el carrusel de dos filas contrapuestas
// (ver CarruselCategorias). Cada uno enlaza a /tienda?rubro=X. Las de
// "Cafeínas" se dejaron afuera para no generar ambigüedad de nombre con el
// rubro real "Energía"; las de "Envíos a toda Argentina" quedan pendientes
// hasta que se implemente la fase de envíos a domicilio.
const CATEGORIAS_BANNER = [
  { rubro: 'Proteínas', imagen: '/categorias/proteinas.png' },
  { rubro: 'Creatinas', imagen: '/categorias/creatinas.png' },
  { rubro: 'Pre-entrenamiento', imagen: '/categorias/pre-entreno.png' },
  { rubro: 'Colágenos', imagen: '/categorias/colagenos.png' },
  { rubro: 'Quemadores', imagen: '/categorias/quemadores.png' },
  { rubro: 'Bebidas Isotónicas', imagen: '/categorias/isotonicas.png' },
  { rubro: 'Geles', imagen: '/categorias/geles.png' },
]

interface Filtros {
  rubro: string
  marca: string
  stock: string
  q: string
  orden: string
}

const SIN_FILTROS: Filtros = { rubro: '', marca: '', stock: '', q: '', orden: '' }

// Avisa cada vez que cambia la URL: al cargar la página, con Atrás/Adelante y
// cuando se navega con un <Link> a la misma página (los banners de categoría
// del carrusel y el logo apuntan a /tienda?rubro=X y /tienda, y ese tipo de
// navegación NO dispara el evento popstate del navegador). No dibuja nada.
function SincronizarUrl({ alCambiar }: { alCambiar: (f: Filtros) => void }) {
  const params = useSearchParams()
  const clave = params.toString()
  useEffect(() => {
    alCambiar({
      rubro: params.get('rubro') || '',
      marca: params.get('marca') || '',
      stock: params.get('stock') || '',
      q: params.get('q') || '',
      orden: params.get('orden') || '',
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave])
  return null
}

function escribirUrl(f: Filtros) {
  const p = new URLSearchParams()
  if (f.rubro) p.set('rubro', f.rubro)
  if (f.marca) p.set('marca', f.marca)
  if (f.stock) p.set('stock', f.stock)
  if (f.q) p.set('q', f.q)
  if (f.orden) p.set('orden', f.orden)
  const qs = p.toString()
  const destino = qs ? `/tienda?${qs}` : '/tienda'
  if (destino !== window.location.pathname + window.location.search) {
    window.history.pushState(null, '', destino)
  }
}

interface Props {
  grupos: GrupoProducto[]
  rubros: string[]
  marcas: string[]
}

export default function CatalogoTienda({ grupos, rubros, marcas }: Props) {
  const [filtros, setFiltros] = useState<Filtros>(SIN_FILTROS)
  // Claves de los grupos en orden aleatorio (con stock primero, sin stock al
  // final). Se calcula una vez al cargar la página, en el navegador: así el
  // visitante ve un orden distinto en cada visita sin que el servidor tenga
  // que recalcular nada.
  const [ordenAleatorio, setOrdenAleatorio] = useState<string[] | null>(null)
  // Hasta que el navegador lee la URL y mezcla, la grilla se oculta (sigue en
  // el HTML para Google): así no se ve un orden y a los milisegundos otro.
  const [listo, setListo] = useState(false)
  const filtrosRef = useRef<Filtros>(SIN_FILTROS)

  // La URL cambió desde afuera (carga inicial, Atrás/Adelante, link de un
  // banner). Si coincide con lo que ya tenemos (p. ej. porque la acabamos de
  // escribir nosotros) no hace nada, así no pisa lo que se está tipeando.
  function alCambiarUrl(f: Filtros) {
    const a = filtrosRef.current
    if (a.rubro === f.rubro && a.marca === f.marca && a.stock === f.stock && a.q === f.q && a.orden === f.orden) return
    filtrosRef.current = f
    setFiltros(f)
  }

  // Mezcla al azar (Fisher-Yates) cuando llegan los datos.
  useEffect(() => {
    const conStock = grupos.filter(hayStock)
    const sinStock = grupos.filter(g => !hayStock(g))
    setOrdenAleatorio([...barajar(conStock), ...barajar(sinStock)].map(g => g.key))
    setListo(true)
  }, [grupos])

  function actualizar(clave: keyof Filtros, valor: string | null) {
    const nuevo = { ...filtrosRef.current, [clave]: valor ?? '' }
    filtrosRef.current = nuevo
    setFiltros(nuevo)
    escribirUrl(nuevo)
  }

  function limpiar() {
    filtrosRef.current = SIN_FILTROS
    setFiltros(SIN_FILTROS)
    escribirUrl(SIN_FILTROS)
  }

  const rubrosSeleccionados = filtros.rubro.split(',').filter(Boolean)
  const marcasSeleccionadas = filtros.marca.split(',').filter(Boolean)
  const soloConStock = filtros.stock === 'con'
  const busqueda = normalizar(filtros.q.trim())

  const gruposFiltrados = useMemo(() => {
    const filtrados = grupos.filter(g => {
      if (rubrosSeleccionados.length > 0 && (!g.rubro || !rubrosSeleccionados.includes(g.rubro))) return false
      if (marcasSeleccionadas.length > 0 && (!g.marca || !marcasSeleccionadas.includes(g.marca))) return false
      if (soloConStock && !hayStock(g)) return false
      if (busqueda) {
        const texto = normalizar(`${g.titulo} ${g.marca || ''} ${g.rubro || ''}`)
        if (!coincideBusqueda(texto, busqueda)) return false
      }
      return true
    })

    // Sin orden explícito ("Ordenar por" sin elegir): orden aleatorio, distinto
    // en cada visita, para dar sensación de catálogo vivo en vez de mostrar
    // siempre lo mismo primero. Los SIN STOCK siguen yendo al final. Si el
    // usuario elige un criterio puntual del dropdown (nombre o precio), ese
    // se respeta tal cual.
    const ordenExplicito = filtros.orden && filtros.orden !== 'relevancia'

    if (!ordenExplicito) {
      if (ordenAleatorio) {
        const posicion = new Map(ordenAleatorio.map((key, i) => [key, i]))
        return [...filtrados].sort((a, b) => (posicion.get(a.key) ?? 0) - (posicion.get(b.key) ?? 0))
      }
      // Antes de mezclar (HTML del servidor): con stock primero, alfabético.
      return [...filtrados.filter(hayStock), ...filtrados.filter(g => !hayStock(g))]
    }

    return [...filtrados].sort((a, b) => {
      const stockA = hayStock(a) ? 1 : 0
      const stockB = hayStock(b) ? 1 : 0

      // Primer nivel: productos con stock primero
      if (stockA !== stockB) return stockB - stockA

      // Segundo nivel: criterio del dropdown
      if (filtros.orden === 'precio_asc') {
        return precioMinimo(a) - precioMinimo(b)
      } else if (filtros.orden === 'precio_desc') {
        return precioMinimo(b) - precioMinimo(a)
      } else if (filtros.orden === 'nombre_desc') {
        return b.titulo.localeCompare(a.titulo)
      } else {
        // 'nombre_asc'
        return a.titulo.localeCompare(b.titulo)
      }
    })
    // rubrosSeleccionados / marcasSeleccionadas salen de filtros.rubro / filtros.marca
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grupos, filtros, ordenAleatorio])

  const ocultar = listo ? '' : 'catalogo-oculto opacity-0'

  return (
    <>
      <Suspense fallback={null}>
        <SincronizarUrl alCambiar={alCambiarUrl} />
      </Suspense>

      {/* Carrusel de categorías — solo en la vista "landing", sin filtro ni búsqueda activa */}
      {rubrosSeleccionados.length === 0 && marcasSeleccionadas.length === 0 && !busqueda && (
        <div className={`max-w-6xl mx-auto px-4 sm:px-6 pt-6 ${ocultar}`}>
          <CarruselCategorias categorias={CATEGORIAS_BANNER} />
        </div>
      )}

      {/* Sidebar de filtros + grid de productos */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col md:flex-row gap-6">
        <FiltrosTienda
          rubros={rubros}
          marcas={marcas}
          rubro={filtros.rubro}
          marca={filtros.marca}
          stock={filtros.stock}
          q={filtros.q}
          onCambio={actualizar}
          onLimpiar={limpiar}
        />

        <main id="productos" className="flex-1 min-w-0">
          <h2 className="sr-only">Resultados</h2>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-medium-gray">
              {gruposFiltrados.length} {gruposFiltrados.length === 1 ? 'producto' : 'productos'}
            </p>
            <OrdenTienda orden={filtros.orden} onCambio={valor => actualizar('orden', valor)} />
          </div>

          {gruposFiltrados.length === 0 ? (
            <div className="bg-white border border-border-gray rounded-lg p-12 text-center text-sm text-medium-gray">
              No hay productos con los filtros aplicados.
            </div>
          ) : (
            <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-4 ${ocultar}`}>
              {gruposFiltrados.map(g => (
                <ProductoCard
                  key={g.key}
                  titulo={g.titulo}
                  marca={g.marca}
                  rubro={g.rubro}
                  variantes={g.variantes}
                />
              ))}
            </div>
          )}
        </main>
      </div>
    </>
  )
}
