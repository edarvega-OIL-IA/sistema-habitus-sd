'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { ShoppingCart, TrendingUp, TrendingDown, Package, Clock, AlertTriangle, Target, Award, Wallet, ChevronDown, ChevronUp } from 'lucide-react'

interface VentasTurno {
  total: number
  cantidad: number
}

interface ResumenMes {
  ventas: number
  ingresos: number
  egresos: number
  costoMercaderia: number
  margenPct: number
}

interface ArticuloStockMinimo {
  id: number
  nombre: string
  stock_actual: number
  stock_min: number
}

interface CajaEstado {
  abierta: boolean
  turno: string | null
  apertura: number
  esperado: number
  efectivoEnCaja: number
  usuario: string | null
  desde: string | null
}

interface PuntoEquilibrio {
  costosFijos: number
  margenPct: number
  objetivo: number
  diferencia: number // positivo = superado, negativo = falta
}

interface VentasPorTurnoMes {
  manana: number
  tarde: number
}

interface ProductoDestacado {
  nombre: string
  total: number
}

type EstadoSemaforo = 'verde' | 'ambar' | 'rojo' | 'neutro'

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cajaEstado, setCajaEstado] = useState<CajaEstado>({ abierta: false, turno: null, apertura: 0, esperado: 0, efectivoEnCaja: 0, usuario: null, desde: null })
  const [ventasManana, setVentasManana] = useState<VentasTurno>({ total: 0, cantidad: 0 })
  const [ventasTarde, setVentasTarde] = useState<VentasTurno>({ total: 0, cantidad: 0 })
  const [ventasDia, setVentasDia] = useState<VentasTurno>({ total: 0, cantidad: 0 })
  const [resumenMes, setResumenMes] = useState<ResumenMes>({ ventas: 0, ingresos: 0, egresos: 0, costoMercaderia: 0, margenPct: 0 })
  const [stockMinimo, setStockMinimo] = useState<ArticuloStockMinimo[]>([])
  const [puntoEquilibrio, setPuntoEquilibrio] = useState<PuntoEquilibrio>({ costosFijos: 0, margenPct: 0, objetivo: 0, diferencia: 0 })
  const [ventasPorTurnoMes, setVentasPorTurnoMes] = useState<VentasPorTurnoMes>({ manana: 0, tarde: 0 })
  const [productoDestacado, setProductoDestacado] = useState<ProductoDestacado | null>(null)
  const [ultimaDiferenciaCaja, setUltimaDiferenciaCaja] = useState<number | null>(null)
  const [ritmoVentas, setRitmoVentas] = useState<number | null>(null) // ventas del mes / esperado a esta altura del mes

  const [mostrarStockValorizado, setMostrarStockValorizado] = useState(false)
  const [stockValorizado, setStockValorizado] = useState<number | null>(null)
  const [calculandoStock, setCalculandoStock] = useState(false)

  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
  const mesDesde = hoy.slice(0, 7) + '-01'

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    setLoading(true)
    setError(null)
    try {
      await Promise.all([
        cargarCaja(),
        cargarVentasDia(),
        cargarResumenMes(),
        cargarStockMinimo(),
        cargarPuntoEquilibrio(),
        cargarVentasPorTurnoMes(),
        cargarProductoDestacado(),
        cargarUltimaDiferenciaCaja(),
        cargarRitmoVentas(),
      ])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : JSON.stringify(err))
    } finally {
      setLoading(false)
    }
  }

  async function cargarCaja() {
    const { data, error } = await supabase
      .from('cierres_turno')
      .select('id, apertura, creado_en, turno_id, usuario_id')
      .eq('sucursal_id', 1)
      .eq('estado_cierre_turno_id', 1)
      .maybeSingle()

    if (error) throw error

    if (!data) {
      const { data: ultimoCierre, error: ultimoError } = await supabase
        .from('cierres_turno')
        .select('efectivo_real')
        .eq('sucursal_id', 1)
        .not('cerrado_en', 'is', null)
        .order('cerrado_en', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (ultimoError) throw ultimoError

      setCajaEstado({
        abierta: false, turno: null, apertura: 0, esperado: 0,
        efectivoEnCaja: ultimoCierre?.efectivo_real ?? 0,
        usuario: null, desde: null,
      })
      return
    }

    const [turnoRes, usuarioRes, ventasEfectivoRes, egresosRes, ingresosRes, retirosRes] = await Promise.all([
      supabase.from('turnos').select('nombre').eq('id', data.turno_id).single(),
      supabase.from('usuarios').select('nombre, apellido').eq('id', data.usuario_id).single(),
      supabase
        .from('venta_pagos')
        .select('monto, ventas!inner(sucursal_id, estado_venta_id, creado_en)')
        .eq('medio_pago_id', 1)
        .eq('ventas.sucursal_id', 1)
        .neq('ventas.estado_venta_id', 3)
        .gte('ventas.creado_en', data.creado_en),
      supabase
        .from('movimientos')
        .select('monto')
        .eq('sucursal_id', 1)
        .eq('tipo', 'Egreso')
        .eq('medio_pago_id', 1)
        .eq('anulado', false)
        .gte('creado_en', data.creado_en),
      supabase
        .from('movimientos')
        .select('monto, origen_tipo')
        .eq('sucursal_id', 1)
        .eq('tipo', 'Ingreso')
        .eq('medio_pago_id', 1)
        .eq('anulado', false)
        .gte('creado_en', data.creado_en),
      supabase
        .from('retiros_caja')
        .select('monto')
        .eq('cierre_turno_id', data.id),
    ])

    const totalVentas = (ventasEfectivoRes.data || []).reduce((s, v) => s + v.monto, 0)
    const totalEgresos = (egresosRes.data || []).reduce((s, e) => s + e.monto, 0)
    const totalIngresos = (ingresosRes.data || [])
      .filter((i: any) => i.origen_tipo !== 'venta')
      .reduce((s, i) => s + i.monto, 0)
    const totalRetiros = (retirosRes.data || []).reduce((s, r) => s + r.monto, 0)
    const esperado = data.apertura + totalVentas + totalIngresos - totalEgresos - totalRetiros

    setCajaEstado({
      abierta: true,
      turno: turnoRes.data?.nombre || null,
      apertura: data.apertura,
      esperado,
      efectivoEnCaja: esperado,
      usuario: usuarioRes.data ? `${usuarioRes.data.nombre} ${usuarioRes.data.apellido}` : null,
      desde: data.creado_en,
    })
  }

  async function cargarVentasDia() {
    const { data, error } = await supabase
      .from('ventas')
      .select('total, cierre_turno_id')
      .eq('sucursal_id', 1)
      .neq('estado_venta_id', 3)
      .eq('fecha_utc', hoy)

    if (error) throw error
    if (!data || data.length === 0) return

    const cierreIds = [...new Set(data.map(v => v.cierre_turno_id).filter(Boolean))]
    let cierreTurnoMap: Map<number, number> = new Map()

    if (cierreIds.length > 0) {
      const { data: cierres } = await supabase
        .from('cierres_turno')
        .select('id, turno_id')
        .in('id', cierreIds as number[])
      ;(cierres || []).forEach(c => cierreTurnoMap.set(c.id, c.turno_id))
    }

    const manana = data.filter(v => v.cierre_turno_id && cierreTurnoMap.get(v.cierre_turno_id) === 1)
    const tarde = data.filter(v => v.cierre_turno_id && cierreTurnoMap.get(v.cierre_turno_id) === 2)

    setVentasManana({ total: manana.reduce((s, v) => s + v.total, 0), cantidad: manana.length })
    setVentasTarde({ total: tarde.reduce((s, v) => s + v.total, 0), cantidad: tarde.length })
    setVentasDia({ total: data.reduce((s, v) => s + v.total, 0), cantidad: data.length })
  }

  async function cargarResumenMes() {
    const [ventasRes, movRes] = await Promise.all([
      supabase
        .from('ventas')
        .select('id, total')
        .eq('sucursal_id', 1)
        .neq('estado_venta_id', 3)
        .gte('fecha_utc', mesDesde)
        .lte('fecha_utc', hoy),
      supabase
        .from('movimientos')
        .select('tipo, monto')
        .eq('sucursal_id', 1)
        .eq('anulado', false)
        .gte('mes_contable', mesDesde),
    ])

    if (ventasRes.error) throw ventasRes.error
    if (movRes.error) throw movRes.error

    const totalVentas = (ventasRes.data || []).reduce((s, v) => s + v.total, 0)
    const ingresos = (movRes.data || []).filter(m => m.tipo === 'Ingreso').reduce((s, m) => s + m.monto, 0)
    const egresos = (movRes.data || []).filter(m => m.tipo === 'Egreso').reduce((s, m) => s + m.monto, 0)

    // Margen real: costo de la mercadería vendida este mes, contra costo ACTUAL
    // de cada artículo (no el costo histórico al momento de la venta, que no
    // se guarda por ítem — simplificación aceptada, el margen puede variar
    // levemente si el costo de un artículo cambió durante el mes).
    let costoMercaderia = 0
    const ventaIds = (ventasRes.data || []).map(v => v.id)
    if (ventaIds.length > 0) {
      const { data: itemsData } = await supabase
        .from('venta_items')
        .select('articulo_id, cantidad')
        .in('venta_id', ventaIds)

      if (itemsData && itemsData.length > 0) {
        const articuloIds = [...new Set(itemsData.map(i => i.articulo_id))]
        const { data: articulosCosto } = await supabase
          .from('articulos')
          .select('id, costo_sin_iva')
          .in('id', articuloIds)

        const costoMap = new Map((articulosCosto || []).map(a => [a.id, a.costo_sin_iva || 0]))
        costoMercaderia = itemsData.reduce((s, i) => s + i.cantidad * (costoMap.get(i.articulo_id) || 0), 0)
      }
    }

    const margenPct = totalVentas > 0 ? (totalVentas - costoMercaderia) / totalVentas : 0

    setResumenMes({ ventas: totalVentas, ingresos, egresos, costoMercaderia, margenPct })
  }

  async function cargarPuntoEquilibrio() {
    // Costos Fijos = todos los egresos del mes, EXCEPTO:
    // - categoria_gasto_id=1 (Compras Mercadería): ya está contemplado
    //   dentro del margen de contribución (costo de mercadería vendida) —
    //   contarlo acá también sería descontarlo dos veces.
    // - concepto_gasto_id=41 (Retiro de caja en efectivo): no es un gasto
    //   real del negocio, es solo un movimiento interno de plata.
    const { data, error } = await supabase
      .from('movimientos')
      .select('monto, categoria_gasto_id, concepto_gasto_id')
      .eq('sucursal_id', 1)
      .eq('tipo', 'Egreso')
      .eq('anulado', false)
      .gte('mes_contable', mesDesde)

    if (error) throw error

    const costosFijos = (data || [])
      .filter(m => m.categoria_gasto_id !== 1 && m.concepto_gasto_id !== 41)
      .reduce((s, m) => s + m.monto, 0)

    // Reutiliza margenPct de resumenMes — se recalcula acá para no depender
    // del orden de ejecución entre las dos funciones (ambas corren en paralelo).
    const { data: ventasRes } = await supabase
      .from('ventas')
      .select('id, total')
      .eq('sucursal_id', 1)
      .neq('estado_venta_id', 3)
      .gte('fecha_utc', mesDesde)
      .lte('fecha_utc', hoy)

    const totalVentas = (ventasRes || []).reduce((s, v) => s + v.total, 0)
    const ventaIds = (ventasRes || []).map(v => v.id)

    let costoMercaderia = 0
    if (ventaIds.length > 0) {
      const { data: itemsData } = await supabase
        .from('venta_items')
        .select('articulo_id, cantidad')
        .in('venta_id', ventaIds)

      if (itemsData && itemsData.length > 0) {
        const articuloIds = [...new Set(itemsData.map(i => i.articulo_id))]
        const { data: articulosCosto } = await supabase
          .from('articulos')
          .select('id, costo_sin_iva')
          .in('id', articuloIds)

        const costoMap = new Map((articulosCosto || []).map(a => [a.id, a.costo_sin_iva || 0]))
        costoMercaderia = itemsData.reduce((s, i) => s + i.cantidad * (costoMap.get(i.articulo_id) || 0), 0)
      }
    }

    const margenPct = totalVentas > 0 ? (totalVentas - costoMercaderia) / totalVentas : 0
    const objetivo = margenPct > 0 ? costosFijos / margenPct : 0
    const diferencia = totalVentas - objetivo

    setPuntoEquilibrio({ costosFijos, margenPct, objetivo, diferencia })
  }

  async function cargarVentasPorTurnoMes() {
    const { data, error } = await supabase
      .from('ventas')
      .select('total, cierre_turno_id')
      .eq('sucursal_id', 1)
      .neq('estado_venta_id', 3)
      .gte('fecha_utc', mesDesde)
      .lte('fecha_utc', hoy)

    if (error) throw error
    if (!data || data.length === 0) return

    const cierreIds = [...new Set(data.map(v => v.cierre_turno_id).filter(Boolean))]
    let cierreTurnoMap: Map<number, number> = new Map()

    if (cierreIds.length > 0) {
      const { data: cierres } = await supabase
        .from('cierres_turno')
        .select('id, turno_id')
        .in('id', cierreIds as number[])
      ;(cierres || []).forEach(c => cierreTurnoMap.set(c.id, c.turno_id))
    }

    const manana = data.filter(v => v.cierre_turno_id && cierreTurnoMap.get(v.cierre_turno_id) === 1)
      .reduce((s, v) => s + v.total, 0)
    const tarde = data.filter(v => v.cierre_turno_id && cierreTurnoMap.get(v.cierre_turno_id) === 2)
      .reduce((s, v) => s + v.total, 0)

    setVentasPorTurnoMes({ manana, tarde })
  }

  async function cargarProductoDestacado() {
    // "Esta semana" = últimos 7 días corridos (incluye hoy)
    const hace7Dias = new Date()
    hace7Dias.setDate(hace7Dias.getDate() - 6)
    const desde = hace7Dias.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })

    const { data: ventasRes } = await supabase
      .from('ventas')
      .select('id')
      .eq('sucursal_id', 1)
      .neq('estado_venta_id', 3)
      .gte('fecha_utc', desde)
      .lte('fecha_utc', hoy)

    const ventaIds = (ventasRes || []).map(v => v.id)
    if (ventaIds.length === 0) return

    const { data: itemsData } = await supabase
      .from('venta_items')
      .select('articulo_id, subtotal')
      .in('venta_id', ventaIds)

    if (!itemsData || itemsData.length === 0) return

    const totalesPorArticulo = new Map<number, number>()
    itemsData.forEach(i => {
      totalesPorArticulo.set(i.articulo_id, (totalesPorArticulo.get(i.articulo_id) || 0) + i.subtotal)
    })

    let mejorId: number | null = null
    let mejorTotal = 0
    totalesPorArticulo.forEach((total, id) => {
      if (total > mejorTotal) { mejorTotal = total; mejorId = id }
    })

    if (mejorId === null) return

    const { data: articulo } = await supabase
      .from('articulos')
      .select('nombre')
      .eq('id', mejorId)
      .single()

    setProductoDestacado({ nombre: articulo?.nombre || '—', total: mejorTotal })
  }

  async function cargarUltimaDiferenciaCaja() {
    const { data } = await supabase
      .from('cierres_turno')
      .select('diferencia')
      .eq('sucursal_id', 1)
      .not('cerrado_en', 'is', null)
      .order('cerrado_en', { ascending: false })
      .limit(1)
      .maybeSingle()

    setUltimaDiferenciaCaja(data?.diferencia ?? null)
  }

  async function cargarRitmoVentas() {
    // Promedio diario de los últimos 3 meses COMPLETOS (sin contar el mes en
    // curso), comparado contra lo vendido en lo que va del mes actual
    // ajustado al mismo número de días — así no se compara un mes a mitad
    // de camino contra meses ya cerrados.
    const fechaRef = new Date()
    const inicio3Meses = new Date(fechaRef.getFullYear(), fechaRef.getMonth() - 3, 1)
    const inicio3MesesStr = inicio3Meses.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })

    const { data } = await supabase
      .from('ventas')
      .select('total')
      .eq('sucursal_id', 1)
      .neq('estado_venta_id', 3)
      .gte('fecha_utc', inicio3MesesStr)
      .lt('fecha_utc', mesDesde)

    const totalUltimos3Meses = (data || []).reduce((s, v) => s + v.total, 0)
    const promedioDiario = totalUltimos3Meses / 90 // aproximado, no ajusta días exactos por mes

    const diaDelMes = new Date().getDate()
    const esperadoAEstaAltura = promedioDiario * diaDelMes

    if (esperadoAEstaAltura <= 0) { setRitmoVentas(null); return }

    // ventasMes todavía no está en el estado en este punto (corre en
    // paralelo) — se recalcula liviano acá mismo.
    const { data: ventasMesData } = await supabase
      .from('ventas')
      .select('total')
      .eq('sucursal_id', 1)
      .neq('estado_venta_id', 3)
      .gte('fecha_utc', mesDesde)
      .lte('fecha_utc', hoy)

    const ventasMes = (ventasMesData || []).reduce((s, v) => s + v.total, 0)
    setRitmoVentas(ventasMes / esperadoAEstaAltura)
  }

  async function cargarStockMinimo() {
    const { data: stocks, error } = await supabase
      .from('articulo_stock')
      .select('articulo_id, stock_actual, stock_min')
      .eq('sucursal_id', 1)
      .gt('stock_min', 0)

    if (error) throw error
    if (!stocks || stocks.length === 0) return

    const enMinimo = stocks.filter(s => s.stock_actual <= s.stock_min)
    if (enMinimo.length === 0) return

    const articuloIds = enMinimo.map(s => s.articulo_id)
    const { data: articulos } = await supabase
      .from('articulos')
      .select('id, nombre')
      .in('id', articuloIds)

    const artMap = new Map((articulos || []).map(a => [a.id, a.nombre]))

    setStockMinimo(enMinimo.map(s => ({
      id: s.articulo_id,
      nombre: artMap.get(s.articulo_id) || '—',
      stock_actual: s.stock_actual,
      stock_min: s.stock_min,
    })))
  }

  async function calcularStockValorizado() {
    setCalculandoStock(true)
    try {
      const { data: stocks } = await supabase
        .from('articulo_stock')
        .select('articulo_id, stock_actual')
        .eq('sucursal_id', 1)
        .gt('stock_actual', 0)

      if (!stocks || stocks.length === 0) { setStockValorizado(0); return }

      const articuloIds = [...new Set(stocks.map(s => s.articulo_id))]
      const { data: articulos } = await supabase
        .from('articulos')
        .select('id, costo_sin_iva')
        .in('id', articuloIds)

      const costoMap = new Map((articulos || []).map(a => [a.id, a.costo_sin_iva || 0]))
      const total = stocks.reduce((s, item) => s + item.stock_actual * (costoMap.get(item.articulo_id) || 0), 0)
      setStockValorizado(total)
    } finally {
      setCalculandoStock(false)
    }
  }

  const fmt = (n: number) => '$' + n.toLocaleString('es-AR', { minimumFractionDigits: 2 })
  const fmtPct = (n: number) => (n * 100).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%'
  const fmtHora = (s: string) => new Date(s).toLocaleTimeString('es-AR', {
    hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires'
  })

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-sm text-gray-400">Cargando dashboard...</p>
    </div>
  )

  if (error) return (
    <div className="mx-auto max-w-xl mt-8 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
      {error}
    </div>
  )

  const diferenciaMes = resumenMes.ingresos - resumenMes.egresos

  // ── Semáforo "Clima del negocio" ──────────────────────────────────────
  const estadoCaja: EstadoSemaforo = ultimaDiferenciaCaja === null ? 'neutro'
    : Math.abs(ultimaDiferenciaCaja) <= 500 ? 'verde'
    : Math.abs(ultimaDiferenciaCaja) <= 2000 ? 'ambar' : 'rojo'

  const estadoStock: EstadoSemaforo = stockMinimo.length === 0 ? 'verde'
    : stockMinimo.length <= 3 ? 'ambar' : 'rojo'

  const estadoMargen: EstadoSemaforo = resumenMes.margenPct >= 0.30 ? 'verde'
    : resumenMes.margenPct >= 0.20 ? 'ambar' : 'rojo'

  const estadoRitmo: EstadoSemaforo = ritmoVentas === null ? 'neutro'
    : ritmoVentas >= 1 ? 'verde'
    : ritmoVentas >= 0.85 ? 'ambar' : 'rojo'

  const colorSemaforo: Record<EstadoSemaforo, string> = {
    verde: 'bg-[#00a19a]',
    ambar: 'bg-[#D97706]',
    rojo: 'bg-[#DC2626]',
    neutro: 'bg-gray-300',
  }

  // ── Gráfico de torta (donut CSS, sin librerías) ───────────────────────
  const totalTurnoMes = ventasPorTurnoMes.manana + ventasPorTurnoMes.tarde
  const pctManana = totalTurnoMes > 0 ? (ventasPorTurnoMes.manana / totalTurnoMes) * 100 : 0

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-[#3c3c3b]">Dashboard</h1>

      {/* Estado de caja */}
      {!cajaEstado.abierta && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-orange-500" />
            <div>
              <p className="font-semibold text-orange-800 text-sm">Caja cerrada</p>
              <p className="text-xs text-orange-600">
                No se pueden registrar ventas hasta abrir la caja · Efectivo en caja: {fmt(cajaEstado.efectivoEnCaja)}
              </p>
            </div>
          </div>
          <button
            onClick={() => router.push('/cierre-turno')}
            className="bg-orange-500 text-white px-4 py-2 rounded text-sm hover:bg-orange-600 transition-colors"
          >
            Abrir caja
          </button>
        </div>
      )}

      {cajaEstado.abierta && (
        <div className="bg-[#00a19a]/10 border border-[#00a19a]/30 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-[#00a19a] animate-pulse" />
            <div>
              <p className="font-semibold text-[#3c3c3b] text-sm">
                Turno {cajaEstado.turno} abierto · {cajaEstado.usuario}
              </p>
              <p className="text-xs text-gray-500">
                Desde las {fmtHora(cajaEstado.desde!)} · Esperado en caja: {fmt(cajaEstado.esperado)}
              </p>
            </div>
          </div>
          <button
            onClick={() => router.push('/cierre-turno')}
            className="border border-[#00a19a] text-[#00a19a] px-4 py-2 rounded text-sm hover:bg-[#00a19a]/10 transition-colors"
          >
            Ver caja
          </button>
        </div>
      )}

      {/* Clima del negocio */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Clima del negocio</h2>
        <div className="grid grid-cols-4 gap-4">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${colorSemaforo[estadoCaja]}`} />
            <span className="text-sm text-gray-600">Caja</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${colorSemaforo[estadoStock]}`} />
            <span className="text-sm text-gray-600">Stock</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${colorSemaforo[estadoMargen]}`} />
            <span className="text-sm text-gray-600">Margen ({fmtPct(resumenMes.margenPct)})</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${colorSemaforo[estadoRitmo]}`} />
            <span className="text-sm text-gray-600">Ritmo de ventas</span>
          </div>
        </div>
      </div>

      {/* Ventas del día + Punto de equilibrio */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Ventas del día —{' '}
            {new Date().toLocaleDateString('es-AR', {
              weekday: 'long', day: 'numeric', month: 'long',
              timeZone: 'America/Argentina/Buenos_Aires'
            })}
          </h2>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-lg border border-gray-200 p-3">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-gray-400" />
                <p className="text-xs text-gray-500 font-medium">Mañana</p>
              </div>
              <p className="text-lg font-bold text-[#3c3c3b]">{fmt(ventasManana.total)}</p>
              <p className="text-xs text-gray-400">{ventasManana.cantidad} {ventasManana.cantidad === 1 ? 'venta' : 'ventas'}</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-3">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-gray-400" />
                <p className="text-xs text-gray-500 font-medium">Tarde</p>
              </div>
              <p className="text-lg font-bold text-[#3c3c3b]">{fmt(ventasTarde.total)}</p>
              <p className="text-xs text-gray-400">{ventasTarde.cantidad} {ventasTarde.cantidad === 1 ? 'venta' : 'ventas'}</p>
            </div>
            <div className="bg-[#3c3c3b] rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <ShoppingCart className="w-4 h-4 text-white/70" />
                <p className="text-xs text-white/70 font-medium">Total</p>
              </div>
              <p className="text-lg font-bold text-white">{fmt(ventasDia.total)}</p>
              <p className="text-xs text-white/50">{ventasDia.cantidad} {ventasDia.cantidad === 1 ? 'venta' : 'ventas'}</p>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
            <Target className="w-4 h-4 text-gray-400" />
            Punto de equilibrio del mes
          </h2>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-[#00a19a] rounded-full transition-all"
                style={{ width: `${Math.min(100, puntoEquilibrio.objetivo > 0 ? (resumenMes.ventas / puntoEquilibrio.objetivo) * 100 : 0)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-400 mb-3">
              <span>{fmt(resumenMes.ventas)} vendido</span>
              <span>Objetivo: {fmt(puntoEquilibrio.objetivo)}</span>
            </div>
            <p className={`text-lg font-bold ${puntoEquilibrio.diferencia >= 0 ? 'text-[#00a19a]' : 'text-[#D97706]'}`}>
              {puntoEquilibrio.diferencia >= 0
                ? `Superado por ${fmt(puntoEquilibrio.diferencia)}`
                : `Faltan ${fmt(Math.abs(puntoEquilibrio.diferencia))}`}
            </p>
          </div>
        </div>
      </div>

      {/* Resumen del mes */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          {new Date().toLocaleDateString('es-AR', {
            month: 'long', year: 'numeric',
            timeZone: 'America/Argentina/Buenos_Aires'
          }).replace(/^\w/, c => c.toUpperCase())}
        </h2>
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <ShoppingCart className="w-4 h-4 text-gray-400" />
              <p className="text-xs text-gray-500 font-medium">Ventas del mes</p>
            </div>
            <p className="text-xl font-bold text-[#3c3c3b]">{fmt(resumenMes.ventas)}</p>
          </div>
          <div className="bg-green-50 rounded-lg border border-green-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-green-500" />
              <p className="text-xs text-green-600 font-medium">Ingresos</p>
            </div>
            <p className="text-xl font-bold text-green-700">{fmt(resumenMes.ingresos)}</p>
          </div>
          <div className="bg-red-50 rounded-lg border border-red-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingDown className="w-4 h-4 text-red-500" />
              <p className="text-xs text-red-600 font-medium">Egresos</p>
            </div>
            <p className="text-xl font-bold text-red-700">{fmt(resumenMes.egresos)}</p>
          </div>
          <div className="bg-[#00a19a]/10 rounded-lg border border-[#00a19a]/30 p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-[#00a19a]" />
              <p className="text-xs text-[#00a19a] font-medium">Margen real</p>
            </div>
            <p className="text-xl font-bold text-[#00a19a]">{fmtPct(resumenMes.margenPct)}</p>
            <p className="text-xs text-gray-400 mt-0.5">{fmt(resumenMes.ventas - resumenMes.costoMercaderia)}</p>
          </div>
        </div>
      </div>

      {/* Torta por turno + Producto destacado */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Ventas del mes por turno</h2>
          {totalTurnoMes === 0 ? (
            <p className="text-sm text-gray-400">Sin ventas registradas este mes.</p>
          ) : (
            <div className="flex items-center gap-4">
              <div
                className="w-20 h-20 rounded-full shrink-0"
                style={{ background: `conic-gradient(#00a19a 0% ${pctManana}%, #0f6b66 ${pctManana}% 100%)` }}
              >
                <div className="w-11 h-11 bg-white rounded-full m-[18px]" />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-sm">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#00a19a]" />
                  <span className="text-gray-600">Mañana</span>
                  <span className="font-semibold text-[#3c3c3b]">{fmt(ventasPorTurnoMes.manana)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#0f6b66]" />
                  <span className="text-gray-600">Tarde</span>
                  <span className="font-semibold text-[#3c3c3b]">{fmt(ventasPorTurnoMes.tarde)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
            <Award className="w-4 h-4 text-gray-400" />
            Producto destacado — últimos 7 días
          </h2>
          {productoDestacado ? (
            <>
              <p className="text-lg font-bold text-[#3c3c3b]">{productoDestacado.nombre}</p>
              <p className="text-sm text-[#00a19a] font-semibold mt-1">{fmt(productoDestacado.total)} vendido</p>
            </>
          ) : (
            <p className="text-sm text-gray-400">Sin ventas registradas en los últimos 7 días.</p>
          )}
        </div>
      </div>

      {/* Stock valorizado (colapsado por defecto — evita el cálculo pesado en cada carga) */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <button
          onClick={() => setMostrarStockValorizado(!mostrarStockValorizado)}
          className="w-full flex items-center justify-between text-left"
        >
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
            <Wallet className="w-4 h-4 text-gray-400" />
            Stock valorizado
          </h2>
          {mostrarStockValorizado ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>

        {mostrarStockValorizado && (
          <div className="mt-3">
            {stockValorizado === null ? (
              <button
                onClick={calcularStockValorizado}
                disabled={calculandoStock}
                className="bg-[#00a19a] text-white px-4 py-2 rounded text-sm hover:bg-[#00a19a]/90 transition-colors disabled:opacity-50"
              >
                {calculandoStock ? 'Calculando...' : 'Calcular'}
              </button>
            ) : (
              <p className="text-2xl font-bold text-[#3c3c3b]">{fmt(stockValorizado)}</p>
            )}
          </div>
        )}
      </div>

      {/* Stock mínimo */}
      {stockMinimo.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-400" />
            Artículos en stock mínimo ({stockMinimo.length})
          </h2>
          <div className="bg-white rounded-lg border border-orange-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-orange-50 border-b border-orange-200">
                <tr>
                  <th className="text-left px-4 py-2 text-xs text-orange-700 font-semibold">Artículo</th>
                  <th className="text-right px-4 py-2 text-xs text-orange-700 font-semibold">Stock actual</th>
                  <th className="text-right px-4 py-2 text-xs text-orange-700 font-semibold">Mínimo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {stockMinimo.map(a => (
                  <tr key={a.id} className="hover:bg-orange-50/50">
                    <td className="px-4 py-2 text-gray-700">{a.nombre}</td>
                    <td className="px-4 py-2 text-right font-semibold text-red-600">{a.stock_actual}</td>
                    <td className="px-4 py-2 text-right text-gray-500">{a.stock_min}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {stockMinimo.length === 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-3">
          <Package className="w-5 h-5 text-[#00a19a]" />
          <p className="text-sm text-gray-500">Todos los artículos están por encima del stock mínimo.</p>
        </div>
      )}
    </div>
  )
}
