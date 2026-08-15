'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Search, Calendar } from 'lucide-react'

interface ItemAgregado {
  id: number
  nombre: string
  rubroNombre: string
  unidades: number
  monto: number
  costo: number
}

type Vista = 'rubro' | 'articulo'
type CampoOrden = 'nombre' | 'unidades' | 'monto' | 'utilidad'

export default function ReporteVentasPage() {
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
  const primerDiaMes = hoy.slice(0, 8) + '01'

  const [fechaDesde, setFechaDesde] = useState(primerDiaMes)
  const [fechaHasta, setFechaHasta] = useState(hoy)
  const [vista, setVista] = useState<Vista>('rubro')
  const [busqueda, setBusqueda] = useState('')
  const [campoOrden, setCampoOrden] = useState<CampoOrden>('monto')
  const [ordenDesc, setOrdenDesc] = useState(true)

  const [porRubro, setPorRubro] = useState<ItemAgregado[]>([])
  const [porArticulo, setPorArticulo] = useState<ItemAgregado[]>([])

  useEffect(() => { cargar() }, [fechaDesde, fechaHasta])

  function partirEnLotes<T>(arr: T[], tam: number): T[][] {
    const out: T[][] = []
    for (let i = 0; i < arr.length; i += tam) out.push(arr.slice(i, i + tam))
    return out
  }

  function setPreset(valor: number | 'mes' | 'anio') {
    const hoyLocal = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
    if (valor === 'mes') {
      setFechaDesde(hoyLocal.slice(0, 8) + '01')
      setFechaHasta(hoyLocal)
      return
    }
    if (valor === 'anio') {
      setFechaDesde(hoyLocal.slice(0, 4) + '-01-01')
      setFechaHasta(hoyLocal)
      return
    }
    const d = new Date(hoyLocal + 'T00:00:00')
    d.setDate(d.getDate() - (valor - 1))
    setFechaDesde(d.toLocaleDateString('en-CA'))
    setFechaHasta(hoyLocal)
  }

  async function cargar() {
    setLoading(true)
    setError(null)
    try {
      // Catálogo: artículos + rubros (para nombres y agrupación) — query
      // separada + merge por Map, nunca join anidado (patrón del proyecto).
      const { data: articulosData, error: articulosError } = await supabase
        .from('articulos')
        .select('id, nombre, nombre_base, rubro_id')

      if (articulosError) throw articulosError

      const { data: rubrosData, error: rubrosError } = await supabase
        .from('rubros')
        .select('id, nombre')

      if (rubrosError) throw rubrosError

      const rubroNombreMap = new Map<number, string>()
      ;(rubrosData || []).forEach(r => rubroNombreMap.set(r.id, r.nombre))

      const articuloInfoMap = new Map<number, { nombre: string; rubroId: number | null }>()
      ;(articulosData || []).forEach(a => {
        articuloInfoMap.set(a.id, { nombre: a.nombre_base ?? a.nombre, rubroId: a.rubro_id })
      })

      // Ventas del rango elegido (excluye Anuladas — estado_venta_id=3)
      const { data: ventasData, error: ventasError } = await supabase
        .from('ventas')
        .select('id')
        .eq('sucursal_id', 1)
        .neq('estado_venta_id', 3)
        .gte('fecha_utc', fechaDesde)
        .lte('fecha_utc', fechaHasta)

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

      const filasArticulo: ItemAgregado[] = []
      const porRubroMap = new Map<number, { nombre: string; unidades: number; monto: number; costo: number }>()

      porArticuloMap.forEach((valores, articuloId) => {
        const info = articuloInfoMap.get(articuloId)
        const nombre = info?.nombre || `Artículo #${articuloId}`
        const rubroId = info?.rubroId ?? 0
        const rubroNombre = rubroId ? (rubroNombreMap.get(rubroId) || 'Sin rubro') : 'Sin rubro'

        filasArticulo.push({
          id: articuloId,
          nombre,
          rubroNombre,
          unidades: valores.unidades,
          monto: valores.monto,
          costo: valores.costo,
        })

        const prevRubro = porRubroMap.get(rubroId) || { nombre: rubroNombre, unidades: 0, monto: 0, costo: 0 }
        prevRubro.unidades += valores.unidades
        prevRubro.monto += valores.monto
        prevRubro.costo += valores.costo
        porRubroMap.set(rubroId, prevRubro)
      })

      const filasRubro: ItemAgregado[] = Array.from(porRubroMap.entries()).map(([rubroId, v]) => ({
        id: rubroId,
        nombre: v.nombre,
        rubroNombre: v.nombre,
        unidades: v.unidades,
        monto: v.monto,
        costo: v.costo,
      }))

      setPorArticulo(filasArticulo)
      setPorRubro(filasRubro)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : JSON.stringify(err))
    } finally {
      setLoading(false)
    }
  }

  const filasBase = vista === 'rubro' ? porRubro : porArticulo

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
      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Calendar className="w-4 h-4 text-gray-400" />
          <button onClick={() => setPreset(1)} className="px-3 py-1.5 text-xs rounded border border-gray-200 text-gray-600 hover:bg-gray-50">Hoy</button>
          <button onClick={() => setPreset(7)} className="px-3 py-1.5 text-xs rounded border border-gray-200 text-gray-600 hover:bg-gray-50">Últimos 7 días</button>
          <button onClick={() => setPreset(30)} className="px-3 py-1.5 text-xs rounded border border-gray-200 text-gray-600 hover:bg-gray-50">Últimos 30 días</button>
          <button onClick={() => setPreset('mes')} className="px-3 py-1.5 text-xs rounded border border-gray-200 text-gray-600 hover:bg-gray-50">Este mes</button>
          <button onClick={() => setPreset('anio')} className="px-3 py-1.5 text-xs rounded border border-gray-200 text-gray-600 hover:bg-gray-50">Este año</button>
          <div className="flex items-center gap-2 ml-2">
            <input
              type="date"
              value={fechaDesde}
              onChange={e => setFechaDesde(e.target.value)}
              className="text-xs border border-gray-200 rounded px-2 py-1.5 text-[#3c3c3b]"
            />
            <span className="text-xs text-gray-400">a</span>
            <input
              type="date"
              value={fechaHasta}
              onChange={e => setFechaHasta(e.target.value)}
              className="text-xs border border-gray-200 rounded px-2 py-1.5 text-[#3c3c3b]"
            />
          </div>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-3">
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
          No hay ventas registradas en el rango de fechas elegido.
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
