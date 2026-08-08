// Ruta destino: C:\Users\Usuario\Documents\sistema-habitus-sd\src\app\(sistema)\articulos\fotos\page.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Search, ArrowLeft, ImageOff, Camera } from 'lucide-react'
import ImagenesArticulo from '@/components/articulos/ImagenesArticulo'

interface ArticuloFoto {
  articulo_id: number
  nombre: string
  codigo_interno: string | null
  codigo_barra: string | null
  rubro_id: number | null
  rubroNombre: string | null
  marca_id: number | null
  marcaNombre: string | null
  disponible_local: boolean
  disponible_web: boolean
  stock: number
  imagenPrincipalUrl: string | null
  cantidadFotos: number
}

interface Rubro { id: number; nombre: string }
interface Marca { id: number; nombre: string }

// Mismo criterio de búsqueda que Artículos/Actualizar Precios: tokenizada, sin acentos/mayúsculas.
function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

export default function ActualizarFotosPage() {
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rubros, setRubros] = useState<Rubro[]>([])
  const [items, setItems] = useState<ArticuloFoto[]>([])
  const [modalArticuloId, setModalArticuloId] = useState<number | null>(null)

  // Filtros — mismos nombres/valores por defecto que Actualizar Precios,
  // + "Con fotos / Sin fotos" en vez de "OC pendiente".
  const [busqueda, setBusqueda] = useState('')
  const [rubroFiltro, setRubroFiltro] = useState('todos')
  const [marcaFiltro, setMarcaFiltro] = useState('todos')
  const [disponibilidadFiltro, setDisponibilidadFiltro] = useState('local')
  const [stockFiltro, setStockFiltro] = useState('todos')
  const [fotosFiltro, setFotosFiltro] = useState('todos')

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    setCargando(true)
    const supabase = createClient()
    try {
      const [
        { data: articulosData, error: articulosError },
        { data: stockData },
        { data: rubrosData },
        { data: marcasData },
        { data: imagenesData },
      ] = await Promise.all([
        supabase.from('articulos')
          .select('id, nombre, codigo_interno, codigo_barra, rubro_id, marca_id, disponible_local, disponible_web')
          .eq('activo', true).order('nombre'),
        supabase.from('articulo_stock').select('articulo_id, stock_actual').eq('sucursal_id', 1),
        supabase.from('rubros').select('id, nombre').eq('activo', true).order('nombre'),
        supabase.from('marcas').select('id, nombre').eq('activo', true).order('nombre'),
        supabase.from('articulo_imagenes').select('articulo_id, url, es_principal'),
      ])

      if (articulosError) throw articulosError

      const mapStock = new Map<number, number>((stockData || []).map(s => [s.articulo_id, s.stock_actual]))
      const mapRubros = new Map<number, string>((rubrosData || []).map((r: Rubro) => [r.id, r.nombre]))
      const mapMarcas = new Map<number, string>((marcasData || []).map((m: Marca) => [m.id, m.nombre]))

      const mapCantidadFotos = new Map<number, number>()
      const mapImagenPrincipal = new Map<number, string>()
      for (const img of (imagenesData || [])) {
        mapCantidadFotos.set(img.articulo_id, (mapCantidadFotos.get(img.articulo_id) || 0) + 1)
        if (img.es_principal || !mapImagenPrincipal.has(img.articulo_id)) {
          mapImagenPrincipal.set(img.articulo_id, img.url)
        }
      }

      setRubros(rubrosData || [])
      setItems((articulosData || []).map((a: any) => ({
        articulo_id: a.id,
        nombre: a.nombre,
        codigo_interno: a.codigo_interno,
        codigo_barra: a.codigo_barra,
        rubro_id: a.rubro_id,
        rubroNombre: a.rubro_id ? (mapRubros.get(a.rubro_id) || null) : null,
        marca_id: a.marca_id,
        marcaNombre: a.marca_id ? (mapMarcas.get(a.marca_id) || null) : null,
        disponible_local: a.disponible_local,
        disponible_web: a.disponible_web,
        stock: mapStock.get(a.id) ?? 0,
        imagenPrincipalUrl: mapImagenPrincipal.get(a.id) || null,
        cantidadFotos: mapCantidadFotos.get(a.id) || 0,
      })))
    } catch (err: any) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }

  // Al cerrar el modal de gestión de fotos, solo se refresca ese artículo
  // puntual (miniatura + cantidad) — no hace falta recargar todo de nuevo.
  async function refrescarFotosDe(articuloId: number) {
    const supabase = createClient()
    const { data } = await supabase.from('articulo_imagenes').select('url, es_principal').eq('articulo_id', articuloId)
    const principal = (data || []).find(i => i.es_principal)?.url || data?.[0]?.url || null
    setItems(prev => prev.map(it => it.articulo_id === articuloId
      ? { ...it, imagenPrincipalUrl: principal, cantidadFotos: (data || []).length }
      : it))
  }

  async function toggleDisponibilidad(articuloId: number, campo: 'disponible_local' | 'disponible_web', valorActual: boolean) {
    const supabase = createClient()
    setItems(prev => prev.map(it => it.articulo_id === articuloId ? { ...it, [campo]: !valorActual } : it))
    const { error: updError } = await supabase.from('articulos').update({ [campo]: !valorActual }).eq('id', articuloId)
    if (updError) {
      // Revertir en pantalla si falló el guardado
      setItems(prev => prev.map(it => it.articulo_id === articuloId ? { ...it, [campo]: valorActual } : it))
      const etiqueta = campo === 'disponible_web' ? 'Visible en tienda' : 'Disponible en local'
      setError(`No se pudo actualizar "${etiqueta}": ` + updError.message)
    }
  }

  // Marca queda scopeada al rubro elegido — mismo criterio que el resto de
  // las pantallas de filtros (ej. la vitrina): no tiene sentido mostrar
  // marcas que no existen en la categoría que estás mirando.
  const marcasDisponibles = useMemo(() => {
    const fuente = rubroFiltro === 'todos' ? items : items.filter(it => it.rubro_id?.toString() === rubroFiltro)
    const ids = new Set<number>()
    const resultado: Marca[] = []
    for (const it of fuente) {
      // it.marcaNombre puede venir null si marca_id apunta a una marca
      // inactiva o borrada — en ese caso se descarta, nunca se muestra
      // una opción con nombre vacío en el combo.
      if (it.marca_id && it.marcaNombre && !ids.has(it.marca_id)) {
        ids.add(it.marca_id)
        resultado.push({ id: it.marca_id, nombre: it.marcaNombre })
      }
    }
    return resultado.sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [items, rubroFiltro])

  // Si la marca tildada ya no está disponible en el rubro nuevo, la soltamos
  // (evita quedar filtrando por una marca invisible sin que se note por qué)
  useEffect(() => {
    if (marcaFiltro !== 'todos' && !marcasDisponibles.some(m => m.id.toString() === marcaFiltro)) {
      setMarcaFiltro('todos')
    }
  }, [marcasDisponibles, marcaFiltro])

  const itemsVisibles = useMemo(() => {
    return items.filter(it => {
      const tokens = normalizar(busqueda).trim().split(/\s+/).filter(Boolean)
      if (tokens.length > 0) {
        const haystack = normalizar([it.nombre, it.codigo_interno, it.codigo_barra, it.rubroNombre, it.marcaNombre].filter(Boolean).join(' '))
        if (!tokens.every(t => haystack.includes(t))) return false
      }
      if (rubroFiltro !== 'todos' && it.rubro_id?.toString() !== rubroFiltro) return false
      if (marcaFiltro !== 'todos' && it.marca_id?.toString() !== marcaFiltro) return false
      if (disponibilidadFiltro === 'local' && !it.disponible_local) return false
      if (disponibilidadFiltro === 'web' && !it.disponible_web) return false
      if (stockFiltro === 'con_stock' && it.stock <= 0) return false
      if (stockFiltro === 'sin_stock' && it.stock > 0) return false
      if (fotosFiltro === 'con_fotos' && it.cantidadFotos === 0) return false
      if (fotosFiltro === 'sin_fotos' && it.cantidadFotos > 0) return false
      return true
    })
  }, [items, busqueda, rubroFiltro, marcaFiltro, disponibilidadFiltro, stockFiltro, fotosFiltro])

  const modalArticulo = modalArticuloId ? items.find(it => it.articulo_id === modalArticuloId) : null

  if (cargando) return <p className="text-sm text-gray-500">Cargando artículos...</p>

  return (
    <div>
      <div className="mb-6">
        <Link href="/articulos" className="text-xs text-gray-400 hover:text-[#00a19a] flex items-center gap-1 mb-1">
          <ArrowLeft className="w-3 h-3" /> Volver a Artículos
        </Link>
        <h1 className="text-xl font-semibold text-[#3c3c3b]">Actualizar fotos</h1>
      </div>

      {error && (
        <div className="rounded-lg border px-4 py-3 flex items-center justify-between gap-3 mb-4 bg-red-50 border-red-200 text-red-700">
          <p className="text-sm font-medium">{error}</p>
          <button onClick={() => setError(null)} className="opacity-50 hover:opacity-100 text-lg leading-none">✕</button>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Buscar</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input type="text" placeholder="Nombre, código interno o de barras"
                value={busqueda} onChange={e => setBusqueda(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Rubro</label>
            <select value={rubroFiltro} onChange={e => setRubroFiltro(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]">
              <option value="todos">Todos los rubros</option>
              {rubros.map(r => <option key={r.id} value={r.id.toString()}>{r.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Marca</label>
            <select value={marcaFiltro} onChange={e => setMarcaFiltro(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]">
              <option value="todos">Todas las marcas</option>
              {marcasDisponibles.map(m => <option key={m.id} value={m.id.toString()}>{m.nombre}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Disponibilidad</label>
            <select value={disponibilidadFiltro} onChange={e => setDisponibilidadFiltro(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]">
              <option value="local">Disponibles en local</option>
              <option value="web">Disponibles en web</option>
              <option value="todos">Todos</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Stock</label>
            <select value={stockFiltro} onChange={e => setStockFiltro(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]">
              <option value="todos">Todos</option>
              <option value="con_stock">Con stock</option>
              <option value="sin_stock">Sin stock</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Fotos</label>
            <select value={fotosFiltro} onChange={e => setFotosFiltro(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]">
              <option value="todos">Con o sin fotos</option>
              <option value="sin_fotos">Sin fotos</option>
              <option value="con_fotos">Con fotos</option>
            </select>
          </div>
          <div className="flex items-end">
            <p className="text-xs text-gray-500 pb-2">
              {itemsVisibles.length} {itemsVisibles.length === 1 ? 'artículo' : 'artículos'}
            </p>
          </div>
        </div>
      </div>

      {/* Grilla de artículos */}
      {itemsVisibles.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-sm text-gray-500">
          No se encontraron artículos con los filtros aplicados.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {itemsVisibles.map(it => (
            <div key={it.articulo_id} className="bg-white rounded-lg border border-gray-200 overflow-hidden flex flex-col">
              <button
                onClick={() => setModalArticuloId(it.articulo_id)}
                className="aspect-square bg-[#f5f5f4] flex items-center justify-center relative group"
              >
                {it.imagenPrincipalUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.imagenPrincipalUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <ImageOff className="w-8 h-8 text-gray-300" />
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 bg-white rounded px-2 py-1 text-xs font-medium text-[#3c3c3b]">
                    <Camera className="w-3.5 h-3.5" />
                    {it.cantidadFotos > 0 ? `${it.cantidadFotos} foto${it.cantidadFotos > 1 ? 's' : ''}` : 'Subir fotos'}
                  </span>
                </div>
                {it.cantidadFotos === 0 && (
                  <span className="absolute top-1.5 left-1.5 bg-amber-500 text-white text-[9px] font-semibold px-1.5 py-0.5 rounded">
                    SIN FOTOS
                  </span>
                )}
              </button>
              <div className="p-2.5 flex flex-col gap-1.5 flex-1">
                {it.marcaNombre && <p className="text-[10px] text-gray-400 uppercase tracking-wide">{it.marcaNombre}</p>}
                <p className="text-xs font-medium text-[#3c3c3b] leading-snug line-clamp-2">{it.nombre}</p>
                <label className="flex items-center gap-1.5 text-[11px] text-gray-500 mt-auto pt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={it.disponible_local}
                    onChange={() => toggleDisponibilidad(it.articulo_id, 'disponible_local', it.disponible_local)}
                    className="rounded border-gray-300 text-[#00a19a] focus:ring-[#00a19a]"
                  />
                  Disponible en local
                </label>
                <label className="flex items-center gap-1.5 text-[11px] text-gray-500 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={it.disponible_web}
                    onChange={() => toggleDisponibilidad(it.articulo_id, 'disponible_web', it.disponible_web)}
                    className="rounded border-gray-300 text-[#00a19a] focus:ring-[#00a19a]"
                  />
                  Visible en tienda
                </label>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de gestión de fotos — reutiliza el mismo componente que ArticuloForm */}
      {modalArticulo && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg border border-gray-200 w-full max-w-lg max-h-[85vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
              <div>
                <p className="text-xs text-gray-400">{modalArticulo.marcaNombre}</p>
                <h2 className="text-sm font-semibold text-[#3c3c3b]">{modalArticulo.nombre}</h2>
              </div>
              <button
                onClick={() => { refrescarFotosDe(modalArticulo.articulo_id); setModalArticuloId(null) }}
                className="text-gray-400 hover:text-gray-600 text-sm"
              >
                Cerrar
              </button>
            </div>
            <div className="p-4">
              <ImagenesArticulo articuloId={modalArticulo.articulo_id} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
