'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

interface Categoria {
  id: number
  nombre: string
}

interface Concepto {
  id: number
  nombre: string
  categoria_gasto_id: number
}

interface MedioPago {
  id: number
  nombre: string
}

interface FormData {
  tipo: 'Ingreso' | 'Egreso'
  fecha_utc: string
  categoria_id: string
  concepto_id: string
  medio_pago_id: string
  monto: string
  observaciones: string
}

export default function NuevoMovimientoPage() {
  const router = useRouter()
  const supabase = createClient()

  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [conceptos, setConceptos] = useState<Concepto[]>([])
  const [mediosPago, setMediosPago] = useState<MedioPago[]>([])
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [usuarioId, setUsuarioId] = useState<string | null>(null)

  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    defaultValues: {
      tipo: 'Egreso',
      fecha_utc: hoy,
      categoria_id: '',
      concepto_id: '',
      medio_pago_id: '',
      monto: '',
      observaciones: '',
    }
  })

  const tipo = watch('tipo')
  const categoriaId = watch('categoria_id')

  const conceptosFiltrados = conceptos.filter(c => c.categoria_gasto_id === parseInt(categoriaId))

  useEffect(() => {
    setValue('categoria_id', '')
    setValue('concepto_id', '')
  }, [tipo])

  useEffect(() => {
    setValue('concepto_id', '')
  }, [categoriaId])

  useEffect(() => {
    cargarDatos()
  }, [])

  async function cargarDatos() {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) setUsuarioId(user.id)

    const [categoriasRes, conceptosRes, mediosRes] = await Promise.all([
      supabase.from('categorias_gasto').select('id, nombre').order('nombre'),
      supabase.from('conceptos_gasto').select('id, nombre, categoria_gasto_id').order('nombre'),
      supabase.from('medios_pago').select('id, nombre').eq('activo', true).order('nombre'),
    ])

    setCategorias(categoriasRes.data || [])
    setConceptos(conceptosRes.data || [])
    setMediosPago(mediosRes.data || [])
    setLoading(false)
  }

  function parseMonto(v: string) {
    return parseFloat(v.replace(/\./g, '').replace(',', '.')) || 0
  }

  async function onSubmit(data: FormData) {
    setGuardando(true)
    setError(null)
    try {
      const monto = parseMonto(data.monto)
      if (monto <= 0) throw new Error('El monto debe ser mayor a cero')

      const mesContable = data.fecha_utc.slice(0, 7) + '-01'

      const { error: err } = await supabase.from('movimientos').insert({
        sucursal_id: 1,
        tipo: data.tipo,
        fecha_utc: data.fecha_utc,
        mes_contable: mesContable,
        categoria_gasto_id: data.categoria_id ? parseInt(data.categoria_id) : null,
        concepto_gasto_id: data.concepto_id ? parseInt(data.concepto_id) : null,
        medio_pago_id: data.medio_pago_id ? parseInt(data.medio_pago_id) : null,
        monto,
        observaciones: data.observaciones || null,
        usuario_id: usuarioId,
        anulado: false,
      })

      if (err) throw err
      router.push('/movimientos')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  if (loading) return <p className="text-sm text-gray-500">Cargando...</p>

  return (
    <div className="max-w-xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-semibold text-[#3c3c3b]">Nuevo movimiento</h1>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 ml-2">✕</button>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">

        {/* Tipo */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Tipo *</label>
          <div className="flex gap-3">
            {(['Egreso', 'Ingreso'] as const).map(t => (
              <label key={t} className="flex items-center gap-2 cursor-pointer">
                <input type="radio" value={t} {...register('tipo', { required: true })}
                  className="accent-[#00a19a]" />
                <span className={`text-sm font-medium ${t === 'Ingreso' ? 'text-green-700' : 'text-red-700'}`}>{t}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Fecha */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Fecha *</label>
          <input type="date" {...register('fecha_utc', { required: true })}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]" />
        </div>

        {/* Categoría */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Categoría</label>
          <select {...register('categoria_id')}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]">
            <option value="">— Sin categoría —</option>
            {categorias.map(c => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </div>

        {/* Concepto */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Concepto</label>
          <select {...register('concepto_id')} disabled={!categoriaId}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a] disabled:bg-gray-50 disabled:text-gray-400">
            <option value="">— Sin concepto —</option>
            {conceptosFiltrados.map(c => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </div>

        {/* Medio de pago */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Medio de pago</label>
          <select {...register('medio_pago_id')}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]">
            <option value="">— Sin especificar —</option>
            {mediosPago.map(m => (
              <option key={m.id} value={m.id}>{m.nombre}</option>
            ))}
          </select>
        </div>

        {/* Monto */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Monto *</label>
          <input
            type="text"
            inputMode="numeric"
            placeholder="0"
            {...register('monto', {
              required: 'El monto es obligatorio',
              setValueAs: v => v,
            })}
            onChange={e => {
              const raw = e.target.value.replace(/\./g, '').replace(',', '.')
              const num = parseFloat(raw)
              if (!isNaN(num)) {
                setValue('monto', num.toLocaleString('es-AR', { minimumFractionDigits: 2 }))
              } else {
                setValue('monto', e.target.value)
              }
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-[#00a19a]"
          />
          {errors.monto && <p className="text-red-500 text-xs mt-1">{errors.monto.message}</p>}
        </div>

        {/* Observaciones */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Observaciones</label>
          <textarea {...register('observaciones')} rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a] resize-none"
            placeholder="Opcional..." />
        </div>

        {/* Botones */}
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={() => router.back()}
            className="flex-1 px-4 py-2 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={guardando}
            className="flex-1 px-4 py-2 bg-[#00a19a] text-white rounded text-sm font-medium hover:bg-[#008f89] transition-colors disabled:opacity-50">
            {guardando ? 'Guardando...' : 'Guardar movimiento'}
          </button>
        </div>
      </form>
    </div>
  )
}
