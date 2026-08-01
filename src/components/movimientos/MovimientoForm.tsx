'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Save, X, ArrowDownCircle, ArrowUpCircle } from 'lucide-react'

const movimientoSchema = z.object({
  tipo: z.enum(['Ingreso', 'Egreso']),
  monto: z.number().min(0.01, 'El monto debe ser mayor a 0'),
  categoria_id: z.number().min(1, 'La categoría es requerida'),
  concepto_id: z.number().min(1, 'El concepto es requerido'),
  medio_pago_id: z.number().optional(),
  fecha: z.string().min(1, 'La fecha es requerida'),
  periodo: z.string().min(1, 'El período es requerido'), // 'YYYY-MM' — a qué mes corresponde el gasto, independiente de cuándo se pagó
  fecha_vencimiento: z.string().optional(), // opcional — solo aplica a obligaciones con vencimiento formal (impuestos, cargas sociales)
  observaciones: z.string().optional(),
})

type MovimientoFormData = z.infer<typeof movimientoSchema>

interface Categoria { id: number; nombre: string; tipo: string }
interface Concepto { id: number; nombre: string; categoria_gasto_id: number; tipo: string }

interface MovimientoFormProps {
  movimientoId?: number
}

export default function MovimientoForm({ movimientoId }: MovimientoFormProps) {
  const router = useRouter()
  const esEdicion = !!movimientoId

  const [loading, setLoading] = useState(false)
  const [cargandoInicial, setCargandoInicial] = useState(esEdicion)
  const [accesoDenegado, setAccesoDenegado] = useState<string | null>(null)
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [conceptos, setConceptos] = useState<Concepto[]>([])
  const [conceptosFiltrados, setConceptosFiltrados] = useState<Concepto[]>([])
  const [mediosPago, setMediosPago] = useState<{ id: number, nombre: string }[]>([])
  const [montoTexto, setMontoTexto] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // sucursal_id, cierre_turno_id activo y usuario/rol — necesarios para
  // guardar la caja de origen (alta) y para el gate de permisos (edición).
  const [sucursalId, setSucursalId] = useState<number>(1)
  const [cierreActivoId, setCierreActivoId] = useState<number | null>(null)
  const [usuarioId, setUsuarioId] = useState<string | null>(null)
  const [rolUsuario, setRolUsuario] = useState<number | null>(null)

  function parsearMonto(v: string): number {
    const s = (v || '').trim()
    if (!s) return 0
    const lastComma = s.lastIndexOf(',')
    const lastDot = s.lastIndexOf('.')
    const lastSep = Math.max(lastComma, lastDot)
    if (lastSep === -1) {
      const n = parseFloat(s.replace(/[^\d]/g, ''))
      return isNaN(n) ? 0 : n
    }
    const despuesDelSeparador = s.slice(lastSep + 1).replace(/[^\d]/g, '')
    if (despuesDelSeparador.length === 1 || despuesDelSeparador.length === 2) {
      const parteEntera = s.slice(0, lastSep).replace(/[.,]/g, '')
      const n = parseFloat((parteEntera || '0') + '.' + despuesDelSeparador)
      return isNaN(n) ? 0 : n
    }
    const n = parseFloat(s.replace(/[.,]/g, ''))
    return isNaN(n) ? 0 : n
  }
  function fmtInput(n: number | null | undefined): string {
    if (n === null || n === undefined || n === 0) return ''
    return n.toLocaleString('es-AR', { maximumFractionDigits: 2 })
  }

  function handleMontoChange(raw: string) {
    setMontoTexto(raw)
    setValue('monto', raw.trim() === '' ? 0 : parsearMonto(raw), { shouldValidate: true })
  }
  function handleMontoBlur() { setMontoTexto(null) }

  const { register, handleSubmit, formState: { errors }, setValue, watch, reset } = useForm<MovimientoFormData>({
    resolver: zodResolver(movimientoSchema),
    defaultValues: {
      tipo: 'Egreso',
      fecha: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }),
      periodo: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).slice(0, 7),
    }
  })

  // Período contable: por default sigue a la Fecha (el caso normal, se paga
  // dentro del mes que corresponde). Si la persona toca "Período" a mano
  // (ej. un impuesto que se paga atrasado), deja de seguir a la Fecha.
  const [periodoTocado, setPeriodoTocado] = useState(false)

  const tipo = watch('tipo')
  const categoriaId = watch('categoria_id')
  const monto = watch('monto')
  const fecha = watch('fecha')
  const medioPagoId = watch('medio_pago_id')

  useEffect(() => {
    if (!periodoTocado && fecha) setValue('periodo', fecha.slice(0, 7))
  }, [fecha, periodoTocado])

  const categoriasFiltradas = categorias.filter(c => c.tipo === tipo || c.tipo === 'Ambos')

  // Período y Fecha de vencimiento solo aplican a categorías con obligaciones
  // fijas/recurrentes con vencimiento formal (impuestos, sueldos y cargas
  // sociales, servicios y alquiler). El resto de las categorías (Caja,
  // Local Comercial → Mantenimiento, Insumos, Marketing, etc.) no las necesita.
  const CATEGORIAS_CON_PERIODO = ['Impuestos', 'Empleados', 'Servicios']
  const categoriaSeleccionada = categorias.find(c => c.id === categoriaId)
  const requierePeriodo = !!categoriaSeleccionada && CATEGORIAS_CON_PERIODO.includes(categoriaSeleccionada.nombre)

  const medioSeleccionadoActual = mediosPago.find(m => m.id === medioPagoId)
  const efectivoSinCajaAbierta = medioSeleccionadoActual?.nombre === 'Efectivo' && !cierreActivoId

  function cambiarTipo(nuevoTipo: 'Ingreso' | 'Egreso') {
    setValue('tipo', nuevoTipo)
    setValue('categoria_id', 0)
    setValue('concepto_id', 0)
    setConceptosFiltrados([])
  }

  useEffect(() => {
    const efectivo = mediosPago.find(m => m.nombre === 'Efectivo')
    if (efectivo && !esEdicion) setValue('medio_pago_id', efectivo.id)
  }, [mediosPago])

  useEffect(() => {
    if (categoriaId) {
      const filtrados = conceptos.filter(c => c.categoria_gasto_id === categoriaId && (c.tipo === tipo || c.tipo === 'Ambos'))
      setConceptosFiltrados(filtrados)
      if (filtrados.length === 1 && !cargandoInicial) {
        setValue('concepto_id', filtrados[0].id, { shouldValidate: true })
      }
    } else {
      setConceptosFiltrados([])
    }
  }, [categoriaId, tipo, conceptos])

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setAccesoDenegado('No autenticado.'); setCargandoInicial(false); return }

    const { data: usuarioData } = await supabase
      .from('usuarios').select('id, sucursal_id, rol_id').eq('id', user.id).single()
    if (!usuarioData) { setAccesoDenegado('Usuario no encontrado.'); setCargandoInicial(false); return }
    setUsuarioId(usuarioData.id)
    setRolUsuario(usuarioData.rol_id)
    setSucursalId(usuarioData.sucursal_id ?? 1)

    const { data: cierreActivo } = await supabase
      .from('cierres_turno').select('id')
      .eq('sucursal_id', usuarioData.sucursal_id ?? 1).eq('estado_cierre_turno_id', 1).maybeSingle()
    setCierreActivoId(cierreActivo?.id ?? null)

    const [categoriasRes, conceptosRes, mediosRes] = await Promise.all([
      supabase.from('categorias_gasto').select('id, nombre, tipo').order('nombre'),
      supabase.from('conceptos_gasto').select('id, nombre, categoria_gasto_id, tipo').order('nombre'),
      supabase.from('medios_pago').select('id, nombre').eq('activo', true).order('id'),
    ])
    setCategorias(categoriasRes.data || [])
    setConceptos(conceptosRes.data || [])
    setMediosPago(mediosRes.data || [])

    if (esEdicion) {
      const { data: mov, error } = await supabase
        .from('movimientos')
        .select('tipo, monto, categoria_gasto_id, concepto_gasto_id, medio_pago_id, fecha_utc, mes_contable, fecha_vencimiento, observaciones, origen_tipo, cierre_turno_id, anulado')
        .eq('id', movimientoId).single()

      if (error || !mov) { setAccesoDenegado('Movimiento no encontrado.'); setCargandoInicial(false); return }

      // Solo movimientos manuales son editables — los generados por Ventas,
      // Compras o Caja deben corregirse desde su pantalla de origen.
      if (mov.origen_tipo !== null) {
        setAccesoDenegado('Este movimiento fue generado automáticamente (no es manual) y no se puede editar desde acá.')
        setCargandoInicial(false)
        return
      }
      if (mov.anulado) {
        setAccesoDenegado('Este movimiento ya está eliminado.')
        setCargandoInicial(false)
        return
      }

      // Gate: Admin siempre puede; otro usuario solo si el movimiento
      // pertenece al cierre de turno actualmente abierto.
      const esAdmin = usuarioData.rol_id === 1
      const dentroDeSuTurno = mov.cierre_turno_id !== null && mov.cierre_turno_id === (cierreActivo?.id ?? null)
      if (!esAdmin && !dentroDeSuTurno) {
        setAccesoDenegado('Solo podés editar movimientos cargados en tu turno actualmente abierto.')
        setCargandoInicial(false)
        return
      }

      // Poblar conceptosFiltrados ANTES de reset(): si se espera al efecto
      // [categoriaId, tipo, conceptos], el <select> renderiza sin la opción
      // todavía disponible y el navegador cae al placeholder — el valor de
      // concepto_id quedaba puesto pero invisible (bug encontrado 13/07/2026).
      setConceptosFiltrados((conceptosRes.data || []).filter(
        (c: Concepto) => c.categoria_gasto_id === mov.categoria_gasto_id && (c.tipo === mov.tipo || c.tipo === 'Ambos')
      ))

      setPeriodoTocado(true) // el período real ya está guardado — no lo recalculamos a partir de la Fecha

      reset({
        tipo: mov.tipo,
        monto: mov.monto,
        categoria_id: mov.categoria_gasto_id,
        concepto_id: mov.concepto_gasto_id,
        medio_pago_id: mov.medio_pago_id ?? undefined,
        fecha: mov.fecha_utc,
        periodo: mov.mes_contable ? mov.mes_contable.slice(0, 7) : mov.fecha_utc.slice(0, 7),
        fecha_vencimiento: mov.fecha_vencimiento ?? '',
        observaciones: mov.observaciones ?? '',
      })
    }

    setCargandoInicial(false)
  }

  async function onSubmit(data: MovimientoFormData) {
    const medioSeleccionado = mediosPago.find(m => m.id === data.medio_pago_id)
    if (medioSeleccionado?.nombre === 'Efectivo' && !cierreActivoId) {
      setErrorMsg('No podés registrar un movimiento en Efectivo sin la caja abierta — ese dinero real nunca se sumaría a ningún cierre de turno. Abrí la caja primero, o elegí otro medio de pago.')
      return
    }
    setLoading(true)
    setErrorMsg(null)
    const supabase = createClient()
    try {
      // mes_contable SIEMPRE sigue a la Fecha real de pago (este sistema es
      // de caja real desde el día uno, no de devengado contable) — "Período"
      // es solo referencia informativa, nunca mueve un peso de mes en el
      // Dashboard/Reportes, aunque diga algo distinto (ej. un impuesto de
      // junio pagado en julio: el egreso real sigue contando en julio).
      const mes_contable = `${data.fecha.slice(0, 7)}-01`

      if (esEdicion) {
        const { error } = await supabase.from('movimientos').update({
          fecha_utc: data.fecha,
          tipo: data.tipo,
          categoria_gasto_id: data.categoria_id,
          concepto_gasto_id: data.concepto_id,
          monto: data.monto,
          medio_pago_id: data.medio_pago_id || null,
          mes_contable,
          fecha_vencimiento: data.fecha_vencimiento || null,
          observaciones: data.observaciones || null,
        }).eq('id', movimientoId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('movimientos').insert([{
          sucursal_id: sucursalId,
          fecha_utc: data.fecha,
          tipo: data.tipo,
          categoria_gasto_id: data.categoria_id,
          concepto_gasto_id: data.concepto_id,
          monto: data.monto,
          medio_pago_id: data.medio_pago_id || null,
          cuenta_id: null,
          mes_contable,
          fecha_vencimiento: data.fecha_vencimiento || null,
          observaciones: data.observaciones || null,
          usuario_id: usuarioId,
          entidad_tipo_id: null,
          entidad_id: null,
          turno_id: null,
          cierre_turno_id: cierreActivoId,
          origen_tipo: null,
          origen_id: null,
          estado_cobro_id: null,
          anulado: false,
        }])
        if (error) throw error
      }

      router.push('/movimientos')
      router.refresh()
    } catch (error: any) {
      setErrorMsg('Error al guardar: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  if (cargandoInicial) return <p className="text-sm text-gray-500">Cargando...</p>
  if (accesoDenegado) {
    return (
      <div className="max-w-lg">
        <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700 text-sm mb-4">{accesoDenegado}</div>
        <button onClick={() => router.push('/movimientos')}
          className="px-4 py-2 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50">
          Volver a Movimientos
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[#3c3c3b]">{esEdicion ? 'Editar movimiento' : 'Nuevo movimiento'}</h1>
        <div className="flex gap-2">
          <button type="button" onClick={() => router.push('/movimientos')}
            className="px-4 py-2 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2">
            <X className="w-4 h-4" /> Cancelar
          </button>
          <button type="submit" disabled={loading}
            className="px-4 py-2 bg-[#00a19a] text-white rounded text-sm hover:bg-[#008f89] transition-colors flex items-center gap-2 disabled:opacity-50">
            <Save className="w-4 h-4" />
            {loading ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm flex items-center justify-between">
          <span>{errorMsg}</span>
          <button type="button" onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-red-600 ml-2">✕</button>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de movimiento</label>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => cambiarTipo('Egreso')}
              className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                tipo === 'Egreso' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
              }`}>
              <ArrowDownCircle className="w-5 h-5" />
              <span className="font-semibold">Egreso</span>
            </button>
            <button type="button" onClick={() => cambiarTipo('Ingreso')}
              className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                tipo === 'Ingreso' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
              }`}>
              <ArrowUpCircle className="w-5 h-5" />
              <span className="font-semibold">Ingreso</span>
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Monto <span className="text-red-500">*</span></label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-3xl font-bold text-gray-400">$</span>
            <input type="text" inputMode="decimal"
              value={montoTexto !== null ? montoTexto : fmtInput(monto)}
              onFocus={e => e.target.select()}
              onChange={e => handleMontoChange(e.target.value)}
              onBlur={handleMontoBlur}
              placeholder="0"
              className={`w-full pl-12 pr-4 py-4 border-2 rounded-lg text-3xl font-bold text-[#3c3c3b] focus:outline-none focus:ring-2 focus:ring-[#00a19a] focus:border-transparent ${
                errors.monto ? 'border-red-300' : 'border-gray-300'
              }`} />
          </div>
          {errors.monto && <p className="text-red-500 text-sm mt-1">{errors.monto.message}</p>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categoría <span className="text-red-500">*</span></label>
            <select {...register('categoria_id', { valueAsNumber: true })}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]">
              <option value="">Seleccionar categoría</option>
              {categoriasFiltradas.map(cat => <option key={cat.id} value={cat.id}>{cat.nombre}</option>)}
            </select>
            {errors.categoria_id && <p className="text-red-500 text-xs mt-1">{errors.categoria_id.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Concepto <span className="text-red-500">*</span></label>
            <select {...register('concepto_id', { valueAsNumber: true })}
              disabled={!categoriaId}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a] disabled:bg-gray-100">
              <option value="">{!categoriaId ? 'Primero seleccione categoría' : 'Seleccionar concepto'}</option>
              {conceptosFiltrados.map(con => <option key={con.id} value={con.id}>{con.nombre}</option>)}
            </select>
            {errors.concepto_id && <p className="text-red-500 text-xs mt-1">{errors.concepto_id.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Medio de pago</label>
            <select {...register('medio_pago_id', { valueAsNumber: true })}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]">
              <option value="">Sin especificar</option>
              {mediosPago.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
            </select>
            {efectivoSinCajaAbierta && (
              <p className="text-red-600 text-xs mt-1">⚠ No hay caja abierta — este movimiento no se va a poder guardar en Efectivo.</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha <span className="text-red-500">*</span></label>
            <input {...register('fecha')} type="date"
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]" />
            {errors.fecha && <p className="text-red-500 text-xs mt-1">{errors.fecha.message}</p>}
          </div>

          {requierePeriodo && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Período <span className="text-red-500">*</span></label>
            <input {...register('periodo')} type="month"
              onChange={e => { setPeriodoTocado(true); setValue('periodo', e.target.value, { shouldValidate: true }) }}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]" />
            <p className="text-xs text-gray-500 mt-1">Solo referencia (ej. "este pago es del impuesto de junio") — no cambia el mes en Dashboard/Reportes, eso siempre sigue a la Fecha real de pago.</p>
            {errors.periodo && <p className="text-red-500 text-xs mt-1">{errors.periodo.message}</p>}
          </div>
          )}

          {requierePeriodo && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de vencimiento</label>
            <input {...register('fecha_vencimiento')} type="date"
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]" />
            <p className="text-xs text-gray-500 mt-1">Opcional — solo para impuestos y cargas sociales con vencimiento formal.</p>
          </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
          <textarea {...register('observaciones')} rows={3}
            placeholder="Información adicional (opcional)"
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]" />
        </div>
      </div>
    </form>
  )
}
