'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Search, Edit, Copy } from 'lucide-react'

interface Articulo {
  id: number
  nombre: string
  nombre_base: string | null
  sabor_id: number | null
  atributo_valor: string | null
  codigo_interno: string | null
  codigo_barra: string | null
  precio_local: number | null
  disponible_local: boolean
  disponible_web: boolean
  activo: boolean
  rubros: { nombre: string } | null
  marcas: { nombre: string } | null
  sabores: { nombre: string } | null
  rubro_id: number | null
  marca_id: number | null
  articulo_stock: { stock_actual: number; stock_min: number; sucursal_id: number }[]
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
  const [rolUsuario, setRolUsuario] = useState<number | null>(null)

  // Filtros
  const [busqueda, setBusqueda] = useState('')
  const [rubroFiltro, setRubroFiltro] = useState<string>('todos')
  const [marcaFiltro, setMarcaFiltro] = useState<string>('todos')
  const [disponibilidadFiltro, setDisponibilidadFiltro] = useState<string>('local') // local | web | todos
  const [stockFiltro, setStockFiltro] = useState<string>('todos') // con_stock | sin_stock | todos

  // Glosa de precios (WhatsApp / Instagram)
  const [mostrarGlosa, setMostrarGlosa] = useState(false)
  const [textoGlosa, setTextoGlosa] = useState('')
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    cargarDatos()
  }, [])

  async function cargarDatos() {
    const supabase = createClient()
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: usuarioData } = await supabase
          .from('usuarios').select('rol_id').eq('id', user.id).single()
        if (usuarioData) setRolUsuario(usuarioData.rol_id)
      }

      const [
        { data: articulosData, error: articulosError },
        { data: stockData },
        { data: rubrosData },
        { data: marcasData },
      ] = await Promise.all([
        supabase
          .from('articulos')
          .select(`
            id, nombre, nombre_base, sabor_id, atributo_valor,
            codigo_interno, codigo_barra, precio_local,
            disponible_local, disponible_web, activo, rubro_id, marca_id,
            rubros!inner ( nombre ),
            marcas!inner ( nombre ),
            sabores ( nombre )
          `)
          .eq('activo', true)
          .order('nombre'),
        supabase
          .from('articulo_stock')
          .select('articulo_id, stock_actual, stock_min')
          .eq('sucursal_id', 1),
        supabase.from('rubros').select('id, nombre').eq('activo', true).order('nombre'),
        supabase.from('marcas').select('id, nombre').eq('activo', true).order('nombre'),
      ])

      if (articulosError) throw articulosError

      // Mergear stock en cada artículo
      const stockMap = new Map((stockData || []).map(s => [s.articulo_id, s]))
      const articulosConStock = (articulosData || []).map(a => {
        const s = stockMap.get(a.id)
        return {
          ...a,
          articulo_stock: [{ stock_actual: s?.stock_actual ?? 0, stock_min: s?.stock_min ?? 0, sucursal_id: 1 }]
        }
      })

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
    const stockMin = a.articulo_stock?.find(s => s.sucursal_id === 1)?.stock_min ?? 0
    if (stockFiltro === 'con_stock' && stock <= 0) return false
    if (stockFiltro === 'sin_stock' && stock > 0) return false
    if (stockFiltro === 'con_minimo' && stockMin <= 0) return false
    if (stockFiltro === 'bajo_minimo' && !(stockMin > 0 && stock <= stockMin)) return false
    return true
  })

  // Si hay un rubro seleccionado, solo mostrar marcas que tengan al menos
  // un artículo en ese rubro — evita listar marcas irrelevantes al filtro actual.
  const marcasDisponibles = rubroFiltro === 'todos'
    ? marcas
    : marcas.filter(m => articulos.some(a => a.rubro_id?.toString() === rubroFiltro && a.marca_id === m.id))

  function handleCambioRubro(nuevoRubro: string) {
    setRubroFiltro(nuevoRubro)
    // Si la marca actualmente elegida no tiene artículos en el rubro nuevo, resetear el filtro de marca
    if (marcaFiltro !== 'todos' && nuevoRubro !== 'todos') {
      const sigueDisponible = articulos.some(a => a.rubro_id?.toString() === nuevoRubro && a.marca_id?.toString() === marcaFiltro)
      if (!sigueDisponible) setMarcaFiltro('todos')
    }
  }

  const fmtPrecio = (n: number) => '$' + n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  // Formato sin decimales para la glosa (ej: "$ 39.000"), como se escribe a mano por WhatsApp
  const fmtPrecioGlosa = (n: number) => '$ ' + Math.round(n).toLocaleString('es-AR')

  // El botón de glosa exige al menos un filtro que realmente acote QUÉ
  // artículos entran (Rubro, Marca o Búsqueda) — Disponibilidad/Stock no
  // cuentan para esto porque no eligen productos, solo su estado.
  const hayFiltroActivo = busqueda.trim() !== '' || rubroFiltro !== 'todos' || marcaFiltro !== 'todos'

  function stockDe(a: Articulo): number {
    return a.articulo_stock?.find(s => s.sucursal_id === 1)?.stock_actual ?? 0
  }

  // Arma el texto de la glosa a partir de lo que ya está filtrado en pantalla,
  // más 2 reglas fijas del negocio (no negociables por los filtros de arriba):
  // solo con stock real, y nunca las presentaciones "Caja X Unidades" (esas
  // son disponible_web, no disponible_local).
  function generarGlosa() {
    const base = articulosFiltrados.filter(a => a.disponible_local && stockDe(a) > 0)

    const porRubro = new Map<string, Articulo[]>()
    for (const a of base) {
      const rubroNombre = (a.rubros as any)?.nombre || 'Sin rubro'
      if (!porRubro.has(rubroNombre)) porRubro.set(rubroNombre, [])
      porRubro.get(rubroNombre)!.push(a)
    }

    const bloques: string[] = []
    for (const rubroNombre of Array.from(porRubro.keys()).sort((x, y) => x.localeCompare(y, 'es'))) {
      const items = porRubro.get(rubroNombre)!

      // Agrupa por Nombre base + Marca. Los artículos que todavía no tienen
      // Nombre base cargado (rubros sin trabajar todavía) quedan como grupo
      // propio de un solo artículo, usando su nombre completo tal cual está.
      const grupos = new Map<string, { marca: string; base: string; sabores: string[]; precios: number[] }>()
      for (const a of items) {
        const marcaNombre = (a.marcas as any)?.nombre || ''
        const baseNombre = a.nombre_base || a.nombre
        const key = baseNombre + '|' + marcaNombre
        if (!grupos.has(key)) grupos.set(key, { marca: marcaNombre, base: baseNombre, sabores: [], precios: [] })
        const g = grupos.get(key)!
        if (a.precio_local) g.precios.push(a.precio_local)
        if (a.nombre_base) {
          const saborLabel = (a.sabores as any)?.nombre || a.atributo_valor
          if (saborLabel && !g.sabores.includes(saborLabel)) g.sabores.push(saborLabel)
        }
      }

      const lineas = Array.from(grupos.values())
        .filter(g => g.precios.length > 0)
        .map(g => {
          const precioMin = Math.min(...g.precios)
          const saboresTexto = g.sabores.length > 0
            ? ' - ' + [...g.sabores].sort((x, y) => x.localeCompare(y, 'es')).join(', ')
            : ''
          return { texto: `- *${g.marca}* - ${g.base}${saboresTexto} ${fmtPrecioGlosa(precioMin)}`, precio: precioMin }
        })
        .sort((x, y) => x.precio - y.precio)
        .map(l => l.texto)

      if (lineas.length > 0) bloques.push(`*${rubroNombre}*\n` + lineas.join('\n'))
    }

    setTextoGlosa(bloques.join('\n\n'))
    setCopiado(false)
    setMostrarGlosa(true)
  }

  async function copiarGlosa() {
    try {
      await navigator.clipboard.writeText(textoGlosa)
      setCopiado(true)
    } catch {
      alert('No se pudo copiar automáticamente. Seleccioná el texto y copiá manualmente.')
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-gray-500 text-sm">Cargando artículos...</p></div>
  if (error) return <p className="text-red-500 text-sm">Error al cargar artículos: {error}</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-[#3c3c3b]">Artículos</h1>
        <div className="flex gap-2">
          <button type="button" onClick={generarGlosa} disabled={!hayFiltroActivo}
            title={hayFiltroActivo ? 'Genera la glosa con los filtros actuales' : 'Elegí al menos Rubro, Marca o Búsqueda para generar la glosa'}
            className="border border-[#00a19a] text-[#00a19a] px-4 py-2 rounded text-sm hover:bg-[#00a19a]/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent">
            Generar glosa
          </button>
          {rolUsuario === 1 && (
            <Link href="/articulos/precios"
              className="border border-[#00a19a] text-[#00a19a] px-4 py-2 rounded text-sm hover:bg-[#00a19a]/10 transition-colors">
              Actualizar precios
            </Link>
          )}
          <Link href="/articulos/nuevo"
            className="bg-[#00a19a] text-white px-4 py-2 rounded text-sm hover:bg-[#008f89] transition-colors">
            + Nuevo artículo
          </Link>
        </div>
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
            <select value={rubroFiltro} onChange={e => handleCambioRubro(e.target.value)}
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
              {marcasDisponibles.map(m => <option key={m.id} value={m.id.toString()}>{m.nombre}</option>)}
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
              <option value="con_minimo">Con mínimo configurado</option>
              <option value="bajo_minimo">Bajo mínimo</option>
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
                  <th className="text-center px-4 py-3 text-xs text-gray-600 font-semibold">Mín.</th>
                  <th className="text-center px-4 py-3 text-xs text-gray-600 font-semibold">Local</th>
                  <th className="text-center px-4 py-3 text-xs text-gray-600 font-semibold">Web</th>
                  <th className="text-center px-4 py-3 text-xs text-gray-600 font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {articulosFiltrados.map(a => {
                  const stock = a.articulo_stock?.find(s => s.sucursal_id === 1)?.stock_actual ?? 0
                  const stockMin = a.articulo_stock?.find(s => s.sucursal_id === 1)?.stock_min ?? 0
                  const bajoMinimo = stockMin > 0 && stock <= stockMin
                  return (
                    <tr key={a.id} className={`transition-colors ${bajoMinimo ? 'bg-orange-50 hover:bg-orange-100' : 'hover:bg-gray-50'}`}>
                      <td className="px-4 py-3 text-[#3c3c3b] font-medium">{a.nombre}</td>
                      <td className="px-4 py-3 text-[#00a19a] text-xs">{(a.rubros as any)?.nombre || '—'}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{(a.marcas as any)?.nombre || '—'}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{a.codigo_interno || '—'}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{a.codigo_barra || '—'}</td>
                      <td className="px-4 py-3 text-right font-semibold text-[#3c3c3b]">
                        {a.precio_local ? fmtPrecio(a.precio_local) : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs font-semibold ${bajoMinimo ? 'text-orange-600' : stock > 0 ? 'text-[#3c3c3b]' : 'text-gray-300'}`}>
                          {stock > 0 ? stock : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-xs text-gray-400">
                          {stockMin > 0 ? stockMin : '—'}
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
                        <div className="flex items-center justify-center gap-1">
                          <Link href={`/articulos/${a.id}`}
                            className="inline-flex items-center justify-center w-8 h-8 rounded hover:bg-[#00a19a] hover:text-white text-gray-600 transition-colors"
                            title="Editar artículo">
                            <Edit className="w-4 h-4" />
                          </Link>
                          <Link href={`/articulos/nuevo?duplicar=${a.id}`}
                            className="inline-flex items-center justify-center w-8 h-8 rounded hover:bg-indigo-600 hover:text-white text-gray-600 transition-colors"
                            title="Duplicar artículo">
                            <Copy className="w-4 h-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Glosa */}
      {mostrarGlosa && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg border border-gray-200 w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-base font-semibold text-[#3c3c3b]">Glosa de precios</h2>
              <button type="button" onClick={() => setMostrarGlosa(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <div className="p-4 overflow-y-auto">
              {textoGlosa ? (
                <textarea readOnly value={textoGlosa} rows={16}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#00a19a]" />
              ) : (
                <p className="text-sm text-gray-500 text-center py-8">No hay artículos con stock que coincidan con estos filtros.</p>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200">
              {copiado && <span className="text-xs text-[#00a19a] mr-auto">Copiado ✓</span>}
              <button type="button" onClick={() => setMostrarGlosa(false)}
                className="px-4 py-2 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50">
                Cerrar
              </button>
              <button type="button" onClick={copiarGlosa} disabled={!textoGlosa}
                className="px-4 py-2 bg-[#00a19a] text-white rounded text-sm hover:bg-[#008f89] disabled:opacity-40">
                Copiar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
