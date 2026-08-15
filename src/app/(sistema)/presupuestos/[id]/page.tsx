import { createClient } from '@/lib/supabase/server'
import PresupuestoForm from '@/components/presupuestos/PresupuestoForm'
import { notFound } from 'next/navigation'

export default async function EditarPresupuestoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: presupuesto, error } = await supabase
    .from('presupuestos')
    .select('id, numero, estado, cliente_id, fecha, validez_hasta, forma_pago, observaciones, venta_borrador_id')
    .eq('id', id)
    .single()

  if (error || !presupuesto) notFound()

  const { data: cliente } = await supabase
    .from('clientes')
    .select('nombre')
    .eq('id', presupuesto.cliente_id)
    .single()

  const { data: itemsData } = await supabase
    .from('presupuesto_items')
    .select('articulo_id, cantidad, precio_unitario, articulos(nombre)')
    .eq('presupuesto_id', presupuesto.id)

  const items = (itemsData || []).map((i: any) => ({
    articulo_id: i.articulo_id,
    nombre: i.articulos?.nombre || `Artículo #${i.articulo_id}`,
    cantidad: i.cantidad,
    precio_unitario: i.precio_unitario,
  }))

  return (
    <PresupuestoForm
      presupuestoId={presupuesto.id}
      numero={presupuesto.numero}
      estadoInicial={presupuesto.estado}
      clienteIdInicial={presupuesto.cliente_id}
      clienteNombreInicial={cliente?.nombre || ''}
      fechaInicial={presupuesto.fecha}
      validezInicial={presupuesto.validez_hasta || ''}
      formaPagoInicial={presupuesto.forma_pago || ''}
      observacionesInicial={presupuesto.observaciones || ''}
      itemsIniciales={items}
      ventaBorradorIdInicial={presupuesto.venta_borrador_id}
    />
  )
}
