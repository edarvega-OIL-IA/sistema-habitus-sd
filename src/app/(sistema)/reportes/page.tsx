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
  labelCorto: string // 'Jul 26' — eje X en celular
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
  // null = "automático": en PC arranca en el primer mes real; en celular,
  // en la ventana que termina en el mes actual. Al navegar con las flechas
  // pasa a ser un número explícito.
  const [ventanaInicio, setVentanaInicio] = useState<number | null>(null)
  const [mesActualIdx, setMesActualIdx] = useState(0)
  const [esMovil, setEsMovil] = useState(false)

  // Celular = ancho < 640px (breakpoint `sm` de Tailwind). En celular los
  // gráficos muestran menos meses, etiquetas compactas y sin rotar, para que
  // las barras y los textos no se pisen.
  useEffect(() => {
    const media = window.matchMedia('(max-width: 639px)')
    setEsMovil(media.matches)
    const listener = (e: MediaQueryListEvent) => setEsMovil(e.matches)
    media.addEventListener('change', listener)
    return () => media.removeEventListener('change', listener)
  }, [])

  useEffect(() => { cargarReportes() }, [])

  function generarMeses(desde: string, hasta: string) {
    const [y1, m1] = desde.slice(0, 7).split('-').map(Number)
    const [y2, m2] = hasta.slice(0, 7).split('-').map(Number)
    const out: { mes: string; label: string; labelCorto: string }[] = []
    let y = y1, m = m1
    while (y < y2 || (y === y2 && m <= m2)) {
      out.push({
        mes: `${y}-${String(m).padStart(2, '0')}`,
        label: `${NOMBRES_MES[m - 1]} ${y}`,
        labelCorto: `${NOMBRES_MES[m - 1]} ${String(y).slice(2)}`,
      })
      m++
      if (m > 12) { m = 1; y++ }
    }
    return out
  }

  // Suma n meses a un 'YYYY-MM' — usado para generar los meses futuros
  // (todavía sin ventas) que completan la ventana fija de 13.
  function sumarMeses(mesYYYYMM: string, n: number): string {
    const [y, m] = mesYYYYMM.split('-').map(Number)
    const total = y * 12 + (m - 1) + n
    const y2 = Math.floor(total / 12)
    const m2 = (total % 12) + 1
    return `${y2}-${String(m2).padStart(2, '0')}`
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
        return
      }

      // Rango real desde la primera venta — la ventana de 13 meses con
      // navegación (más abajo) es la que evita mostrar meses vacíos, en
      // vez de forzar el año calendario completo.
      const meses = generarMeses(primeraVenta.fecha_utc, hoy)
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
      // se corte el eje de tiempo). Se extiende más allá de "hoy" hasta
      // cubrir siempre al menos 13 meses desde el primer mes real — así la
      // ventana de abajo nunca queda con menos de 13 barras (los meses
      // futuros simplemente no tienen ventas todavía, quedan en $0).
      const mesFinDisplay = sumarMeses(hoy.slice(0, 7), 12) + '-01'
      const mesesDisplay = generarMeses(mesInicio, mesFinDisplay)
      const serie: MesData[] = mesesDisplay.map(({ mes, label, labelCorto }) => {
        const ventas = ventasPorMes.get(mes) || 0
        const costoMercaderia = costoPorMes.get(mes) || 0
        const costosFijos = costosFijosPorMes.get(mes) || 0
        const utilidadBruta = ventas - costoMercaderia
        const utilidadNeta = utilidadBruta - costosFijos
        const margen = ventas > 0 ? utilidadBruta / ventas : 0
        const objetivoPE = margen > 0 ? costosFijos / margen : null
        return { mes, label, labelCorto, ventas, costoMercaderia, costosFijos, utilidadBruta, utilidadNeta, objetivoPE }
      })

      setDatos(serie)
      // Ventana siempre anclada al primer mes real (ej. Jul 2026), mostrando
      // 13 meses hacia adelante — los que todavía no llegaron quedan en $0
      // hasta que haya ventas reales. Con las flechas se navega más
      // adelante en el tiempo a medida que se acumulan más meses.
      setMesActualIdx(meses.length - 1) // `meses` llega hasta el mes actual
      setVentanaInicio(null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : JSON.stringify(err))
    } finally {
      setLoading(false)
    }
  }

  const ventana = esMovil ? 6 : 13
  const inicioMax = Math.max(0, datos.length - ventana)
  const inicioAuto = esMovil ? Math.max(0, mesActualIdx - ventana + 1) : 0
  const inicio = Math.min(ventanaInicio ?? inicioAuto, inicioMax)

  const datosFiltrados = useMemo(() => {
    return datos.slice(inicio, inicio + ventana)
  }, [datos, inicio, ventana])

  const puedeRetroceder = inicio > 0
  const puedeAvanzar = inicio < inicioMax
  const rangoLabel = datosFiltrados.length > 0
    ? `${datosFiltrados[0].label} — ${datosFiltrados[datosFiltrados.length - 1].label}`
    : ''

  const altoGrafico = esMovil ? 300 : 380
  const margenGrafico = esMovil
    ? { top: 24, right: 8, left: 0, bottom: 4 }
    : { top: 30, right: 20, left: 10, bottom: 10 }

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
        <h1 className="text-xl font-semibold text-[#3c3c3b] pl-14 md:pl-0">Reportes</h1>
        {datos.length > 0 && (
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <button
              onClick={() => setVentanaInicio(Math.max(0, inicio - 1))}
              disabled={!puedeRetroceder}
              className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:hover:bg-transparent"
            >‹</button>
            <span className="text-sm text-[#3c3c3b] font-medium min-w-[150px] sm:min-w-[180px] text-center">{rangoLabel}</span>
            <button
              onClick={() => setVentanaInicio(Math.min(inicioMax, inicio + 1))}
              disabled={!puedeAvanzar}
              className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:hover:bg-transparent"
            >›</button>
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

          {/* Utilidad mensual */}
          <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4 flex items-center gap-2">
              <Percent className="w-4 h-4 text-gray-400" />
              Utilidad mensual
            </h2>
            <ResponsiveContainer width="100%" height={altoGrafico}>
              <BarChart
                data={datosFiltrados}
                margin={margenGrafico}
                barGap={esMovil ? 2 : 4}
                barCategoryGap={esMovil ? '15%' : '10%'}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey={esMovil ? 'labelCorto' : 'label'}
                  tick={{ fontSize: esMovil ? 10 : 11 }}
                  interval={0}
                  angle={esMovil ? 0 : -35}
                  textAnchor={esMovil ? 'middle' : 'end'}
                  height={esMovil ? 28 : 60}
                />
                <YAxis tickFormatter={fmtEje} tick={{ fontSize: esMovil ? 10 : 11 }} width={esMovil ? 40 : 60} />
                <Tooltip formatter={(value: any) => fmt(Number(value ?? 0))} />
                <Legend
                  content={() => (
                    <div className="flex items-center justify-center flex-wrap gap-x-4 gap-y-1 text-xs text-[#3c3c3b] mt-2">
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
                {/* En celular las etiquetas de las 3 barras se pisan: se omiten y los
                    valores exactos van en la tabla de abajo. */}
                <Bar dataKey="utilidadBruta" name="Utilidad Bruta" fill="#00a19a" radius={[4, 4, 0, 0]}>
                  {!esMovil && <LabelList dataKey="utilidadBruta" position="top" formatter={fmtEtiqueta} style={{ fontSize: 10, fill: '#3c3c3b' }} />}
                </Bar>
                <Bar dataKey="costosFijos" name="Gastos fijos" fill="#DC2626" radius={[4, 4, 0, 0]}>
                  {!esMovil && <LabelList dataKey="costosFijos" position="top" formatter={fmtEtiqueta} style={{ fontSize: 10, fill: '#3c3c3b' }} />}
                </Bar>
                <Bar dataKey="utilidadNeta" name="Utilidad Neta" fill="#3c3c3b" radius={[4, 4, 0, 0]}>
                  {!esMovil && <LabelList dataKey="utilidadNeta" position="top" formatter={fmtEtiqueta} style={{ fontSize: 10, fill: '#3c3c3b' }} />}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* Tabla de valores — solo celular, solo meses con datos */}
            {esMovil && (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-xs text-[#3c3c3b]">
                  <thead>
                    <tr className="text-gray-500 border-b border-gray-200">
                      <th className="text-left font-medium py-1.5 pr-2">Mes</th>
                      <th className="text-right font-medium py-1.5 px-1">Bruta</th>
                      <th className="text-right font-medium py-1.5 px-1">Gastos</th>
                      <th className="text-right font-medium py-1.5 pl-1">Neta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datosFiltrados
                      .filter(d => d.ventas > 0 || d.costosFijos > 0)
                      .map(d => (
                        <tr key={d.mes} className="border-b border-gray-100 last:border-0">
                          <td className="py-1.5 pr-2 whitespace-nowrap">{d.labelCorto}</td>
                          <td className="text-right py-1.5 px-1 tabular-nums">{fmt(d.utilidadBruta)}</td>
                          <td className="text-right py-1.5 px-1 tabular-nums">{fmt(d.costosFijos)}</td>
                          <td className={`text-right py-1.5 pl-1 tabular-nums font-medium ${d.utilidadNeta < 0 ? 'text-red-600' : ''}`}>
                            {fmt(d.utilidadNeta)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}

            <p className="text-[11px] text-gray-400 mt-2">
              Bruta = Ventas − Costo de mercadería vendida (costo real grabado en cada venta). Gastos fijos = mismos
              movimientos que usa Punto de equilibrio (excluye Compras Mercadería y Retiro de caja). Neta = Bruta −
              Gastos fijos.
            </p>
          </div>

          {/* Ventas mensuales + Punto de equilibrio */}
          <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-gray-400" />
              Ventas mensuales
            </h2>
            <ResponsiveContainer width="100%" height={altoGrafico}>
              <ComposedChart data={datosFiltrados} margin={margenGrafico}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey={esMovil ? 'labelCorto' : 'label'}
                  tick={{ fontSize: esMovil ? 10 : 11 }}
                  interval={0}
                  angle={esMovil ? 0 : -35}
                  textAnchor={esMovil ? 'middle' : 'end'}
                  height={esMovil ? 28 : 60}
                />
                <YAxis tickFormatter={fmtEje} tick={{ fontSize: esMovil ? 10 : 11 }} width={esMovil ? 40 : 60} />
                <Tooltip formatter={(value: any) => fmt(Number(value ?? 0))} />
                <Legend />
                <Bar dataKey="ventas" name="Ventas" fill="#00a19a" radius={[4, 4, 0, 0]}>
                  <LabelList
                    dataKey="ventas"
                    position="top"
                    formatter={esMovil ? fmtEje : fmtEtiqueta}
                    style={{ fontSize: esMovil ? 9 : 10, fill: '#3c3c3b' }}
                  />
                </Bar>
                <Line
                  type="monotone" dataKey="objetivoPE" name="Punto de equilibrio"
                  stroke="#D97706" strokeWidth={2} strokeDasharray="5 4" dot={{ r: esMovil ? 2 : 3 }} connectNulls
                />
              </ComposedChart>
            </ResponsiveContainer>
            <p className="text-[11px] text-gray-400 mt-2">
              El Punto de equilibrio se calcula mes a mes con los gastos fijos y el margen reales de ese mismo mes
              (misma lógica que el Dashboard). Los meses sin margen positivo no muestran línea.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
