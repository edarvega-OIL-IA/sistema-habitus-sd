'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Search, Edit } from 'lucide-react'

interface Articulo {
  id: number
  nombre: string
  codigo_interno: string | null
  codigo_barra: string | null
  precio_local: number | null
  disponible_local: boolean
  disponible_web: boolean
  activo: boolean
  rubros: { nombre: string } | null
  marcas: { nombre: string } | null
  rubro_id: number | null
  marca_id: number | null
  articulo_stock: { stock_actual: number; sucursal_id: number }[]
}

interface Rubro {
  id: number
  nombre: string
}

interface Marca {
  id: number
  nombre: string
}

// Quita acentos/diacríticos y pasa a minúsculas, para que la búsqueda
// no dependa de tildes ni de mayúsculas (ej: "creatina" encuentra "Creatína").
function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

export default function ArticulosPage() {
  const [articulos, setArticulos] = useState<Articulo[]>([])
  const [rubros, setRubros] = useState<Rubro[]>([])
  const [marcas, setMarcas] = useState<Marca[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filtros
  const [busqueda, setBusqueda] = useState('')
  const [rubroFiltro, setRubroFiltro] = useState<string>('todos')
  const [marcaFiltro, setMarcaFiltro] = useState<string>('todos')
  const [disponibilidadFiltro, setDisponibilidadFiltro] = useState<string>('local') // local | web | todos
  const [stockFiltro, setStockFiltro] = useState<string>('todos') // con_stock | sin_stock | todos

  useEffect(() => {
    cargarDatos()
  }, [])

  async function cargarDatos() {
    const supabase = createClient()
    try {
      const [
        { data: articulosData, error: articulosError },
        { data: stockData },
        { data: rubrosData },
        { data: marcasData },
      ] = await Promise.all([
        supabase
          .from('articulos')
          .select(`
            id, nombre, codigo_interno, codigo_barra, precio_local,
            disponible_local, disponible_web, activo, rubro_id, marca_id,
            rubros!inner ( nombre ),
            marcas!inner ( nombre )
          `)
          .eq('activo', true)
          .order('nombre'),
        supabase
          .from('articulo_stock')
          .select('articulo_id, stock_actual')
          .eq('sucursal_id', 1),
        supabase.from('rubros').select('id, nombre').eq('activo', true).order('nombre'),
        supabase.from('marcas').select('id, nombre').eq('activo', true).order('nombre'),
      ])

      if (articulosError) throw articulosError

      // Mergear stock en cada artículo
      const stockMap = new Map((stockData || []).map(s => [s.articulo_id, s.stock_actual]))
      const articulosConStock = (articulosData || []).map(a => ({
        ...a,
        articulo_stock: [{ stock_actual: stockMap.get(a.id) ?? 0, sucursal_id: 1 }]
      }))

      setArticulos(articulosConStock as any)
      setRubros(rubrosData || [])
      setMarcas(marcasData || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const articulosFiltrados = articulos.filter(a => {
    // Búsqueda tokenizada e insensible a acentos/mayúsculas: cada palabra
    // escrita debe aparecer en algún lugar del texto buscable, sin importar
    // el orden (ej: "whey one fit" encuentra "Classic Whey Protein... One Fit").
    const tokens = normalizar(busqueda).trim().split(/\s+/).filter(Boolean)
    if (tokens.length > 0) {
      const haystack = normalizar(
        [a.nombre, a.codigo_interno, a.codigo_barra, (a.rubros as any)?.nombre, (a.marcas as any)?.nombre]
          .filter(Boolean)
          .join(' ')
      )
      if (!tokens.every(t => haystack.includes(t))) return false
    }
    if (rubroFiltro !== 'todos' && a.rubro_id?.toString() !== rubroFiltro) return false
    if (marcaFiltro !== 'todos' && a.marca_id?.toString() !== marcaFiltro) return false
    if (disponibilidadFiltro === 'local' && !a.disponible_local) return false
    if (disponibilidadFiltro === 'web' && !a.disponible_web) return false
    const stock = a.articulo_stock?.find(s => s.sucursal_id === 1)?.stock_actual ?? 0
    if (stockFiltro === 'con_stock' && stock <= 0) return false
    if (stockFiltro === 'sin_stock' && stock > 0) return false
    return true
  })

  const fmtPrecio = (n: number) => '$' + n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-gray-500 text-sm">Cargando artículos...</p></div>
  if (error) return <p className="text-red-500 text-sm">Error al cargar artículos: {error}</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-[#3c3c3b]">Artículos</h1>
        <Link href="/articulos/nuevo"
          className="bg-[#00a19a] text-white px-4 py-2 rounded text-sm hover:bg-[#008f89] transition-colors">
          + Nuevo artículo
        </Link>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {/* Buscador */}
          <div className="md:col-span-1">
            <label className="block text-xs font-medium text-gray-600 mb-1">Buscar</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input type="text"
                placeholder="Nombre, código interno o código de barras"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a] focus:border-transparent" />
            </div>
          </div>

          {/* Rubro */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Rubro</label>
            <select value={rubroFiltro} onChange={e => setRubroFiltro(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a] focus:border-transparent">
              <option value="todos">Todos los rubros</option>
              {rubros.map(r => <option key={r.id} value={r.id.toString()}>{r.nombre}</option>)}
            </select>
          </div>

          {/* Marca */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Marca</label>
            <select value={marcaFiltro} onChange={e => setMarcaFiltro(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a] focus:border-transparent">
              <option value="todos">Todas las marcas</option>
              {marcas.map(m => <option key={m.id} value={m.id.toString()}>{m.nombre}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Disponibilidad */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Disponibilidad</label>
            <select value={disponibilidadFiltro} onChange={e => setDisponibilidadFiltro(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a] focus:border-transparent">
              <option value="local">Disponibles en local</option>
              <option value="web">Disponibles en web</option>
              <option value="todos">Todos</option>
            </select>
          </div>

          {/* Stock */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Stock</label>
            <select value={stockFiltro} onChange={e => setStockFiltro(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a] focus:border-transparent">
              <option value="todos">Todos</option>
              <option value="con_stock">Con stock</option>
              <option value="sin_stock">Sin stock</option>
            </select>
          </div>

          {/* Contador */}
          <div className="flex items-end">
            <p className="text-xs text-gray-500 pb-2">
              {articulosFiltrados.length} {articulosFiltrados.length === 1 ? 'artículo' : 'artículos'}
            </p>
          </div>
        </div>
      </div>

      {/* Tabla */}
      {articulosFiltrados.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-500">No se encontraron artículos con los filtros aplicados.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs text-gray-600 font-semibold">Nombre</th>
                  <th className="text-left px-4 py-3 text-xs text-gray-600 font-semibold">Rubro</th>
                  <th className="text-left px-4 py-3 text-xs text-gray-600 font-semibold">Marca</th>
                  <th className="text-left px-4 py-3 text-xs text-gray-600 font-semibold">Cód. interno</th>
                  <th className="text-left px-4 py-3 text-xs text-gray-600 font-semibold">Cód. barras</th>
                  <th className="text-right px-4 py-3 text-xs text-gray-600 font-semibold">Precio local</th>
                  <th className="text-center px-4 py-3 text-xs text-gray-600 font-semibold">Stock</th>
                  <th className="text-center px-4 py-3 text-xs text-gray-600 font-semibold">Local</th>
                  <th className="text-center px-4 py-3 text-xs text-gray-600 font-semibold">Web</th>
                  <th className="text-center px-4 py-3 text-xs text-gray-600 font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {articulosFiltrados.map(a => {
                  const stock = a.articulo_stock?.find(s => s.sucursal_id === 1)?.stock_actual ?? 0
                  return (
                    <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-[#3c3c3b] font-medium">{a.nombre}</td>
                      <td className="px-4 py-3 text-[#00a19a] text-xs">{(a.rubros as any)?.nombre || '—'}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{(a.marcas as any)?.nombre || '—'}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{a.codigo_interno || '—'}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{a.codigo_barra || '—'}</td>
                      <td className="px-4 py-3 text-right font-semibold text-[#3c3c3b]">
                        {a.precio_local ? fmtPrecio(a.precio_local) : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs font-semibold ${stock > 0 ? 'text-[#3c3c3b]' : 'text-gray-300'}`}>
                          {stock > 0 ? stock : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={a.disponible_local ? 'text-green-600 font-bold' : 'text-gray-300'}>
                          {a.disponible_local ? '✓' : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={a.disponible_web ? 'text-green-600 font-bold' : 'text-gray-300'}>
                          {a.disponible_web ? '✓' : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Link href={`/articulos/${a.id}`}
                          className="inline-flex items-center justify-center w-8 h-8 rounded hover:bg-[#00a19a] hover:text-white text-gray-600 transition-colors"
                          title="Editar artículo">
                          <Edit className="w-4 h-4" />
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
