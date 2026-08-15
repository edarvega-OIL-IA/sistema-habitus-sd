import { createClient } from '@/lib/supabase/server'
import ClienteForm from '@/components/clientes/ClienteForm'
import { notFound } from 'next/navigation'

export default async function EditarClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: cliente, error } = await supabase
    .from('clientes')
    .select('id, nombre, tipo_cliente_id, dni, cuit, condicion_iva_id, domicilio, telefono, email, tiene_cuenta_corriente, plazo_dias_cta_cte, descuento_default_pct, notas, activo')
    .eq('id', id)
    .single()

  if (error || !cliente) notFound()

  return (
    <div>
      <h1 className="text-xl font-semibold text-[#3c3c3b] mb-6">Editar cliente</h1>
      <ClienteForm
        clienteId={cliente.id}
        valoresIniciales={{
          nombre: cliente.nombre,
          tipo_cliente_id: cliente.tipo_cliente_id?.toString() ?? '1',
          dni: cliente.dni ?? '',
          cuit: cliente.cuit ?? '',
          condicion_iva_id: cliente.condicion_iva_id?.toString() ?? '4',
          domicilio: cliente.domicilio ?? '',
          telefono: cliente.telefono ?? '',
          email: cliente.email ?? '',
          tiene_cuenta_corriente: cliente.tiene_cuenta_corriente ?? false,
          plazo_dias_cta_cte: cliente.plazo_dias_cta_cte?.toString() ?? '',
          descuento_default_pct: cliente.descuento_default_pct?.toString() ?? '',
          notas: cliente.notas ?? '',
          activo: cliente.activo ?? true,
        }}
      />
    </div>
  )
}
