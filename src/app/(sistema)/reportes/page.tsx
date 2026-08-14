'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  BarChart, Bar, ComposedChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, LabelList,
} from 'recharts'
import { TrendingUp, Percent, Calendar } from 'lucide-react'

interface MesData {
  mes: string      // 'YYYY-MM'
  label: string     // 'Jul 2026'
  ventas: number
  costoMercaderia: number
  costosFijos: number
  utilidadBruta: number
  utilidadNeta: number
  objetivoPE: number | null // Punto de equilibrio estimado de ese mes (null si no se pudo calcular)
}

const NOMBRES_MES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export default function ReportesPage() {
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [datos, setDatos] = useState<MesData[]>([])
  const [aniosDisponibles, setAniosDisponibles] = useState<string[]>([])
  const [anioSeleccionado, setAnioSeleccionado] = useState<string>('todo')

  useEffect(() => { cargarReportes() }, [])

  function generarMeses(desde: string, hasta: string) {
    const [y1, m1] = desde.slice(0, 7).split('-').map(Number)
    const [y2, m2] = hasta.slice(0, 7).split('-').map(Number)
    const out: { mes: string; label: string }[] = []
    let y = y1, m = m1
    while (y < y2 || (y === y2 && m <= m2)) {
      out.push({ mes: `${y}-${String(m).padStart(2, '0')}`, label: `${NOMBRES_MES[m - 1]} ${y}` })
      m++
      if (m > 12) { m = 1; y++ }
    }
    return out
  }

  function partirEnLotes<T>(arr: T[], tam: number): T[][] {
    const out: T[][] = []
    for (let i = 0; i < arr.length; i += tam) out.push(arr.slice(i, i + tam))
    return out
  }

  async function cargarReportes() {
    setLoading(true)
    setError(null)
    try {
      const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })

      // Rango: desde la primera venta real del sistema hasta hoy
      const { data: primeraVenta, error: primeraVentaError } = await supabase
        .from('ventas')
        .select('fecha_utc')
        .eq('sucursal_id', 1)
        .neq('estado_venta_id', 3)
        .order('fecha_utc', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (primeraVentaError) throw primeraVentaError

      if (!primeraVenta) {
        setDatos([])
        setAniosDisponibles([])
        return
      }

      // Rango: desde el 1 de enero del año de la primera venta real hasta
      // hoy — no desde el mes exacto de esa venta. Con eso "Todo el
      // histórico" (y cada año del selector) siempre muestra los 12 meses
      // completos de cada año, con los meses previos a la primera venta en
      // $0, en vez de 1-2 barras reales estirándose a todo el ancho del
      // gráfico (mismo criterio ya aplicado en el gráfico anual del
      // Dashboard).
      const primerAnio = primeraVenta.fecha_utc.slice(0, 4)
      const meses = generarMeses(`${primerAnio}-01-01`, hoy)
      const mesInicio = meses[0].mes + '-01'

      // Ventas + venta_items del rango completo
      const { data: ventasRes, error: ventasError } = await supabase
        .from('ventas')
        .select('id, total, fecha_utc')
        .eq('sucursal_id', 1)
        .neq('estado_venta_id', 3)
        .gte('fecha_utc', mesInicio)
        .lte('fecha_utc', hoy)

      if (ventasError) throw ventasError

      const ventaMesMap = new Map<number, string>()
      const ventasPorMes = new Map<string, number>()
      ;(ventasRes || []).forEach(v => {
        const mes = v.fecha_utc.slice(0, 7)
        ventaMesMap.set(v.id, mes)
        ventasPorMes.set(mes, (ventasPorMes.get(mes) || 0) + v.total)
      })

      const ventaIds = (ventasRes || []).map(v => v.id)
      const costoPorMes = new Map<string, number>()

      if (ventaIds.length > 0) {
        for (const lote of partirEnLotes(ventaIds, 500)) {
          const { data: itemsData, error: itemsError } = await supabase
            .from('venta_items')
            .select('venta_id, cantidad, costo_unitario')
            .in('venta_id', lote)

          if (itemsError) throw itemsError
          ;(itemsData || []).forEach(i => {
            const mes = ventaMesMap.get(i.venta_id)
            if (!mes) return
            costoPorMes.set(mes, (costoPorMes.get(mes) || 0) + i.cantidad * (i.costo_unitario || 0))
          })
        }
      }

      // Movimientos (Egresos) del rango, para costos fijos reales por mes —
      // misma exclusión que en Dashboard: Compras Mercadería y Retiro de caja
      // no son "costos fijos", ya están contemplados en otro lado.
      const { data: movData, error: movError } = await supabase
        .from('movimientos')
        .select('monto, categoria_gasto_id, concepto_gasto_id, mes_contable')
        .eq('sucursal_id', 1)
        .eq('tipo', 'Egreso')
        .eq('anulado', false)
        .gte('mes_contable', mesInicio)
        .lte('mes_contable', hoy)

      if (movError) throw movError

      const costosFijosPorMes = new Map<string, number>()
      ;(movData || []).forEach(m => {
        if (m.categoria_gasto_id === 1 || m.concepto_gasto_id === 41) return
        const mes = m.mes_contable.slice(0, 7)
        costosFijosPorMes.set(mes, (costosFijosPorMes.get(mes) || 0) + m.monto)
      })

      // Serie mensual completa (con ceros en los meses sin datos, para que no
      // se corte el eje de tiempo)
      const serie: MesData[] = meses.map(({ mes, label }) => {
        const ventas = ventasPorMes.get(mes) || 0
        const costoMercaderia = costoPorMes.get(mes) || 0
        const costosFijos = costosFijosPorMes.get(mes) || 0
        const utilidadBruta = ventas - costoMercaderia
        const utilidadNeta = utilidadBruta - costosFijos
        const margen = ventas > 0 ? utilidadBruta / ventas : 0
        const objetivoPE = margen > 0 ? costosFijos / margen : null
        return { mes, label, ventas, costoMercaderia, costosFijos, utilidadBruta, utilidadNeta, objetivoPE }
      })

      setDatos(serie)
      setAniosDisponibles([...new Set(serie.map(d => d.mes.slice(0, 4)))].sort())
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : JSON.stringify(err))
    } finally {
      setLoading(false)
    }
  }

  const datosFiltrados = useMemo(() => {
    if (anioSeleccionado === 'todo') return datos
    return datos.filter(d => d.mes.startsWith(anioSeleccionado))
  }, [datos, anioSeleccionado])

  const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-AR')
  const fmtEtiqueta = (n: any) => Math.round(Number(n ?? 0)).toLocaleString('es-AR')
  const fmtEje = (n: any) => {
    const num = Number(n ?? 0)
    const abs = Math.abs(num)
    if (abs >= 1_000_000) return (num / 1_000_000).toLocaleString('es-AR', { maximumFractionDigits: 1 }) + 'M'
    if (abs >= 1_000) return (num / 1_000).toLocaleString('es-AR', { maximumFractionDigits: 0 }) + 'K'
    return num.toString()
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-sm text-gray-400">Cargando reportes...</p>
    </div>
  )

  if (error) return (
    <div className="mx-auto max-w-xl mt-8 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
      {error}
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-semibold text-[#3c3c3b]">Reportes</h1>
        {aniosDisponibles.length > 0 && (
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <select
              value={anioSeleccionado}
              onChange={e => setAnioSeleccionado(e.target.value)}
              className="border border-gray-200 rounded-md text-sm px-3 py-1.5 text-[#3c3c3b] bg-white focus:outline-none focus:ring-1 focus:ring-[#00a19a]"
            >
              <option value="todo">Todo el histórico</option>
              {aniosDisponibles.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        )}
      </div>

      {datos.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-sm text-gray-400">
          Todavía no hay ventas registradas en el sistema para armar los reportes.
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-400">
            El costo de mercadería de las ventas anteriores al 30/07/2026 es una aproximación (costo del artículo
            al momento del backfill, no el costo real de esa fecha). Desde el 30/07 el costo por venta es exacto.
          </p>

          {/* Ventas mensuales + Punto de equilibrio */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-gray-400" />
              Ventas mensuales
            </h2>
            <ResponsiveContainer width="100%" height={380}>
              <ComposedChart data={datosFiltrados} margin={{ top: 30, right: 20, left: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} angle={-35} textAnchor="end" height={60} />
                <YAxis tickFormatter={fmtEje} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value: any) => fmt(Number(value ?? 0))} />
                <Legend />
                <Bar dataKey="ventas" name="Ventas" fill="#00a19a" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="ventas" position="top" formatter={fmtEtiqueta} style={{ fontSize: 10, fill: '#3c3c3b' }} />
                </Bar>
                <Line
                  type="monotone" dataKey="objetivoPE" name="Punto de equilibrio"
                  stroke="#D97706" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3 }} connectNulls
                />
              </ComposedChart>
            </ResponsiveContainer>
            <p className="text-[11px] text-gray-400 mt-2">
              El Punto de equilibrio se calcula mes a mes con los gastos fijos y el margen reales de ese mismo mes
              (misma lógica que el Dashboard). Los meses sin margen positivo no muestran línea.
            </p>
          </div>

          {/* Utilidad mensual */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4 flex items-center gap-2">
              <Percent className="w-4 h-4 text-gray-400" />
              Utilidad mensual
            </h2>
            <ResponsiveContainer width="100%" height={380}>
              <BarChart data={datosFiltrados} margin={{ top: 30, right: 20, left: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} angle={-35} textAnchor="end" height={60} />
                <YAxis tickFormatter={fmtEje} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value: any) => fmt(Number(value ?? 0))} />
                <Legend
                  content={() => (
                    <div className="flex items-center justify-center gap-4 text-xs text-[#3c3c3b] mt-2">
                      <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-sm inline-block" style={{ background: '#00a19a' }} />
                        Utilidad Bruta
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-sm inline-block" style={{ background: '#DC2626' }} />
                        Gastos fijos
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-sm inline-block" style={{ background: '#3c3c3b' }} />
                        Utilidad Neta
                      </span>
                    </div>
                  )}
                />
                <Bar dataKey="utilidadBruta" name="Utilidad Bruta" fill="#00a19a" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="utilidadBruta" position="top" formatter={fmtEtiqueta} style={{ fontSize: 10, fill: '#3c3c3b' }} />
                </Bar>
                <Bar dataKey="costosFijos" name="Gastos fijos" fill="#DC2626" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="costosFijos" position="top" formatter={fmtEtiqueta} style={{ fontSize: 10, fill: '#3c3c3b' }} />
                </Bar>
                <Bar dataKey="utilidadNeta" name="Utilidad Neta" fill="#3c3c3b" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="utilidadNeta" position="top" formatter={fmtEtiqueta} style={{ fontSize: 10, fill: '#3c3c3b' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p className="text-[11px] text-gray-400 mt-2">
              Bruta = Ventas − Costo de mercadería vendida (costo real grabado en cada venta). Gastos fijos = mismos
              movimientos que usa Punto de equilibrio (excluye Compras Mercadería y Retiro de caja). Neta = Bruta −
              Gastos fijos.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
