// Ruta destino: C:\Users\Usuario\Documents\sistema-habitus-sd\src\app\(sistema)\mayoristas\[id]\editar\page.tsx
//
// Edición de una venta mayorista. Pendiente de entrega → se edita todo;
// Entregada → solo fecha, flete y observaciones (ver VentaMayoristaForm.tsx).
'use client'

import { useParams } from 'next/navigation'
import VentaMayoristaForm from '@/components/mayoristas/VentaMayoristaForm'

export default function EditarVentaMayoristaPage() {
  const params = useParams<{ id: string }>()
  const ventaId = Number(Array.isArray(params.id) ? params.id[0] : params.id)
  return <VentaMayoristaForm modo="editar" ventaId={ventaId} />
}
