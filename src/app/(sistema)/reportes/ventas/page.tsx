'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Search, Filter, ChevronDown } from 'lucide-react'

interface ItemAgregado {
  id: number
  nombre: string
  rubroId: number
  rubroNombre: string
  unidades: number
  monto: number
  costo: number
}

interface Rubro {
  id: number
  nombre: string
}

type Vista = 'rubro' | 'articulo'
type CampoOrden = 'nombre' | 'unidades' | 'monto' | 'utilidad'
type ModoPeriodo = 'dia' | 'mes' | 'anio' | 'libre' | 'todos'

export default function ReporteVentasPage() {
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // --- Filtro de fecha: mismo patrón que Movimientos ---
  const [modoPeriodo, setModoPeriodo] = useState<ModoPeriodo>('mes')
  const [fechaRef, setFechaRef] = useState<Date>(new Date())
  const [fechaDesde, setFechaDesde] = useState<string>('')
  const [fechaHasta, setFechaHasta] = useState<string>('')

  function getDesdeHasta() {
    if (modoPeriodo === 'todos' || modoPeriodo === 'libre') return { desde: fechaDesde, hasta: fechaHasta }
    const y = fechaRef.getFullYear()
    const m = fechaRef.getMonth()
    const d = fechaRef.getDate()
    if (modoPeriodo === 'dia') {
      const s = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      return { desde: s, hasta: s }
    }
    if (modoPeriodo === 'mes') {
      const desde = `${y}-${String(m + 1).padStart(2, '0')}-01`
      const ultimo = new Date(y, m + 1, 0).getDate()
      const hasta = `${y}-${String(m + 1).padStart(2, '0')}-${String(ultimo).padStart(2, '0')}`
      return { desde, hasta }
    }
    if (modoPeriodo === 'anio') {
      return { desde: `${y}-01-01`, hasta: `${y}-12-31` }
    }
    return { desde: '', hasta: '' }
  }

  function avanzar() {
    const d = new Date(fechaRef)
    if (modoPeriodo === 'dia') d.setDate(d.getDate() + 1)
    else if (modoPeriodo === 'mes') d.setMonth(d.getMonth() + 1)
    else if (modoPeriodo === 'anio') d.setFullYear(d.getFullYear() + 1)
    setFechaRef(d)
  }

  function retroceder() {
    const d = new Date(fechaRef)
    if (modoPeriodo === 'dia') d.setDate(d.getDate() - 1)
    else if (modoPeriodo === 'mes') d.setMonth(d.getMonth() - 1)
    else if (modoPeriodo === 'anio') d.setFullYear(d.getFullYear() - 1)
    setFechaRef(d)
  }

  function labelFechaRef() {
    if (modoPeriodo === 'dia') return fechaRef.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'America/Argentina/Buenos_Aires' })
    if (modoPeriodo === 'mes') return fechaRef.toLocaleDateString('es-AR', { month: 'long', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' })
    if (modoPeriodo === 'anio') return fechaRef.getFullYear().toString()
    return ''
  }

  function limpiarTodo() {
    setModoPeriodo('todos')
    setFechaDesde('')
    setFechaHasta('')
    setFechaRef(new Date())
  }

  const { desde, hasta } = getDesdeHasta()

  // --- Filtro Rubros (multi-select) ---
  const [rubros, setRubros] = useState<Rubro[]>([])
  const [rubrosSeleccionados, setRubrosSeleccionados] = useState<Set<number>>(new Set())
  const [dropdownAbierto, setDropdownAbierto] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickFuera(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownAbierto(false)
      }
    }
    document.addEventListener('mousedown', onClickFuera)
    return () => document.removeEventListener('mousedown', onClickFuera)
  }, [])

  function toggleRubro(id: number) {
    setRubrosSeleccionados(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // --- Vista y orden ---
  const [vista, setVista] = useState<Vista>('rubro')
  const [busqueda, setBusqueda] = useState('')
  const [campoOrden, setCampoOrden] = useState<CampoOrden>('monto')
  const [ordenDesc, setOrdenDesc] = useState(true)

  const [filasArticuloTodas, setFilasArticuloTodas] = useState<ItemAgregado[]>([])

  useEffect(() => { cargar() }, [desde, hasta])

  function partirEnLotes<T>(arr: T[], tam: number): T[][] {
    const out: T[][] = []
    for (let i = 0; i < arr.length; i += tam) out.push(arr.slice(i, i + tam))
    return out
  }

  async function cargar() {
    setLoading(true)
    setError(null)
    try {
      const { data: articulosData, error: articulosError } = await supabase
        .from('articulos')
        .select('id, nombre, nombre_base, rubro_id')

      if (articulosError) throw articulosError

      const { data: rubrosData, error: rubrosError } = await supabase
        .from('rubros')
        .select('id, nombre')
        .order('nombre')

      if (rubrosError) throw rubrosError

      setRubros(rubrosData || [])

      const rubroNombreMap = new Map<number, string>()
      ;(rubrosData || []).forEach(r => rubroNombreMap.set(r.id, r.nombre))

      const articuloInfoMap = new Map<number, { nombre: string; rubroId: number | null }>()
      ;(articulosData || []).forEach(a => {
        articuloInfoMap.set(a.id, { nombre: a.nombre_base ?? a.nombre, rubroId: a.rubro_id })
      })

      const query = supabase
        .from('ventas')
        .select('id')
        .eq('sucursal_id', 1)
        .neq('estado_venta_id', 3)

      if (desde) query.gte('fecha_utc', desde)
      if (hasta) query.lte('fecha_utc', hasta)

      const { data: ventasData, error: ventasError } = await query
      if (ventasError) throw ventasError

      const ventaIds = (ventasData || []).map(v => v.id)
      const porArticuloMap = new Map<number, { unidades: number; monto: number; costo: number }>()

      if (ventaIds.length > 0) {
        for (const lote of partirEnLotes(ventaIds, 500)) {
          const { data: itemsData, error: itemsError } = await supabase
            .from('venta_items')
            .select('articulo_id, cantidad, subtotal, costo_unitario')
            .in('venta_id', lote)

          if (itemsError) throw itemsError

          ;(itemsData || []).forEach(it => {
            const prev = porArticuloMap.get(it.articulo_id) || { unidades: 0, monto: 0, costo: 0 }
            prev.unidades += it.cantidad
            prev.monto += it.subtotal
            prev.costo += it.cantidad * (it.costo_unitario || 0)
            porArticuloMap.set(it.articulo_id, prev)
          })
        }
      }

      const filas: ItemAgregado[] = []
      porArticuloMap.forEach((valores, articuloId) => {
        const info = articuloInfoMap.get(articuloId)
        const nombre = info?.nombre || `Artículo #${articuloId}`
        const rubroId = info?.rubroId ?? 0
        const rubroNombre = rubroId ? (rubroNombreMap.get(rubroId) || 'Sin rubro') : 'Sin rubro'
        filas.push({ id: articuloId, nombre, rubroId, rubroNombre, unidades: valores.unidades, monto: valores.monto, costo: valores.costo })
      })

      setFilasArticuloTodas(filas)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : JSON.stringify(err))
    } finally {
      setLoading(false)
    }
  }

  // Aplica filtro de rubros (vacío = todos) sobre las filas de artículo
  const filasArticuloConRubro = useMemo(() => {
    if (rubrosSeleccionados.size === 0) return filasArticuloTodas
    return filasArticuloTodas.filter(f => rubrosSeleccionados.has(f.rubroId))
  }, [filasArticuloTodas, rubrosSeleccionados])

  const filasRubro = useMemo(() => {
    const map = new Map<number, ItemAgregado>()
    filasArticuloConRubro.forEach(f => {
      const prev = map.get(f.rubroId) || { id: f.rubroId, nombre: f.rubroNombre, rubroId: f.rubroId, rubroNombre: f.rubroNombre, unidades: 0, monto: 0, costo: 0 }
      prev.unidades += f.unidades
      prev.monto += f.monto
      prev.costo += f.costo
      map.set(f.rubroId, prev)
    })
    return Array.from(map.values())
  }, [filasArticuloConRubro])

  const filasBase = vista === 'rubro' ? filasRubro : filasArticuloConRubro

  const filasFiltradas = useMemo(() => {
    let filas = filasBase
    if (vista === 'articulo' && busqueda.trim()) {
      const q = busqueda.trim().toLowerCase()
      filas = filas.filter(f => f.nombre.toLowerCase().includes(q) || f.rubroNombre.toLowerCase().includes(q))
    }
    return [...filas].sort((a, b) => {
      let va: number | string
      let vb: number | string
      if (campoOrden === 'nombre') { va = a.nombre; vb = b.nombre }
      else if (campoOrden === 'unidades') { va = a.unidades; vb = b.unidades }
      else if (campoOrden === 'utilidad') { va = a.monto - a.costo; vb = b.monto - b.costo }
      else { va = a.monto; vb = b.monto }
      if (typeof va === 'string') return ordenDesc ? (vb as string).localeCompare(va) : va.localeCompare(vb as string)
      return ordenDesc ? (vb as number) - (va as number) : (va as number) - (vb as number)
    })
  }, [filasBase, busqueda, vista, campoOrden, ordenDesc])

  const totales = useMemo(() => {
    return filasFiltradas.reduce((acc, f) => {
      acc.unidades += f.unidades
      acc.monto += f.monto
      acc.costo += f.costo
      return acc
    }, { unidades: 0, monto: 0, costo: 0 })
  }, [filasFiltradas])

  function toggleOrden(campo: CampoOrden) {
    if (campoOrden === campo) {
      setOrdenDesc(prev => !prev)
    } else {
      setCampoOrden(campo)
      setOrdenDesc(true)
    }
  }

  function flecha(campo: CampoOrden) {
    if (campoOrden !== campo) return ''
    return ordenDesc ? ' ↓' : ' ↑'
  }

  const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-AR')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-semibold text-[#3c3c3b]">Reportes — Ventas</h1>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-700">Filtros</h2>
        </div>

        {/* Fila 1: período (mismo patrón que Movimientos) */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {(['dia', 'mes', 'anio', 'libre'] as const).map(m => (
            <div key={m} className="flex items-center">
              {m !== 'libre' && modoPeriodo === m && (
                <button onClick={retroceder}
                  className="w-7 h-7 flex items-center justify-center rounded-l border border-r-0 border-gray-300 hover:bg-gray-100 text-gray-600 text-sm">
                  ‹
                </button>
              )}
              <button
                onClick={() => setModoPeriodo(m)}
                className={`px-3 py-1.5 text-sm font-medium border transition-colors ${
                  modoPeriodo === m
                    ? 'bg-[#00a19a] text-white border-[#00a19a]'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                } ${m !== 'libre' && modoPeriodo === m ? '' : 'rounded'}`}
              >
                {modoPeriodo === m && m !== 'libre' ? labelFechaRef() : m === 'dia' ? 'Día' : m === 'mes' ? 'Mes' : m === 'anio' ? 'Año' : 'Libre'}
              </button>
              {m !== 'libre' && modoPeriodo === m && (
                <button onClick={avanzar}
                  className="w-7 h-7 flex items-center justify-center rounded-r border border-l-0 border-gray-300 hover:bg-gray-100 text-gray-600 text-sm">
                  ›
                </button>
              )}
            </div>
          ))}
          <button
            onClick={limpiarTodo}
            className={`px-3 py-1.5 text-sm font-medium border rounded transition-colors ${
              modoPeriodo === 'todos'
                ? 'bg-[#00a19a] text-white border-[#00a19a]'
                : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50'
            }`}
          >
            Todos
          </button>

          {modoPeriodo !== 'todos' && (
            <div className="flex items-center gap-2 ml-2">
              <input type="date" value={desde}
                onChange={e => { setModoPeriodo('libre'); setFechaDesde(e.target.value) }}
                className="px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]" />
              <span className="text-gray-400 text-sm">—</span>
              <input type="date" value={hasta}
                onChange={e => { setModoPeriodo('libre'); setFechaHasta(e.target.value) }}
                className="px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]" />
            </div>
          )}
        </div>

        {/* Fila 2: rubros (multi-select), vista y buscador */}
        <div className="flex items-center justify-between flex-wrap gap-3 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Dropdown Rubros */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownAbierto(prev => !prev)}
                className={`flex items-center gap-2 px-3 py-1.5 text-sm border rounded transition-colors ${
                  rubrosSeleccionados.size > 0
                    ? 'bg-[#00a19a]/10 border-[#00a19a] text-[#00a19a]'
                    : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                Rubros{rubrosSeleccionados.size > 0 ? ` (${rubrosSeleccionados.size})` : ''}
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${dropdownAbierto ? 'rotate-180' : ''}`} />
              </button>
              {dropdownAbierto && (
                <div className="absolute z-10 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto">
                  <div className="p-2 border-b border-gray-100 flex items-center justify-between">
                    <span className="text-xs text-gray-500">{rubrosSeleccionados.size === 0 ? 'Mostrando todos' : `${rubrosSeleccionados.size} seleccionados`}</span>
                    {rubrosSeleccionados.size > 0 && (
                      <button onClick={() => setRubrosSeleccionados(new Set())} className="text-xs text-[#00a19a] hover:underline">
                        Limpiar
                      </button>
                    )}
                  </div>
                  {rubros.map(r => (
                    <label key={r.id} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rubrosSeleccionados.has(r.id)}
                        onChange={() => toggleRubro(r.id)}
                        className="rounded border-gray-300 text-[#00a19a] focus:ring-[#00a19a]"
                      />
                      {r.nombre}
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Toggle vista */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setVista('rubro')}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors ${vista === 'rubro' ? 'bg-white text-[#3c3c3b] shadow-sm' : 'text-gray-500'}`}
              >
                Por rubro
              </button>
              <button
                onClick={() => setVista('articulo')}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors ${vista === 'articulo' ? 'bg-white text-[#3c3c3b] shadow-sm' : 'text-gray-500'}`}
              >
                Por artículo
              </button>
            </div>
          </div>

          {vista === 'articulo' && (
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar artículo o rubro..."
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg text-[#3c3c3b]"
              />
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <p className="text-sm text-gray-400">Cargando reporte...</p>
        </div>
      ) : error ? (
        <div className="mx-auto max-w-xl mt-8 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      ) : filasFiltradas.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-sm text-gray-400">
          No hay ventas registradas con los filtros elegidos.
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th
                  onClick={() => toggleOrden('nombre')}
                  className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none whitespace-nowrap"
                >
                  {vista === 'rubro' ? 'Rubro' : 'Artículo'}{flecha('nombre')}
                </th>
                {vista === 'articulo' && (
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    Rubro
                  </th>
                )}
                <th
                  onClick={() => toggleOrden('unidades')}
                  className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none whitespace-nowrap"
                >
                  Unidades{flecha('unidades')}
                </th>
                <th
                  onClick={() => toggleOrden('monto')}
                  className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none whitespace-nowrap"
                >
                  Monto{flecha('monto')}
                </th>
                <th
                  onClick={() => toggleOrden('utilidad')}
                  className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none whitespace-nowrap"
                >
                  Utilidad{flecha('utilidad')}
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                  Margen %
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                  % del total
                </th>
              </tr>
            </thead>
            <tbody>
              {filasFiltradas.map(f => {
                const utilidad = f.monto - f.costo
                const margen = f.monto > 0 ? (utilidad / f.monto) * 100 : 0
                const pctTotal = totales.monto > 0 ? (f.monto / totales.monto) * 100 : 0
                return (
                  <tr key={f.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-[#3c3c3b]">{f.nombre}</td>
                    {vista === 'articulo' && (
                      <td className="px-4 py-2.5 text-gray-500">{f.rubroNombre}</td>
                    )}
                    <td className="px-4 py-2.5 text-right text-[#3c3c3b]">{f.unidades.toLocaleString('es-AR')}</td>
                    <td className="px-4 py-2.5 text-right text-[#3c3c3b]">{fmt(f.monto)}</td>
                    <td className={`px-4 py-2.5 text-right ${utilidad >= 0 ? 'text-[#00a19a]' : 'text-red-600'}`}>{fmt(utilidad)}</td>
                    <td className="px-4 py-2.5 text-right text-gray-500">{margen.toFixed(1)}%</td>
                    <td className="px-4 py-2.5 text-right text-gray-400">{pctTotal.toFixed(1)}%</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 font-semibold border-t-2 border-gray-200">
                <td className="px-4 py-3 text-[#3c3c3b]" colSpan={vista === 'articulo' ? 2 : 1}>Total</td>
                <td className="px-4 py-3 text-right text-[#3c3c3b]">{totales.unidades.toLocaleString('es-AR')}</td>
                <td className="px-4 py-3 text-right text-[#3c3c3b]">{fmt(totales.monto)}</td>
                <td className="px-4 py-3 text-right text-[#00a19a]">{fmt(totales.monto - totales.costo)}</td>
                <td className="px-4 py-3 text-right text-gray-500">
                  {totales.monto > 0 ? (((totales.monto - totales.costo) / totales.monto) * 100).toFixed(1) : '0.0'}%
                </td>
                <td className="px-4 py-3 text-right text-gray-400">100.0%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-400">
        El costo de mercadería de las ventas anteriores al 30/07/2026 es una aproximación (costo del artículo al
        momento del backfill, no el costo real de esa fecha). Desde el 30/07 el costo por venta es exacto.
      </p>
    </div>
  )
}
