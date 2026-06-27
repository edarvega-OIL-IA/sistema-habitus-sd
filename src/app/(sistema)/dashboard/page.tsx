'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { ShoppingCart, TrendingUp, TrendingDown, Package, Clock, AlertTriangle } from 'lucide-react'

interface VentasTurno {
  total: number
  cantidad: number
}

interface ResumenMes {
  ventas: number
  ingresos: number
  egresos: number
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
  usuario: string | null
  desde: string | null
}

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cajaEstado, setCajaEstado] = useState<CajaEstado>({ abierta: false, turno: null, apertura: 0, esperado: 0, usuario: null, desde: null })
  const [ventasManana, setVentasManana] = useState<VentasTurno>({ total: 0, cantidad: 0 })
  const [ventasTarde, setVentasTarde] = useState<VentasTurno>({ total: 0, cantidad: 0 })
  const [ventasDia, setVentasDia] = useState<VentasTurno>({ total: 0, cantidad: 0 })
  const [resumenMes, setResumenMes] = useState<ResumenMes>({ ventas: 0, ingresos: 0, egresos: 0 })
  const [stockMinimo, setStockMinimo] = useState<ArticuloStockMinimo[]>([])

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
      ])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cargar datos')
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
      setCajaEstado({ abierta: false, turno: null, apertura: 0, esperado: 0, usuario: null, desde: null })
      return
    }

    // Queries separadas para evitar joins anidados bloqueados por RLS
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
        .select('monto')
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
    const totalIngresos = (ingresosRes.data || []).reduce((s, i) => s + i.monto, 0)
    const totalRetiros = (retirosRes.data || []).reduce((s, r) => s + r.monto, 0)
    const esperado = data.apertura + totalVentas + totalIngresos - totalEgresos - totalRetiros

    setCajaEstado({
      abierta: true,
      turno: turnoRes.data?.nombre || null,
      apertura: data.apertura,
      esperado,
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

    // Obtener turno_id de los cierres involucrados
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
        .select('total')
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

    setResumenMes({ ventas: totalVentas, ingresos, egresos })
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

    // Query separada para nombres de artículos
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

  const fmt = (n: number) => '$' + n.toLocaleString('es-AR', { minimumFractionDigits: 2 })
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
              <p className="text-xs text-orange-600">No se pueden registrar ventas hasta abrir la caja</p>
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

      {/* Ventas del día */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Ventas del día —{' '}
          {new Date().toLocaleDateString('es-AR', {
            weekday: 'long', day: 'numeric', month: 'long',
            timeZone: 'America/Argentina/Buenos_Aires'
          })}
        </h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-gray-400" />
              <p className="text-xs text-gray-500 font-medium">Turno Mañana</p>
            </div>
            <p className="text-2xl font-bold text-[#3c3c3b]">{fmt(ventasManana.total)}</p>
            <p className="text-xs text-gray-400 mt-1">{ventasManana.cantidad} {ventasManana.cantidad === 1 ? 'venta' : 'ventas'}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-gray-400" />
              <p className="text-xs text-gray-500 font-medium">Turno Tarde</p>
            </div>
            <p className="text-2xl font-bold text-[#3c3c3b]">{fmt(ventasTarde.total)}</p>
            <p className="text-xs text-gray-400 mt-1">{ventasTarde.cantidad} {ventasTarde.cantidad === 1 ? 'venta' : 'ventas'}</p>
          </div>
          <div className="bg-[#3c3c3b] rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <ShoppingCart className="w-4 h-4 text-white/70" />
              <p className="text-xs text-white/70 font-medium">Total del día</p>
            </div>
            <p className="text-2xl font-bold text-white">{fmt(ventasDia.total)}</p>
            <p className="text-xs text-white/50 mt-1">{ventasDia.cantidad} {ventasDia.cantidad === 1 ? 'venta' : 'ventas'}</p>
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
          <div className={`rounded-lg border p-4 ${diferenciaMes >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'}`}>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className={`w-4 h-4 ${diferenciaMes >= 0 ? 'text-blue-500' : 'text-orange-500'}`} />
              <p className={`text-xs font-medium ${diferenciaMes >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>Diferencia</p>
            </div>
            <p className={`text-xl font-bold ${diferenciaMes >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
              {diferenciaMes >= 0 ? '+' : ''}{fmt(diferenciaMes)}
            </p>
          </div>
        </div>
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
