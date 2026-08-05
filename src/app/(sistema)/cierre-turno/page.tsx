'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Clock, LogIn, LogOut, AlertCircle, CheckCircle2, Banknote, TrendingUp, TrendingDown, Plus, X } from 'lucide-react'

interface TurnoAbierto {
  id: number
  turno_id: number
  usuario_id: string
  apertura: number
  creado_en: string
  turnos: { nombre: string }
  usuarios: { nombre: string; apellido: string }
}

interface Turno {
  id: number
  nombre: string
}

interface Usuario {
  id: string
  nombre: string
  apellido: string
}

interface VentaEfectivo {
  numero_venta: number
  total_efectivo: number
  fecha_utc: string
  concepto?: string
}

interface MovimientoEgreso {
  id: number
  concepto: string
  monto: number
  fecha_utc: string
}

interface RetiroCaja {
  id: number
  monto: number
  concepto: string | null
  fecha_utc: string
}

interface HistorialCierre {
  id: number
  fecha: string
  creado_en: string
  cerrado_en: string | null
  apertura: number
  apertura_contada: number | null
  diferencia_apertura: number | null
  ingresos_sistema: number | null
  egresos_sistema: number | null
  efectivo_real: number | null
  diferencia: number | null
  estado_cierre_turno_id: number
  turnos: { nombre: string } | null
  usuarios: { nombre: string; apellido: string } | null
}

type Vista = 'principal' | 'abrir' | 'cerrar' | 'retiro' | 'historial' | 'reapertura'

export default function CierreTurnoPage() {
  const supabase = createClient()
  const router = useRouter()

  const [vista, setVista] = useState<Vista>('principal')
  const [turnoAbierto, setTurnoAbierto] = useState<TurnoAbierto | null>(null)
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [usuarioId, setUsuarioId] = useState<string | null>(null)
  const [sucursalId] = useState(1) // Cinco Saltos
  const [avisoBorradores, setAvisoBorradores] = useState<number | null>(null) // cantidad pendiente, null = sin aviso

  // Datos del turno abierto
  const [ventasEfectivo, setVentasEfectivo] = useState<VentaEfectivo[]>([])
  const [ingresosEfectivo, setIngresosEfectivo] = useState<VentaEfectivo[]>([])
  const [egresosEfectivo, setEgresosEfectivo] = useState<MovimientoEgreso[]>([])
  const [retiros, setRetiros] = useState<RetiroCaja[]>([])

  // Formulario abrir turno
  const [turnoSeleccionado, setTurnoSeleccionado] = useState<string>('')
  const [aperturaConfirmada, setAperturaConfirmada] = useState<string>('')

  // Formulario cierre
  const [efectivoContado, setEfectivoContado] = useState<string>('')
  const [observacionesCierre, setObservacionesCierre] = useState<string>('')

  // Formulario retiro
  const [montoRetiro, setMontoRetiro] = useState<string>('')
  const [receptorRetiro, setReceptorRetiro] = useState<string>('')

  const efectivoRef = useRef<HTMLInputElement>(null)
  const retiroRef = useRef<HTMLInputElement>(null)

  const [ultimaApertura, setUltimaApertura] = useState<number>(0)
  const [ultimoCierreId, setUltimoCierreId] = useState<number | null>(null)
  const [motivoReapertura, setMotivoReapertura] = useState<string>('')

  // Historial de cajas (todas, abiertas y cerradas)
  const [historialCierres, setHistorialCierres] = useState<HistorialCierre[]>([])
  const [loadingHistorial, setLoadingHistorial] = useState(true)

  useEffect(() => {
    inicializar()
  }, [])

  useEffect(() => {
    if (vista === 'cerrar') setTimeout(() => efectivoRef.current?.focus(), 100)
    if (vista === 'retiro') {
      setTimeout(() => retiroRef.current?.focus(), 100)
      // Default: usuario logueado
      if (!receptorRetiro && usuarioId) setReceptorRetiro(usuarioId)
    }
  }, [vista])

  async function inicializar() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setUsuarioId(user.id)

      const { data: turnosData } = await supabase
        .from('turnos')
        .select('id, nombre')
        .order('id')
      setTurnos(turnosData || [])

      const { data: usuariosData } = await supabase
        .from('usuarios')
        .select('id, nombre, apellido')
        .eq('estado_usuario_id', 1)
        .order('nombre')
      setUsuarios((usuariosData as any[]) || [])

      await cargarTurnoAbierto()

      // Cargar último cierre confirmado para mostrar apertura esperada
      const { data: ultimoCierre } = await supabase
        .from('cierres_turno')
        .select('id, efectivo_real')
        .eq('sucursal_id', sucursalId)
        .neq('estado_cierre_turno_id', 1)
        .not('efectivo_real', 'is', null)
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle()

      setUltimaApertura(ultimoCierre?.efectivo_real ?? 0)
      setUltimoCierreId(ultimoCierre?.id ?? null)

      await cargarHistorialCierres()
    } finally {
      setLoading(false)
    }
  }

  async function cargarHistorialCierres() {
    setLoadingHistorial(true)
    try {
      const { data } = await supabase
        .from('cierres_turno')
        .select(`
          id, fecha, creado_en, cerrado_en, apertura, apertura_contada, diferencia_apertura,
          ingresos_sistema, egresos_sistema, efectivo_real, diferencia, estado_cierre_turno_id,
          turnos ( nombre ),
          usuarios ( nombre, apellido )
        `)
        .eq('sucursal_id', sucursalId)
        .order('creado_en', { ascending: false })
        .limit(30)

      setHistorialCierres((data as any[]) || [])
    } finally {
      setLoadingHistorial(false)
    }
  }

  async function cargarTurnoAbierto() {
    const { data } = await supabase
      .from('cierres_turno')
      .select(`
        id, turno_id, usuario_id, apertura, creado_en,
        turnos ( nombre ),
        usuarios ( nombre, apellido )
      `)
      .eq('sucursal_id', sucursalId)
      .eq('estado_cierre_turno_id', 1)
      .maybeSingle()

    setTurnoAbierto(data as any || null)

    if (data) {
      await cargarDetallesTurno(data.creado_en)
      await cargarRetirosTurno(data.id)
    } else {
      setVentasEfectivo([])
      setIngresosEfectivo([])
      setEgresosEfectivo([])
      setRetiros([])
    }
  }

  async function cargarRetirosTurno(cierreTurnoId: number) {
    const { data } = await supabase
      .from('retiros_caja')
      .select('id, monto, concepto, fecha_utc')
      .eq('cierre_turno_id', cierreTurnoId)
      .order('fecha_utc', { ascending: true })
    setRetiros((data as any[]) || [])
  }

  async function cargarDetallesTurno(fechaApertura: string) {
    setVentasEfectivo([])
    setIngresosEfectivo([])
    setEgresosEfectivo([])

    const { data: pagosData } = await supabase
      .from('venta_pagos')
      .select(`monto, ventas!inner ( numero_venta, fecha_utc, estado_venta_id, sucursal_id, creado_en )`)
      .eq('medio_pago_id', 1)
      .eq('ventas.sucursal_id', sucursalId)
      .neq('ventas.estado_venta_id', 3)
      .gte('ventas.creado_en', fechaApertura)

    if (pagosData) {
      setVentasEfectivo((pagosData as any[]).map(p => ({
        numero_venta: p.ventas.numero_venta,
        total_efectivo: p.monto,
        // fecha_utc de ventas es tipo DATE (sin hora) — para mostrar la hora
        // real hay que usar creado_en (TIMESTAMPTZ), igual que ya hacen
        // egresos/ingresos más abajo.
        fecha_utc: p.ventas.creado_en,
      })))
    }

    const { data: egresosData } = await supabase
      .from('movimientos')
      .select(`id, monto, fecha_utc, creado_en, conceptos_gasto ( nombre )`)
      .eq('sucursal_id', sucursalId)
      .eq('tipo', 'Egreso')
      .eq('medio_pago_id', 1)
      .eq('anulado', false)
      .gte('creado_en', fechaApertura)
      .order('creado_en', { ascending: true })

    if (egresosData) {
      setEgresosEfectivo((egresosData as any[]).map(e => ({
        id: e.id,
        concepto: e.conceptos_gasto?.nombre || 'Egreso',
        monto: e.monto,
        fecha_utc: e.creado_en,
      })))
    }

    const { data: ingresosData } = await supabase
      .from('movimientos')
      .select(`id, monto, fecha_utc, creado_en, origen_tipo, conceptos_gasto ( nombre )`)
      .eq('sucursal_id', sucursalId)
      .eq('tipo', 'Ingreso')
      .eq('medio_pago_id', 1)
      .eq('anulado', false)
      .gte('creado_en', fechaApertura)
      .order('creado_en', { ascending: true })

    if (ingresosData) {
      // Excluir movimientos que ya provienen de una venta (ya están contados en "Ventas efectivo"
      // vía venta_pagos). Acá solo deben quedar ingresos de caja que NO sean ventas.
      const ingresosSinVenta = (ingresosData as any[]).filter(m => m.origen_tipo !== 'venta')
      setIngresosEfectivo(ingresosSinVenta.map(m => ({
        numero_venta: 0,
        total_efectivo: m.monto,
        fecha_utc: m.creado_en,
        concepto: m.conceptos_gasto?.nombre || 'Ingreso',
      })))
    }
  }

  async function abrirTurno() {
    if (!turnoSeleccionado || !usuarioId) return
    const montoConfirmado = parseMonto(aperturaConfirmada)
    if (isNaN(montoConfirmado) || montoConfirmado < 0) {
      setError('Ingresá el efectivo contado en caja')
      return
    }
    setProcesando(true)
    setError(null)
    try {
      const { data: cierreId, error: err } = await supabase.rpc('abrir_turno', {
        p_sucursal_id: sucursalId,
        p_turno_id: parseInt(turnoSeleccionado),
        p_usuario_id: usuarioId,
      })
      if (err) throw err

      // Guardar apertura confirmada + diferencia de apertura
      if (cierreId) {
        await supabase
          .from('cierres_turno')
          .update({
            apertura: montoConfirmado,
            apertura_contada: montoConfirmado,
            diferencia_apertura: montoConfirmado - ultimaApertura,
          })
          .eq('id', cierreId)
      }

      setAperturaConfirmada('')
      await cargarTurnoAbierto()
      await cargarHistorialCierres()
      setVista('principal')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setProcesando(false)
    }
  }

  // Chequea si hay ventas en borrador de este turno antes de cerrar. Si hay,
  // muestra el aviso en vez de cerrar directo — el cierre real queda en
  // ejecutarCierre().
  async function iniciarCierre() {
    if (!turnoAbierto || !efectivoContado) return
    const monto = parseFloat(efectivoContado.replace(/\./g, '').replace(',', '.'))
    if (isNaN(monto) || monto < 0) {
      setError('Ingresá un monto válido')
      return
    }
    setError(null)

    const { count } = await supabase
      .from('ventas_borrador')
      .select('id', { count: 'exact', head: true })
      .eq('cierre_turno_id', turnoAbierto.id)

    if (count && count > 0) {
      setAvisoBorradores(count)
      return
    }
    await ejecutarCierre()
  }

  async function ejecutarCierre(eliminarBorradores = false) {
    if (!turnoAbierto || !efectivoContado) return
    const monto = parseFloat(efectivoContado.replace(/\./g, '').replace(',', '.'))
    if (isNaN(monto) || monto < 0) {
      setError('Ingresá un monto válido')
      return
    }
    setProcesando(true)
    setError(null)
    try {
      if (eliminarBorradores) {
        await supabase.from('ventas_borrador').delete().eq('cierre_turno_id', turnoAbierto.id)
      }
      const { error: err } = await supabase.rpc('cerrar_turno', {
        p_cierre_id: turnoAbierto.id,
        p_efectivo_real: monto,
        p_observaciones: observacionesCierre || null,
      })
      if (err) throw err
      setAvisoBorradores(null)
      setTurnoAbierto(null)
      setVentasEfectivo([])
      setEgresosEfectivo([])
      setRetiros([])
      setEfectivoContado('')
      setObservacionesCierre('')
      await cargarHistorialCierres()
      setVista('principal')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setProcesando(false)
    }
  }

  async function reabrirCaja() {
    if (!motivoReapertura.trim()) {
      setError('El motivo de reapertura es obligatorio')
      return
    }
    setProcesando(true)
    setError(null)
    try {
      const { error: err } = await supabase.rpc('reabrir_ultimo_cierre', {
        p_sucursal_id: sucursalId,
        p_usuario_id: usuarioId,
        p_motivo: motivoReapertura.trim(),
      })
      if (err) throw err
      setMotivoReapertura('')
      setVista('principal')
      await inicializar()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setProcesando(false)
    }
  }

  async function registrarRetiro() {
    if (!usuarioId || !montoRetiro || !turnoAbierto) return
    const monto = parseMonto(montoRetiro)
    if (isNaN(monto) || monto <= 0) {
      setError('Ingresá un monto válido')
      return
    }
    if (monto > esperadoEnCaja) {
      setError(`El monto supera el efectivo esperado en caja (${fmt(esperadoEnCaja)})`)
      return
    }
    if (!receptorRetiro) {
      setError('Seleccioná quién recibe el dinero')
      return
    }
    const receptor = usuarios.find(u => u.id === receptorRetiro)
    const concepto = receptor ? `${receptor.nombre} ${receptor.apellido}` : ''
    setProcesando(true)
    setError(null)
    try {
      const { error: err } = await supabase.rpc('registrar_retiro_caja', {
        p_cierre_turno_id: turnoAbierto.id,
        p_monto: parseMonto(montoRetiro),
        p_usuario_id: usuarioId,
        p_concepto: concepto,
      })
      if (err) throw err
      setMontoRetiro('')
      setReceptorRetiro('')
      setVista('principal')
      await cargarRetirosTurno(turnoAbierto.id)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setProcesando(false)
    }
  }

  // Cálculos
  const totalVentasEfectivo = ventasEfectivo.reduce((s, v) => s + v.total_efectivo, 0)
  const totalIngresosEfectivo = ingresosEfectivo.reduce((s, v) => s + v.total_efectivo, 0)
  const totalEgresos = egresosEfectivo.reduce((s, e) => s + e.monto, 0)
  const totalRetiros = retiros.reduce((s, r) => s + r.monto, 0)
  const apertura = turnoAbierto?.apertura ?? 0
  const esperadoEnCaja = apertura + totalVentasEfectivo + totalIngresosEfectivo - totalEgresos - totalRetiros
  const efectivoNum = parseFloat(efectivoContado.replace(/\./g, '').replace(',', '.')) || 0
  const diferencia = efectivoNum - esperadoEnCaja

  const fmt = (n: number) => '$' + n.toLocaleString('es-AR', { minimumFractionDigits: 2 })
  const fmtFecha = (s: string) => new Date(s).toLocaleTimeString('es-AR', { 
    hour: '2-digit', 
    minute: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires'
  })

  function handleMontoRetiro(raw: string) {
    // Solo dígitos
    const soloDigitos = raw.replace(/\D/g, '')
    if (!soloDigitos) { setMontoRetiro(''); return }
    // Formatear con puntos de miles
    const num = parseInt(soloDigitos, 10)
    setMontoRetiro(num.toLocaleString('es-AR'))
  }

  function parseMonto(s: string): number {
    return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0
  }

  if (loading) return <p className="text-sm text-gray-500">Cargando...</p>

  // ── VISTA: ABRIR TURNO ────────────────────────────────────────
  if (vista === 'abrir') {
    return (
      <div className="max-w-md mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => { setVista('principal'); setError(null) }}
            className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-semibold text-[#3c3c3b]">Abrir caja</h1>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Turno</label>
            <select
              value={turnoSeleccionado}
              onChange={e => setTurnoSeleccionado(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]"
            >
              <option value="">Seleccioná el turno</option>
              {turnos.map(t => (
                <option key={t.id} value={t.id}>{t.nombre}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Verificación de apertura</label>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-sm text-gray-600">Esperado (cierre anterior)</span>
                <span className="font-medium text-gray-800">{fmt(ultimaApertura)}</span>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Efectivo contado físicamente</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={aperturaConfirmada}
                  onChange={e => {
                    const soloDigitos = e.target.value.replace(/\D/g, '')
                    if (!soloDigitos) { setAperturaConfirmada(''); return }
                    setAperturaConfirmada(parseInt(soloDigitos, 10).toLocaleString('es-AR'))
                  }}
                  onKeyDown={e => e.key === 'Enter' && abrirTurno()}
                  placeholder="0"
                  className="w-full px-4 py-3 border-2 border-[#00a19a] rounded-lg text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-[#00a19a]/30 text-right"
                />
              </div>

              {aperturaConfirmada && (() => {
                const contado = parseMonto(aperturaConfirmada)
                const diff = contado - ultimaApertura
                return (
                  <div className={`flex items-center justify-between p-3 rounded-lg border ${
                    Math.abs(diff) < 0.01
                      ? 'bg-green-50 border-green-200'
                      : diff > 0
                      ? 'bg-blue-50 border-blue-200'
                      : 'bg-red-50 border-red-200'
                  }`}>
                    <span className={`text-sm font-medium ${
                      Math.abs(diff) < 0.01 ? 'text-green-700' : diff > 0 ? 'text-blue-700' : 'text-red-700'
                    }`}>
                      {Math.abs(diff) < 0.01 ? '✓ Caja cuadrada' : diff > 0 ? 'Sobrante' : 'Faltante'}
                    </span>
                    {Math.abs(diff) >= 0.01 && (
                      <span className={`text-sm font-bold ${diff > 0 ? 'text-blue-700' : 'text-red-700'}`}>
                        {diff > 0 ? '+' : ''}{fmt(diff)}
                      </span>
                    )}
                  </div>
                )
              })()}
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <button
            onClick={abrirTurno}
            disabled={!turnoSeleccionado || !aperturaConfirmada || procesando}
            className="w-full bg-[#00a19a] text-white py-2.5 rounded font-medium text-sm hover:bg-[#008f89] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            <LogIn className="w-4 h-4" />
            {procesando ? 'Abriendo...' : 'Abrir caja'}
          </button>
        </div>
      </div>
    )
  }

  // ── VISTA: CERRAR TURNO ───────────────────────────────────────
  if (vista === 'cerrar') {
    return (
      <>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => { setVista('principal'); setError(null) }}
            className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-semibold text-[#3c3c3b]">Cerrar turno</h1>
        </div>

        <div className="space-y-4">
          {/* Resumen del turno */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Movimientos de efectivo</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">Apertura</span>
                <span className="font-medium text-gray-800">{fmt(apertura)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-green-600">+ Ventas efectivo</span>
                <span className="font-medium text-green-700">{fmt(totalVentasEfectivo)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-red-600">− Egresos efectivo</span>
                <span className="font-medium text-red-700">{fmt(totalEgresos)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-red-600">− Retiros de caja</span>
                <span className="font-medium text-red-700">{fmt(totalRetiros)}</span>
              </div>
            </div>
            <div className="flex justify-between py-2 mt-1">
              <span className="font-semibold text-gray-800">Esperado en caja</span>
              <span className="font-bold text-[#3c3c3b] text-lg">{fmt(esperadoEnCaja)}</span>
            </div>
          </div>

          {/* Campo efectivo contado */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Efectivo contado físicamente
            </label>
            <input
              ref={efectivoRef}
              type="text"
              inputMode="numeric"
              value={efectivoContado}
              onChange={e => {
                const soloDigitos = e.target.value.replace(/\D/g, '')
                if (!soloDigitos) { setEfectivoContado(''); return }
                setEfectivoContado(parseInt(soloDigitos, 10).toLocaleString('es-AR'))
              }}
              onKeyDown={e => e.key === 'Enter' && iniciarCierre()}
              placeholder="0"
              className="w-full px-4 py-3 border-2 border-[#00a19a] rounded-lg text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-[#00a19a]/30 text-right"
            />

            {efectivoContado && (
              <div className={`mt-3 flex items-center justify-between p-3 rounded-lg border ${
                Math.abs(diferencia) < 0.01
                  ? 'bg-green-50 border-green-200'
                  : diferencia > 0
                  ? 'bg-blue-50 border-blue-200'
                  : 'bg-red-50 border-red-200'
              }`}>
                <span className={`text-sm font-medium ${
                  Math.abs(diferencia) < 0.01 ? 'text-green-700' : diferencia > 0 ? 'text-blue-700' : 'text-red-700'
                }`}>
                  {Math.abs(diferencia) < 0.01
                    ? '✓ Caja cuadrada'
                    : diferencia > 0
                    ? `Sobrante: +${fmt(diferencia)}`
                    : `Faltante: ${fmt(diferencia)}`}
                </span>
                <span className={`text-sm font-bold ${
                  Math.abs(diferencia) < 0.01 ? 'text-green-700' : diferencia > 0 ? 'text-blue-700' : 'text-red-700'
                }`}>
                  {Math.abs(diferencia) < 0.01 ? '' : fmt(Math.abs(diferencia))}
                </span>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Observaciones <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <textarea
              value={observacionesCierre}
              onChange={e => setObservacionesCierre(e.target.value)}
              rows={2}
              placeholder="Notas del cierre..."
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a] resize-none"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <button
            onClick={iniciarCierre}
            disabled={!efectivoContado || procesando}
            className="w-full bg-[#3c3c3b] text-white py-3 rounded-lg font-semibold text-sm hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            {procesando ? 'Cerrando turno...' : 'Confirmar cierre de turno'}
          </button>
        </div>
      </div>

      {avisoBorradores !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg border border-gray-200 w-full max-w-md">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-base font-semibold text-[#3c3c3b] flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-500" />
                {avisoBorradores} {avisoBorradores === 1 ? 'venta en borrador' : 'ventas en borrador'} sin terminar
              </h2>
            </div>
            <div className="p-4 space-y-3 text-sm text-gray-600">
              <p>
                Hay {avisoBorradores === 1 ? 'una venta guardada como borrador' : `${avisoBorradores} ventas guardadas como borrador`} en
                este turno que todavía no se cobraron.
              </p>
              <p className="text-xs text-gray-400">
                Ojo: si cerrás la caja y las dejás, van a quedar guardadas en la base pero <strong>no van a volver a aparecer</strong> en
                la lista de Borradores de Ventas (esa lista solo muestra las del turno que está abierto en ese momento) —
                quedarían ahí sin forma fácil de recuperarlas desde la pantalla. Lo más prolijo es volver a Ventas y
                terminarlas o eliminarlas antes de cerrar.
              </p>
            </div>
            <div className="flex flex-col gap-2 p-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => { setAvisoBorradores(null); router.push('/ventas') }}
                className="px-4 py-2 bg-[#00a19a] text-white rounded text-sm hover:bg-[#008f89]"
              >
                Volver a Ventas para revisarlas
              </button>
              <button
                type="button"
                onClick={() => ejecutarCierre(true)}
                disabled={procesando}
                className="px-4 py-2 border border-red-300 text-red-600 rounded text-sm hover:bg-red-50 disabled:opacity-50"
              >
                {procesando ? 'Cerrando...' : `Eliminar ${avisoBorradores === 1 ? 'el borrador' : 'los borradores'} y cerrar caja`}
              </button>
              <button
                type="button"
                onClick={() => ejecutarCierre(false)}
                disabled={procesando}
                className="px-4 py-2 text-gray-500 rounded text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                Cerrar igual y dejarlos (no recomendado)
              </button>
              <button
                type="button"
                onClick={() => setAvisoBorradores(null)}
                className="px-4 py-2 text-gray-400 rounded text-xs hover:bg-gray-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
    )
  }

  // ── VISTA: RETIRO DE CAJA ─────────────────────────────────────
  if (vista === 'retiro') {
    return (
      <div className="max-w-md mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => { setVista('principal'); setError(null) }}
            className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-semibold text-[#3c3c3b]">Retiro de caja</h1>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-5">
          {turnoAbierto && (
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <p className="text-xs text-gray-500 mb-0.5">Responsable del turno</p>
              <p className="text-sm font-medium text-[#3c3c3b]">
                {(turnoAbierto.usuarios as any)?.nombre} {(turnoAbierto.usuarios as any)?.apellido}
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Monto a retirar</label>
            <input
              ref={retiroRef}
              type="text"
              inputMode="numeric"
              value={montoRetiro}
              onChange={e => handleMontoRetiro(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && registrarRetiro()}
              placeholder="0"
              className="w-full px-4 py-3 border-2 border-[#00a19a] rounded-lg text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-[#00a19a]/30 text-right"
            />
            <p className="text-xs text-gray-400 mt-1 text-right">
              Disponible en caja: {fmt(esperadoEnCaja)}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Entregado a <span className="text-red-400">*</span>
            </label>
            <select
              value={receptorRetiro}
              onChange={e => setReceptorRetiro(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]"
            >
              <option value="">Seleccioná quién recibe el dinero</option>
              {usuarios.map(u => (
                <option key={u.id} value={u.id}>{u.nombre} {u.apellido}</option>
              ))}
            </select>
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <button
            onClick={registrarRetiro}
            disabled={!montoRetiro || !receptorRetiro || procesando}
            className="w-full bg-[#00a19a] text-white py-2.5 rounded font-medium text-sm hover:bg-[#008f89] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {procesando ? 'Registrando...' : 'Registrar retiro'}
          </button>
        </div>
      </div>
    )
  }


  if (vista === 'reapertura') {
    return (
      <div className="max-w-md mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => { setVista('principal'); setError(null); setMotivoReapertura('') }}
            className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-semibold text-[#3c3c3b]">Reabrir última caja</h1>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-5">
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <p className="text-sm text-orange-800 font-medium mb-1">⚠️ Acción de auditoría</p>
            <p className="text-sm text-orange-700">Esta acción reabre la última caja cerrada y queda registrada con fecha, hora y motivo.</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Motivo de reapertura <span className="text-red-400">*</span>
            </label>
            <textarea
              value={motivoReapertura}
              onChange={e => setMotivoReapertura(e.target.value)}
              rows={3}
              placeholder="Describí el motivo por el que necesitás reabrir la caja..."
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a] resize-none"
              autoFocus
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <button
            onClick={reabrirCaja}
            disabled={!motivoReapertura.trim() || procesando}
            className="w-full bg-orange-500 text-white py-2.5 rounded font-medium text-sm hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {procesando ? 'Reabriendo...' : 'Confirmar reapertura'}
          </button>
        </div>
      </div>
    )
  }

  // ── VISTA PRINCIPAL ───────────────────────────────────────────
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-[#3c3c3b]">Caja</h1>
        {turnoAbierto && (
          <button
            onClick={() => { setError(null); setVista('retiro') }}
            className="border border-gray-300 text-gray-700 px-4 py-2 rounded text-sm hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <Banknote className="w-4 h-4" />
            Retiro de caja
          </button>
        )}
      </div>

      {/* Sin turno abierto */}
      {!turnoAbierto && (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="w-7 h-7 text-gray-400" />
          </div>
          <h2 className="text-base font-semibold text-[#3c3c3b] mb-1">No hay caja abierta</h2>
          <p className="text-sm text-gray-500 mb-6">Abrí la caja para comenzar a registrar ventas del día.</p>
          <div className="flex flex-col items-center gap-3">
            <button
              onClick={() => { setError(null); setVista('abrir') }}
              className="bg-[#00a19a] text-white px-6 py-2.5 rounded font-medium text-sm hover:bg-[#008f89] transition-colors flex items-center gap-2"
            >
              <LogIn className="w-4 h-4" />
              Abrir caja
            </button>
            {ultimoCierreId && (
              <button
                onClick={() => { setError(null); setMotivoReapertura(''); setVista('reapertura') }}
                disabled={procesando}
                className="border border-gray-300 text-gray-600 px-6 py-2 rounded text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Reabrir última caja
              </button>
            )}
          </div>
        </div>
      )}

      {/* Con turno abierto */}
      {turnoAbierto && (
        <div className="space-y-4">
          {/* Info turno */}
          <div className="bg-[#00a19a]/10 border border-[#00a19a]/30 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-[#00a19a] animate-pulse" />
              <div>
                <p className="font-semibold text-[#3c3c3b] text-sm">
                  Turno {(turnoAbierto.turnos as any)?.nombre} abierto
                </p>
                <p className="text-xs text-gray-500">
                  Desde las {fmtFecha(turnoAbierto.creado_en)} •{' '}
                  {(turnoAbierto.usuarios as any)?.nombre} {(turnoAbierto.usuarios as any)?.apellido}
                </p>
              </div>
            </div>
            <span className="text-xs bg-[#00a19a] text-white px-2.5 py-1 rounded-full font-medium">Activo</span>
          </div>

          {/* Cards resumen */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">Apertura</p>
              <p className="text-lg font-bold text-[#3c3c3b]">{fmt(apertura)}</p>
            </div>
            <div className="bg-green-50 rounded-lg border border-green-200 p-4">
              <div className="flex items-center gap-1 mb-1">
                <TrendingUp className="w-3 h-3 text-green-600" />
                <p className="text-xs text-green-600">Ventas efectivo</p>
              </div>
              <p className="text-lg font-bold text-green-700">{fmt(totalVentasEfectivo)}</p>
              <p className="text-xs text-green-600 mt-0.5">{ventasEfectivo.length} {ventasEfectivo.length === 1 ? 'venta' : 'ventas'}</p>
            </div>
            <div className="bg-green-50 rounded-lg border border-green-200 p-4">
              <div className="flex items-center gap-1 mb-1">
                <TrendingUp className="w-3 h-3 text-green-600" />
                <p className="text-xs text-green-600">Ingresos efectivo</p>
              </div>
              <p className="text-lg font-bold text-green-700">{fmt(totalIngresosEfectivo)}</p>
              <p className="text-xs text-green-600 mt-0.5">{ingresosEfectivo.length} {ingresosEfectivo.length === 1 ? 'ingreso' : 'ingresos'}</p>
            </div>
            <div className="bg-red-50 rounded-lg border border-red-200 p-4">
              <div className="flex items-center gap-1 mb-1">
                <TrendingDown className="w-3 h-3 text-red-600" />
                <p className="text-xs text-red-600">Egresos + Retiros</p>
              </div>
              <p className="text-lg font-bold text-red-700">{fmt(totalEgresos + totalRetiros)}</p>
              <p className="text-xs text-red-600 mt-0.5">{egresosEfectivo.length + retiros.length} registros</p>
            </div>
            <div className="bg-[#3c3c3b] rounded-lg p-4">
              <p className="text-xs text-white/70 mb-1">Esperado en caja</p>
              <p className="text-lg font-bold text-white">{fmt(esperadoEnCaja)}</p>
            </div>
          </div>

          {/* Detalle ventas efectivo */}
          {ventasEfectivo.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Ventas cobradas en efectivo</h2>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-4 py-2 text-xs text-gray-500">N° Venta</th>
                    <th className="text-left px-4 py-2 text-xs text-gray-500">Hora</th>
                    <th className="text-right px-4 py-2 text-xs text-gray-500">Efectivo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {ventasEfectivo.map((v, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-gray-700">#{v.numero_venta}</td>
                      <td className="px-4 py-2 text-gray-500">{fmtFecha(v.fecha_utc)}</td>
                      <td className="px-4 py-2 text-right font-medium text-green-700">{fmt(v.total_efectivo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {ingresosEfectivo.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Ingresos de efectivo</h2>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-4 py-2 text-xs text-gray-500">Concepto</th>
                    <th className="text-left px-4 py-2 text-xs text-gray-500">Hora</th>
                    <th className="text-right px-4 py-2 text-xs text-gray-500">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {ingresosEfectivo.map((v, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-gray-700">{v.concepto}</td>
                      <td className="px-4 py-2 text-gray-500">{fmtFecha(v.fecha_utc)}</td>
                      <td className="px-4 py-2 text-right font-medium text-green-700">{fmt(v.total_efectivo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Detalle egresos + retiros */}
          {(egresosEfectivo.length > 0 || retiros.length > 0) && (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Egresos y retiros de efectivo</h2>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-4 py-2 text-xs text-gray-500">Concepto</th>
                    <th className="text-left px-4 py-2 text-xs text-gray-500">Hora</th>
                    <th className="text-right px-4 py-2 text-xs text-gray-500">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {egresosEfectivo.map(e => (
                    <tr key={`e-${e.id}`} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-gray-700">{e.concepto}</td>
                      <td className="px-4 py-2 text-gray-500">{fmtFecha(e.fecha_utc)}</td>
                      <td className="px-4 py-2 text-right font-medium text-red-700">{fmt(e.monto)}</td>
                    </tr>
                  ))}
                  {retiros.map(r => (
                    <tr key={`r-${r.id}`} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-gray-700">
                        Retiro{r.concepto ? ` → ${r.concepto}` : ''}
                      </td>
                      <td className="px-4 py-2 text-gray-500">{fmtFecha(r.fecha_utc)}</td>
                      <td className="px-4 py-2 text-right font-medium text-red-700">{fmt(r.monto)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Botón cerrar turno */}
          <div className="flex justify-end">
            <button
              onClick={() => { setError(null); setVista('cerrar') }}
              className="bg-[#3c3c3b] text-white px-6 py-2.5 rounded font-medium text-sm hover:bg-black transition-colors flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Cerrar turno
            </button>
          </div>
        </div>
      )}

      {/* Historial de cajas */}
      <div className="mt-6 bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Historial de cajas</h2>
        </div>
        {loadingHistorial ? (
          <p className="text-sm text-gray-400 px-4 py-6 text-center">Cargando...</p>
        ) : historialCierres.length === 0 ? (
          <p className="text-sm text-gray-400 px-4 py-6 text-center">Todavía no hay cajas registradas.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-2 text-xs text-gray-500">Fecha</th>
                  <th className="text-left px-4 py-2 text-xs text-gray-500">Turno</th>
                  <th className="text-left px-4 py-2 text-xs text-gray-500">Responsable</th>
                  <th className="text-left px-4 py-2 text-xs text-gray-500">Apertura</th>
                  <th className="text-left px-4 py-2 text-xs text-gray-500">Cierre</th>
                  <th className="text-right px-4 py-2 text-xs text-gray-500">Dinero apertura</th>
                  <th className="text-right px-4 py-2 text-xs text-gray-500">Ingresos</th>
                  <th className="text-right px-4 py-2 text-xs text-gray-500">Egresos</th>
                  <th className="text-right px-4 py-2 text-xs text-gray-500">Dinero cierre</th>
                  <th className="text-right px-4 py-2 text-xs text-gray-500">Diferencia</th>
                  <th className="text-left px-4 py-2 text-xs text-gray-500">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {historialCierres.map(c => {
                  const abierto = c.estado_cierre_turno_id === 1
                  const diferenciaFinal = c.diferencia ?? 0
                  const cuadrada = c.estado_cierre_turno_id === 2
                  return (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-gray-700">
                        {c.fecha.split('-').reverse().join('/')}
                      </td>
                      <td className="px-4 py-2 text-gray-700">{c.turnos?.nombre ?? '—'}</td>
                      <td className="px-4 py-2 text-gray-700">
                        {c.usuarios ? `${c.usuarios.nombre} ${c.usuarios.apellido}` : '—'}
                      </td>
                      <td className="px-4 py-2 text-gray-500">{fmtFecha(c.creado_en)}</td>
                      <td className="px-4 py-2 text-gray-500">{c.cerrado_en ? fmtFecha(c.cerrado_en) : '—'}</td>
                      <td className="px-4 py-2 text-right text-gray-700">
                        {fmt(c.apertura_contada ?? c.apertura)}
                      </td>
                      <td className="px-4 py-2 text-right text-green-700">
                        {c.ingresos_sistema ? `+${fmt(c.ingresos_sistema)}` : '—'}
                      </td>
                      <td className="px-4 py-2 text-right text-red-700">
                        {c.egresos_sistema ? `-${fmt(c.egresos_sistema)}` : '—'}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-700">
                        {c.efectivo_real !== null ? fmt(c.efectivo_real) : '—'}
                      </td>
                      <td className={`px-4 py-2 text-right font-medium ${
                        abierto ? 'text-gray-400'
                        : cuadrada ? 'text-[#00a19a]'
                        : diferenciaFinal > 0 ? 'text-blue-600' : 'text-red-600'
                      }`}>
                        {abierto ? '—' : `${diferenciaFinal >= 0 ? '+' : ''}${fmt(diferenciaFinal)}`}
                      </td>
                      <td className="px-4 py-2">
                        {abierto ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-[#00a19a] bg-[#00a19a]/10 px-2 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#00a19a] animate-pulse" />
                            Abierta
                          </span>
                        ) : cuadrada ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-[#00a19a] bg-[#00a19a]/10 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3" />
                            Cuadrada
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                            <AlertCircle className="w-3 h-3" />
                            Con diferencia
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
