'use client'

import { useParams } from 'next/navigation'
import MovimientoForm from '@/components/movimientos/MovimientoForm'

export default function EditarMovimientoPage() {
  const params = useParams()
  const id = Number(params.id)
  return <MovimientoForm movimientoId={id} />
}
