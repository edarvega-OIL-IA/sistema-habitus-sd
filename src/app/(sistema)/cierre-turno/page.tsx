'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Clock, LogIn, LogOut, AlertCircle, CheckCircle2, Banknote, TrendingUp, TrendingDown, Plus, X, Pencil, Filter } from 'lucide-react'

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

// Franja horaria esperada por turno (con margen — a veces se abre/cierra
// más tarde de lo estricto) — solo dispara un aviso con confirmación,
// nunca bloquea: puede haber una excepción real y no hay que impedirle
// trabajar a nadie por eso. Se agregó el 01/09/2026 después de que una
// caja se abrió como "Tarde" a la mañana por error, mezclando ventas en
// el reporte equivocado.
const RANGOS_TURNO: Record<string, [number, number]> = {
  'Mañana': [8, 14],
  'Tarde': [15, 22],
}

function horaActualArgentina(): number {
  const hora = new Date().toLocaleString('en-US', {
    timeZone: 'America/Argentina/Buenos_Aires',
    hour: 'numeric',
    hour12: false,
  })
  return parseInt(hora, 10)
}

// true si la hora actual cae FUERA de la franja esperada para ese turno.
// Si el nombre no matchea ninguna franja conocida, no avisa (evita romper
// si en algún momento se agrega un tercer turno sin actualizar esto).
function horarioInusualPara(nombreTurno: string | undefined): [boolean, [number, number] | null] {
  if (!nombreTurno) return [false, null]
  const rango = RANGOS_TURNO[nombreTurno]
  if (!rango) return [false, null]
  const hora = horaActualArgentina()
  return [hora < rango[0] || hora >= rango[1], rango]
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
  observaciones?: string | null
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

type Vista = 'principal' | 'abrir' | 'cerrar' | 'retiro' | 'historial' | 'reapertura' | 'corregir'

// Día de la semana abreviado (3 letras) para la columna Fecha del historial.
// `fecha` viene como DATE 'YYYY-MM-DD'; se calcula con UTC para que la zona
// horaria del navegador no corra el día.
const DIAS_SEMANA = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab']

// Los sábados se pintan en gris suave para separar visualmente las semanas.
function esSabado(fecha: string): boolean {
  const [a, m, d] = fecha.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay() === 6
}

function fmtFechaConDia(fecha: string): string {
  const [a, m, d] = fecha.split('-').map(Number)
  const dia = DIAS_SEMANA[new Date(Date.UTC(a, m - 1, d)).getUTCDay()]
  return `${dia} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${a}`
}

// ── Fechas para los filtros del historial (todo como 'YYYY-MM-DD') ──
const PAGINA_HISTORIAL = 30

function fechaISO(d: Date): string {
  return d.toISOString().slice(0, 10)
}

// Hoy según el horario de Argentina (no el del navegador).
function hoyAR(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
}

function sumarDias(fecha: string, n: number): string {
  const [a, m, d] = fecha.split('-').map(Number)
  return fechaISO(new Date(Date.UTC(a, m - 1, d + n)))
}

// La semana empieza el lunes.
function lunesDe(fecha: string): string {
  const [a, m, d] = fecha.split('-').map(Number)
  const diaSemana = new Date(Date.UTC(a, m - 1, d)).getUTCDay() // 0 = domingo
  return sumarDias(fecha, -((diaSemana + 6) % 7))
}

type ModoPeriodo = 'dia' | 'semana' | 'mes' | 'anio' | 'libre' | 'todos'

const MODOS_PERIODO: { modo: ModoPeriodo; label: string }[] = [
  { modo: 'semana', label: 'Semana' },
  { modo: 'mes', label: 'Mes' },
  { modo: 'anio', label: 'Año' },
  { modo: 'libre', label: 'Libre' },
]

// Rango Desde/Hasta de cada modo, a partir de una fecha de referencia (la semana empieza el lunes)
function rangoPeriodo(modo: ModoPeriodo, ref: string): { desde: string; hasta: string } {
  const [y, m] = ref.split('-').map(Number)
  const mm = String(m).padStart(2, '0')
  if (modo === 'dia') return { desde: ref, hasta: ref }
  if (modo === 'semana') { const l = lunesDe(ref); return { desde: l, hasta: sumarDias(l, 6) } }
  if (modo === 'mes') return { desde: `${y}-${mm}-01`, hasta: fechaISO(new Date(Date.UTC(y, m, 0))) }
  if (modo === 'anio') return { desde: `${y}-01-01`, hasta: `${y}-12-31` }
  return { desde: '2026-01-01', hasta: hoyAR() } // todos (el sistema arrancó en 2026)
}

// Avanza (+1) o retrocede (-1) la fecha de referencia según el modo
function moverReferencia(modo: ModoPeriodo, ref: string, dir: number): string {
  const [y, m] = ref.split('-').map(Number)
  if (modo === 'dia') return sumarDias(ref, dir)
  if (modo === 'semana') return sumarDias(ref, 7 * dir)
  if (modo === 'mes') return fechaISO(new Date(Date.UTC(y, m - 1 + dir, 1)))
  if (modo === 'anio') return `${y + dir}-01-01`
  return ref
}

// Texto del botón activo (ej. "lun, 23 nov", "23 nov – 29 nov", "noviembre de 2026", "2026")
function etiquetaPeriodo(modo: ModoPeriodo, ref: string): string {
  const [y, m, d] = ref.split('-').map(Number)
  const f = (fecha: Date, o: Intl.DateTimeFormatOptions) => fecha.toLocaleDateString('es-AR', { ...o, timeZone: 'UTC' })
  const dt = new Date(Date.UTC(y, m - 1, d))
  if (modo === 'dia') return f(dt, { weekday: 'short', day: 'numeric', month: 'short' })
  if (modo === 'semana') {
    const [ly, lm, ld] = lunesDe(ref).split('-').map(Number)
    const lun = new Date(Date.UTC(ly, lm - 1, ld))
    const dom = new Date(Date.UTC(ly, lm - 1, ld + 6))
    return `${f(lun, { day: 'numeric', month: 'short' })} – ${f(dom, { day: 'numeric', month: 'short' })}`
  }
  if (modo === 'mes') return f(dt, { month: 'long', year: 'numeric' })
  if (modo === 'anio') return String(y)
  return ''
}

export default function CierreTurnoPage() {
  const supabase = createClient()
  const router = useRouter()

  const [vista, setVista] = useState<Vista>('principal')
  const [turnoAbierto, setTurnoAbierto] = useState<TurnoAbierto | null>(null)
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  // Ids de quienes alguna vez abrieron una caja (para el filtro Responsable del historial)
  const [idsResponsablesCaja, setIdsResponsablesCaja] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [usuarioId, setUsuarioId] = useState<string | null>(null)
  const [esAdmin, setEsAdmin] = useState(false) // rol_id === 1
  const [sucursalId] = useState(1) // Cinco Saltos
  const [avisoBorradores, setAvisoBorradores] = useState<number | null>(null) // cantidad pendiente, null = sin aviso

  // Datos del turno abierto
  const [ventasEfectivo, setVentasEfectivo] = useState<VentaEfectivo[]>([])
  const [ingresosEfectivo, setIngresosEfectivo] = useState<VentaEfectivo[]>([])
  const [egresosEfectivo, setEgresosEfectivo] = useState<MovimientoEgreso[]>([])


  // Formulario abrir turno
  const [turnoSeleccionado, setTurnoSeleccionado] = useState<string>('')
  const [aperturaConfirmada, setAperturaConfirmada] = useState<string>('')

  // Formulario cierre
  const [efectivoContado, setEfectivoContado] = useState<string>('')
  const [observacionesCierre, setObservacionesCierre] = useState<string>('')

  // Formulario corregir apertura (solo Admin, turno abierto sin movimientos de efectivo)
  const [aperturaCorregida, setAperturaCorregida] = useState<string>('')

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
  const reqHistorialRef = useRef(0) // descarta respuestas viejas si se cambian los filtros rápido
  const [ultimoCierreTurno, setUltimoCierreTurno] = useState<string | null>(null) // nombre del turno del último cierre

  // Filtros del historial — por defecto, la semana actual (lunes a domingo)
  const [modoPeriodo, setModoPeriodo] = useState<ModoPeriodo>('semana')
  const [fechaRef, setFechaRef] = useState<string>(() => hoyAR())
  const [filtroDesde, setFiltroDesde] = useState<string>(() => rangoPeriodo('semana', hoyAR()).desde)
  const [filtroHasta, setFiltroHasta] = useState<string>(() => rangoPeriodo('semana', hoyAR()).hasta)
  const [filtroTurno, setFiltroTurno] = useState<string>('')
  const [filtroResponsable, setFiltroResponsable] = useState<string>('')
  const [soloDiferencia, setSoloDiferencia] = useState(false)
  const [limiteHistorial, setLimiteHistorial] = useState(PAGINA_HISTORIAL)
  const [resumen, setResumen] = useState({ cajas: 0, ingresos: 0, egresos: 0, conDiferencia: 0, sumaDiferencias: 0 })

  useEffect(() => {
    inicializar()
  }, [])

  // El historial se recarga solo cuando cambia algún filtro o "Cargar más"
  useEffect(() => {
    cargarHistorialCierres()
  }, [filtroDesde, filtroHasta, filtroTurno, filtroResponsable, soloDiferencia, limiteHistorial])

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
      if (user) {
        setUsuarioId(user.id)
        const { data: usuarioData } = await supabase
          .from('usuarios').select('rol_id').eq('id', user.id).single()
        setEsAdmin(usuarioData?.rol_id === 1)
      }

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

      const { data: respData } = await supabase
        .from('cierres_turno')
        .select('usuario_id')
        .eq('sucursal_id', sucursalId)
      setIdsResponsablesCaja(new Set((respData || []).map((r: any) => r.usuario_id)))

      await cargarTurnoAbierto()

      // Cargar último cierre confirmado para mostrar apertura esperada
      const { data: ultimoCierre } = await supabase
        .from('cierres_turno')
        .select('id, efectivo_real, turnos ( nombre )')
        .eq('sucursal_id', sucursalId)
        .neq('estado_cierre_turno_id', 1)
        .not('efectivo_real', 'is', null)
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle()

      setUltimaApertura(ultimoCierre?.efectivo_real ?? 0)
      setUltimoCierreId(ultimoCierre?.id ?? null)
      setUltimoCierreTurno((ultimoCierre as any)?.turnos?.nombre ?? null)
    } finally {
      setLoading(false)
    }
  }

  // Aplica los filtros actuales del historial a una consulta de cierres_turno.
  function aplicarFiltrosHistorial(q: any): any {
    q = q.eq('sucursal_id', sucursalId).gte('fecha', filtroDesde).lte('fecha', filtroHasta)
    if (filtroTurno) q = q.eq('turno_id', parseInt(filtroTurno, 10))
    if (filtroResponsable) q = q.eq('usuario_id', filtroResponsable)
    // Estados: 1 = Abierta, 2 = Cuadrada; cualquier otro = Con diferencia
    if (soloDiferencia) q = q.not('estado_cierre_turno_id', 'in', '(1,2)')
    return q
  }

  async function cargarHistorialCierres() {
    const reqId = ++reqHistorialRef.current
    setLoadingHistorial(true)
    try {
      const [lista, totales] = await Promise.all([
        aplicarFiltrosHistorial(
          supabase.from('cierres_turno').select(`
            id, fecha, creado_en, cerrado_en, apertura, apertura_contada, diferencia_apertura,
            ingresos_sistema, egresos_sistema, efectivo_real, diferencia, estado_cierre_turno_id,
            turnos ( nombre ),
            usuarios ( nombre, apellido )
          `)
        )
          .order('creado_en', { ascending: false })
          .range(0, limiteHistorial - 1),
        // Totales sobre TODO el período filtrado (no solo las filas visibles)
        aplicarFiltrosHistorial(
          supabase.from('cierres_turno').select('ingresos_sistema, egresos_sistema, diferencia, estado_cierre_turno_id')
        ),
      ])
      if (reqId !== reqHistorialRef.current) return // llegó una consulta más nueva

      setHistorialCierres((lista.data as any[]) || [])

      const filas = (totales.data as any[]) || []
      const redondear = (n: number) => Math.round(n * 100) / 100
      setResumen({
        cajas: filas.length,
        ingresos: redondear(filas.reduce((s, f) => s + (f.ingresos_sistema ?? 0), 0)),
        egresos: redondear(filas.reduce((s, f) => s + (f.egresos_sistema ?? 0), 0)),
        conDiferencia: filas.filter(f => f.estado_cierre_turno_id !== 1 && f.estado_cierre_turno_id !== 2).length,
        sumaDiferencias: redondear(filas.reduce((s, f) => s + (f.estado_cierre_turno_id === 1 ? 0 : (f.diferencia ?? 0)), 0)),
      })
    } finally {
      if (reqId === reqHistorialRef.current) setLoadingHistorial(false)
    }
  }

  // Cambiar cualquier filtro vuelve a la primera página
  function cambiarFiltro(fn: () => void) {
    fn()
    setLimiteHistorial(PAGINA_HISTORIAL)
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
    } else {
      setVentasEfectivo([])
      setIngresosEfectivo([])
      setEgresosEfectivo([])
    }
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
      .select(`id, monto, fecha_utc, creado_en, observaciones, conceptos_gasto ( nombre )`)
      .eq('sucursal_id', sucursalId)
      .eq('tipo', 'Egreso')
      .eq('medio_pago_id', 1)
      .eq('anulado', false)
      .gte('creado_en', fechaApertura)
      .order('creado_en', { ascending: true })

    if (egresosData) {
      setEgresosEfectivo((egresosData as any[]).map(e => {
        const concepto = e.conceptos_gasto?.nombre || 'Egreso'
        // Un Retiro de caja guarda a quién se le entregó el dinero en
        // `observaciones` — se muestra igual que antes ("Retiro → Fulano").
        return {
          id: e.id,
          concepto: concepto === 'Retiro' && e.observaciones ? `${concepto} → ${e.observaciones}` : concepto,
          monto: e.monto,
          fecha_utc: e.creado_en,
        }
      }))
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

    const turnoElegido = turnos.find(t => t.id === parseInt(turnoSeleccionado))
    const [inusual, rango] = horarioInusualPara(turnoElegido?.nombre)
    if (inusual && rango) {
      const continuar = window.confirm(
        `Estás abriendo el turno ${turnoElegido?.nombre} fuera de su horario habitual (${rango[0]}:00 a ${rango[1]}:00hs).\n\n¿Confirmás que es correcto?`
      )
      if (!continuar) return
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

  // Corrige un error de tipeo en el efectivo contado al abrir. Solo Admin, solo
  // con el turno abierto y mientras no haya movimientos de efectivo (si ya hubo,
  // el esperado en caja ya se construyó sobre ese monto). La diferencia de
  // apertura se recalcula igual que en abrirTurno(): contado - efectivo real
  // del último cierre.
  async function corregirApertura() {
    if (!turnoAbierto || !esAdmin) return
    const nuevo = parseMonto(aperturaCorregida)
    if (!aperturaCorregida || isNaN(nuevo) || nuevo < 0) {
      setError('Ingresá un monto válido')
      return
    }
    if (Math.abs(nuevo - turnoAbierto.apertura) < 0.01) {
      setError('El monto es igual al actual — no hay nada que corregir')
      return
    }
    const ok = window.confirm(
      `¿Corregir la apertura de ${fmt(turnoAbierto.apertura)} a ${fmt(nuevo)}?\n\nLa diferencia de apertura contra el cierre anterior (${fmt(ultimaApertura)}) quedará en ${fmt(nuevo - ultimaApertura)}.`
    )
    if (!ok) return

    setProcesando(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('cierres_turno')
        .update({
          apertura: nuevo,
          apertura_contada: nuevo,
          diferencia_apertura: nuevo - ultimaApertura,
        })
        .eq('id', turnoAbierto.id)
        .eq('estado_cierre_turno_id', 1) // nunca tocar un turno ya cerrado
        .select('id')
      if (err) throw err
      if (!data || data.length === 0) throw new Error('No se pudo actualizar la apertura (turno cerrado o sin permiso)')

      setAperturaCorregida('')
      await cargarTurnoAbierto()
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

    // El nombre del turno a reabrir se guarda al inicializar (no sale del
    // historial, porque ese ahora está filtrado y puede no incluir ese cierre).
    const nombreTurnoAReabrir = ultimoCierreTurno ?? undefined
    const [inusual, rango] = horarioInusualPara(nombreTurnoAReabrir)
    if (inusual && rango) {
      const continuar = window.confirm(
        `Vas a reabrir el turno ${nombreTurnoAReabrir} fuera de su horario habitual (${rango[0]}:00 a ${rango[1]}:00hs).\n\n¿Confirmás que es correcto?`
      )
      if (!continuar) return
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
      await cargarHistorialCierres()
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
      await cargarDetallesTurno(turnoAbierto.creado_en)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setProcesando(false)
    }
  }

  // Cálculos
  const totalVentasEfectivo = ventasEfectivo.reduce((s, v) => s + v.total_efectivo, 0)
  const totalIngresosEfectivo = ingresosEfectivo.reduce((s, v) => s + v.total_efectivo, 0)
  // Incluye los retiros de caja: son movimientos de tipo Egreso, concepto
  // "Retiro" — no se restan aparte para no contarlos dos veces.
  const totalEgresos = egresosEfectivo.reduce((s, e) => s + e.monto, 0)
  const apertura = turnoAbierto?.apertura ?? 0
  const esperadoEnCaja = apertura + totalVentasEfectivo + totalIngresosEfectivo - totalEgresos
  const efectivoNum = parseFloat(efectivoContado.replace(/\./g, '').replace(',', '.')) || 0
  const diferencia = efectivoNum - esperadoEnCaja
  const puedeCorregirApertura =
    esAdmin && !!turnoAbierto &&
    ventasEfectivo.length === 0 && ingresosEfectivo.length === 0 && egresosEfectivo.length === 0

  // Período del historial: elegir modo o moverse con las flechas
  const elegirModo = (modo: ModoPeriodo) => cambiarFiltro(() => {
    setModoPeriodo(modo)
    const r = rangoPeriodo(modo, fechaRef)
    setFiltroDesde(r.desde); setFiltroHasta(r.hasta)
  })
  const moverPeriodo = (dir: number) => cambiarFiltro(() => {
    const ref = moverReferencia(modoPeriodo, fechaRef, dir)
    setFechaRef(ref)
    const r = rangoPeriodo(modoPeriodo, ref)
    setFiltroDesde(r.desde); setFiltroHasta(r.hasta)
  })

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

  // ── VISTA: CORREGIR APERTURA (solo Admin) ─────────────────────
  if (vista === 'corregir') {
    if (!puedeCorregirApertura || !turnoAbierto) {
      return (
        <div className="max-w-md mx-auto">
          <p className="text-sm text-gray-500 mb-4">
            La apertura solo se puede corregir (por un Admin) con el turno abierto y sin movimientos de efectivo.
          </p>
          <button onClick={() => { setVista('principal'); setError(null) }} className="text-sm text-[#00a19a] hover:underline">
            Volver a Caja
          </button>
        </div>
      )
    }
    const nuevoNum = parseMonto(aperturaCorregida)
    const diffNueva = nuevoNum - ultimaApertura
    return (
      <div className="max-w-md mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => { setVista('principal'); setError(null); setAperturaCorregida('') }}
            className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-semibold text-[#3c3c3b]">Corregir apertura</h1>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-5">
          <div className="space-y-2">
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">Apertura actual</span>
              <span className="font-medium text-gray-800">{fmt(turnoAbierto.apertura)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">Esperado (cierre anterior)</span>
              <span className="font-medium text-gray-800">{fmt(ultimaApertura)}</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Efectivo contado correcto</label>
            <input
              type="text"
              inputMode="numeric"
              autoFocus
              value={aperturaCorregida}
              onChange={e => {
                const soloDigitos = e.target.value.replace(/\D/g, '')
                if (!soloDigitos) { setAperturaCorregida(''); return }
                setAperturaCorregida(parseInt(soloDigitos, 10).toLocaleString('es-AR'))
              }}
              onKeyDown={e => e.key === 'Enter' && corregirApertura()}
              placeholder="0"
              className="w-full px-4 py-3 border-2 border-[#00a19a] rounded-lg text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-[#00a19a]/30 text-right"
            />
          </div>

          {aperturaCorregida && (
            <div className={`flex items-center justify-between p-3 rounded-lg border ${
              Math.abs(diffNueva) < 0.01 ? 'bg-green-50 border-green-200' : diffNueva > 0 ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'
            }`}>
              <span className={`text-sm font-medium ${
                Math.abs(diffNueva) < 0.01 ? 'text-green-700' : diffNueva > 0 ? 'text-blue-700' : 'text-red-700'
              }`}>
                {Math.abs(diffNueva) < 0.01 ? '✓ Caja cuadrada' : diffNueva > 0 ? 'Sobrante' : 'Faltante'}
              </span>
              {Math.abs(diffNueva) >= 0.01 && (
                <span className={`text-sm font-bold ${diffNueva > 0 ? 'text-blue-700' : 'text-red-700'}`}>
                  {diffNueva > 0 ? '+' : ''}{fmt(diffNueva)}
                </span>
              )}
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <button
            onClick={corregirApertura}
            disabled={!aperturaCorregida || procesando}
            className="w-full bg-[#00a19a] text-white py-2.5 rounded font-medium text-sm hover:bg-[#008f89] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {procesando ? 'Guardando...' : 'Corregir apertura'}
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
                <span className="text-red-600">− Egresos y retiros de efectivo</span>
                <span className="font-medium text-red-700">{fmt(totalEgresos)}</span>
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
      <h1 className="text-xl font-semibold text-[#3c3c3b] mb-6">Caja</h1>

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
          <div className="bg-[#00a19a]/10 border border-[#00a19a]/30 rounded-lg p-4 flex flex-wrap items-center justify-between gap-3">
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
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs bg-[#00a19a] text-white px-2.5 py-1 rounded-full font-medium mr-1">Activo</span>
              <button
                onClick={() => { setError(null); setVista('retiro') }}
                className="bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded text-sm hover:bg-gray-50 transition-colors flex items-center gap-2"
              >
                <Banknote className="w-4 h-4" />
                Retiro de caja
              </button>
              <button
                onClick={() => { setError(null); setVista('cerrar') }}
                className="bg-[#3c3c3b] text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-black transition-colors flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Cerrar turno
              </button>
            </div>
          </div>

          {/* Cards resumen */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-gray-500">Apertura</p>
                {puedeCorregirApertura && (
                  <button
                    onClick={() => { setError(null); setAperturaCorregida(''); setVista('corregir') }}
                    title="Corregir el efectivo contado al abrir"
                    className="text-xs text-[#00a19a] hover:underline flex items-center gap-1"
                  >
                    <Pencil className="w-3 h-3" />
                    Corregir
                  </button>
                )}
              </div>
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
              <p className="text-lg font-bold text-red-700">{fmt(totalEgresos)}</p>
              <p className="text-xs text-red-600 mt-0.5">{egresosEfectivo.length} registros</p>
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

          {/* Detalle de egresos (incluye retiros de caja) */}
          {egresosEfectivo.length > 0 && (
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
                </tbody>
              </table>
            </div>
          )}

        </div>
      )}

      {/* Filtros del historial — mismo estilo que Registro de ventas */}
      <div className="mt-6 bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-3">
          <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
            <div className="flex items-center gap-2 pb-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <h2 className="text-sm font-semibold text-gray-700">Filtros</h2>
            </div>

            {/* Período: Día / Semana / Mes / Año / Libre / Todos */}
            <div className="flex flex-wrap items-center gap-2 pb-0.5">
              {MODOS_PERIODO.map(({ modo, label }) => {
                const activo = modoPeriodo === modo
                const conFlechas = activo && modo !== 'libre'
                return (
                  <div key={modo} className="flex items-center">
                    {conFlechas && (
                      <button type="button" onClick={() => moverPeriodo(-1)} className="w-7 h-9 flex items-center justify-center rounded-l border border-r-0 border-gray-300 hover:bg-gray-100 text-gray-600 text-sm">‹</button>
                    )}
                    <button
                      type="button"
                      onClick={() => elegirModo(modo)}
                      className={`px-3 py-2 text-sm font-medium border transition-colors ${
                        activo ? 'bg-[#00a19a] text-white border-[#00a19a]' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                      } ${conFlechas ? '' : 'rounded'}`}
                    >
                      {conFlechas ? etiquetaPeriodo(modo, fechaRef) : label}
                    </button>
                    {conFlechas && (
                      <button type="button" onClick={() => moverPeriodo(1)} className="w-7 h-9 flex items-center justify-center rounded-r border border-l-0 border-gray-300 hover:bg-gray-100 text-gray-600 text-sm">›</button>
                    )}
                  </div>
                )
              })}
              <button
                type="button"
                onClick={() => elegirModo('todos')}
                className={`px-3 py-2 text-sm font-medium border rounded transition-colors ${
                  modoPeriodo === 'todos' ? 'bg-[#00a19a] text-white border-[#00a19a]' : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50'
                }`}
              >
                Todos
              </button>
            </div>

            {/* Fechas */}
            <div className="flex items-center gap-2 pb-0.5">
              <input
                type="date"
                value={filtroDesde}
                onChange={e => e.target.value && cambiarFiltro(() => { setModoPeriodo('libre'); setFiltroDesde(e.target.value) })}
                className="px-2 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]"
              />
              <span className="text-gray-400 text-sm">—</span>
              <input
                type="date"
                value={filtroHasta}
                onChange={e => e.target.value && cambiarFiltro(() => { setModoPeriodo('libre'); setFiltroHasta(e.target.value) })}
                className="px-2 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]"
              />
            </div>

            {/* Turno y Responsable */}
            <div className="flex items-end gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Turno</label>
                <select
                  value={filtroTurno}
                  onChange={e => cambiarFiltro(() => setFiltroTurno(e.target.value))}
                  className="w-36 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]"
                >
                  <option value="">Todos</option>
                  {turnos.map(t => (
                    <option key={t.id} value={t.id}>{t.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Responsable</label>
                <select
                  value={filtroResponsable}
                  onChange={e => cambiarFiltro(() => setFiltroResponsable(e.target.value))}
                  className="w-48 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]"
                >
                  <option value="">Todos</option>
                  {usuarios.filter(u => idsResponsablesCaja.has(u.id)).map(u => (
                    <option key={u.id} value={u.id}>{u.nombre} {u.apellido}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none pb-2">
            <input
              type="checkbox"
              checked={soloDiferencia}
              onChange={e => cambiarFiltro(() => setSoloDiferencia(e.target.checked))}
              className="w-4 h-4 accent-[#00a19a]"
            />
            Solo con diferencia
          </label>
        </div>
      </div>

      {/* Totales del período filtrado */}
      <div className="mt-4 bg-white rounded-lg border border-gray-200 p-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1">Cajas</p>
            <p className="text-lg font-bold text-[#3c3c3b]">{resumen.cajas}</p>
          </div>
          <div className="bg-green-50 rounded-lg border border-green-200 p-4">
            <p className="text-xs text-green-600 mb-1">Ingresos</p>
            <p className="text-lg font-bold text-green-700">{fmt(resumen.ingresos)}</p>
          </div>
          <div className="bg-red-50 rounded-lg border border-red-200 p-4">
            <p className="text-xs text-red-600 mb-1">Egresos</p>
            <p className="text-lg font-bold text-red-700">{fmt(resumen.egresos)}</p>
          </div>
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1">Con diferencia</p>
            <p className="text-lg font-bold text-[#3c3c3b]">{resumen.conDiferencia}</p>
          </div>
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1">Suma de diferencias</p>
            <p className={`text-lg font-bold ${
              Math.abs(resumen.sumaDiferencias) < 0.01 ? 'text-[#00a19a]'
              : resumen.sumaDiferencias > 0 ? 'text-blue-600' : 'text-red-600'
            }`}>
              {resumen.sumaDiferencias >= 0 ? '+' : ''}{fmt(resumen.sumaDiferencias)}
            </p>
          </div>
        </div>
      </div>

      {/* Detalle: historial de cajas */}
      <div className="mt-4 bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Historial de cajas</h2>
        </div>

        {loadingHistorial && historialCierres.length === 0 ? (
          <p className="text-sm text-gray-400 px-4 py-6 text-center">Cargando...</p>
        ) : historialCierres.length === 0 ? (
          <p className="text-sm text-gray-400 px-4 py-6 text-center">No hay cajas para los filtros elegidos.</p>
        ) : (
          <>
          <div className={`overflow-x-auto transition-opacity ${loadingHistorial ? 'opacity-60' : ''}`}>
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
                    <tr key={c.id} className={esSabado(c.fecha) ? 'bg-gray-100 hover:bg-gray-200/70' : 'hover:bg-gray-50'}>
                      <td className="px-4 py-2 text-gray-700">
                        {fmtFechaConDia(c.fecha)}
                      </td>
                      <td className="px-4 py-2 text-gray-700">{c.turnos?.nombre ?? '—'}</td>
                      <td className="px-4 py-2 text-gray-700">
                        {c.usuarios ? `${c.usuarios.nombre} ${c.usuarios.apellido}` : '—'}
                      </td>
                      <td className="px-4 py-2 text-gray-500">{fmtFecha(c.creado_en)}</td>
                      <td className="px-4 py-2 text-gray-500">{abierto ? '—' : (c.cerrado_en ? fmtFecha(c.cerrado_en) : '—')}</td>
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
          {historialCierres.length < resumen.cajas && (
            <div className="px-4 py-3 border-t border-gray-100 text-center">
              <button
                type="button"
                onClick={() => setLimiteHistorial(l => l + PAGINA_HISTORIAL)}
                disabled={loadingHistorial}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded text-sm hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Cargar más ({historialCierres.length} de {resumen.cajas})
              </button>
            </div>
          )}
          </>
        )}
      </div>
    </div>
  )
}
