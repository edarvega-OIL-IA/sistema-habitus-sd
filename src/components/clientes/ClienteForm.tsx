'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Save, X } from 'lucide-react'

const clienteSchema = z.object({
  nombre: z.string().min(1, 'El nombre es obligatorio'),
  tipo_cliente_id: z.string(),
  dni: z.string().optional(),
  cuit: z.string().optional(),
  condicion_iva_id: z.string(),
  domicilio: z.string().optional(),
  telefono: z.string().optional(),
  email: z.string().optional(),
  tiene_cuenta_corriente: z.boolean(),
  plazo_dias_cta_cte: z.string().optional(),
  descuento_default_pct: z.string().optional(),
  notas: z.string().optional(),
  activo: z.boolean(),
})

type ClienteFormData = z.infer<typeof clienteSchema>

interface Props {
  clienteId?: number
  valoresIniciales?: Partial<ClienteFormData>
}

const TIPOS_CLIENTE = [
  { id: '1', nombre: 'Consumidor Final' },
  { id: '2', nombre: 'Cuenta Corriente' },
]

// condiciones_iva: 1=RI, 2=Monotributista, 3=Exento, 4=Consumidor Final, 5=No Responsable
const CONDICIONES_IVA = [
  { id: '4', nombre: 'Consumidor Final' },
  { id: '1', nombre: 'Responsable Inscripto' },
  { id: '2', nombre: 'Monotributista' },
  { id: '3', nombre: 'Exento' },
  { id: '5', nombre: 'No Responsable' },
]

export default function ClienteForm({ clienteId, valoresIniciales }: Props) {
  const router = useRouter()
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ClienteFormData>({
    resolver: zodResolver(clienteSchema),
    defaultValues: {
      nombre: '',
      tipo_cliente_id: '1',
      dni: '',
      cuit: '',
      condicion_iva_id: '4',
      domicilio: '',
      telefono: '',
      email: '',
      tiene_cuenta_corriente: false,
      plazo_dias_cta_cte: '',
      descuento_default_pct: '',
      notas: '',
      activo: true,
      ...valoresIniciales,
    },
  })

  const tieneCtaCte = watch('tiene_cuenta_corriente')

  async function onSubmit(data: ClienteFormData) {
    setGuardando(true)
    setError(null)
    const supabase = createClient()

    const payload = {
      nombre: data.nombre.trim(),
      tipo_cliente_id: Number(data.tipo_cliente_id),
      dni: data.dni?.trim() || null,
      cuit: data.cuit?.trim() || null,
      condicion_iva_id: Number(data.condicion_iva_id),
      domicilio: data.domicilio?.trim() || null,
      telefono: data.telefono?.trim() || null,
      email: data.email?.trim() || null,
      tiene_cuenta_corriente: data.tiene_cuenta_corriente,
      plazo_dias_cta_cte: data.tiene_cuenta_corriente && data.plazo_dias_cta_cte ? Number(data.plazo_dias_cta_cte) : null,
      descuento_default_pct: data.descuento_default_pct ? Number(data.descuento_default_pct.replace(',', '.')) : 0,
      notas: data.notas?.trim() || null,
      activo: data.activo,
    }

    if (clienteId) {
      const { error: updateError } = await supabase.from('clientes').update(payload).eq('id', clienteId)
      if (updateError) { setError('Error al guardar: ' + updateError.message); setGuardando(false); return }
    } else {
      const { error: insertError } = await supabase.from('clientes').insert(payload)
      if (insertError) { setError('Error al crear: ' + insertError.message); setGuardando(false); return }
    }

    router.push('/clientes')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center justify-between">
          {error}
          <button type="button" onClick={() => setError(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Identificación</h2>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Nombre *</label>
          <input
            type="text"
            {...register('nombre')}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]"
          />
          {errors.nombre && <p className="text-xs text-red-600 mt-1">{errors.nombre.message}</p>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">DNI</label>
            <input
              type="text"
              inputMode="numeric"
              {...register('dni')}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">CUIT</label>
            <input
              type="text"
              {...register('cuit')}
              placeholder="XX-XXXXXXXX-X"
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Condición frente al IVA</label>
          <select
            {...register('condicion_iva_id')}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]"
          >
            {CONDICIONES_IVA.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Contacto</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Teléfono</label>
            <input
              type="text"
              {...register('telefono')}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
            <input
              type="email"
              {...register('email')}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Domicilio</label>
          <input
            type="text"
            {...register('domicilio')}
            placeholder="Calle, número, ciudad, provincia"
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]"
          />
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Condiciones comerciales</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tipo de cliente</label>
            <select
              {...register('tipo_cliente_id')}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]"
            >
              {TIPOS_CLIENTE.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Descuento por defecto (%)</label>
            <input
              type="text"
              inputMode="decimal"
              {...register('descuento_default_pct')}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]"
            />
          </div>
        </div>

        <div className="pt-2 border-t border-gray-100">
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer w-fit">
            <input
              type="checkbox"
              {...register('tiene_cuenta_corriente')}
              className="rounded border-gray-300 text-[#00a19a] focus:ring-[#00a19a]"
            />
            Tiene cuenta corriente (venta a crédito, con plazo de pago)
          </label>

          {tieneCtaCte && (
            <div className="mt-3 max-w-xs">
              <label className="block text-xs font-medium text-gray-600 mb-1">Plazo de pago por defecto (días)</label>
              <input
                type="text"
                inputMode="numeric"
                {...register('plazo_dias_cta_cte')}
                placeholder="ej. 15 o 30"
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]"
              />
              <p className="text-xs text-gray-400 mt-1">
                Se puede ajustar puntualmente en cada venta a este cliente si el plazo acordado es distinto.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Notas</h2>
        <textarea
          {...register('notas')}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]"
        />

        {clienteId && (
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer w-fit pt-2 border-t border-gray-100">
            <input
              type="checkbox"
              {...register('activo')}
              className="rounded border-gray-300 text-[#00a19a] focus:ring-[#00a19a]"
            />
            Cliente activo
          </label>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={guardando}
          className="flex items-center gap-2 bg-[#00a19a] text-white px-4 py-2 rounded text-sm hover:bg-[#008f89] transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {guardando ? 'Guardando...' : 'Guardar'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/clientes')}
          className="px-4 py-2 border border-gray-300 rounded text-sm text-gray-600 hover:bg-gray-50"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
