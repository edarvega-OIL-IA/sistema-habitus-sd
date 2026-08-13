// Ruta destino: C:\Users\Usuario\Documents\sistema-habitus-sd\src\app\api\ventas\[id]\nota-credito\route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { emitirNotaCreditoVenta } from '@/lib/tusfacturas/notaCredito'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ventaId = Number(id)
  if (!ventaId || Number.isNaN(ventaId)) {
    return NextResponse.json({ error: 'ID de venta inválido' }, { status: 400 })
  }

  const supabase = await createClient()
  // TODO: gatear a solo rol_id=1 (Admin) cuando exista la pantalla de
  // permisos granulares — hoy cualquier usuario logueado con acceso al
  // sistema puede disparar esto, mismo nivel de protección que el resto de
  // las acciones sensibles todavía sin ese control fino.

  const resultado = await emitirNotaCreditoVenta(ventaId, supabase)

  if (!resultado.ok) {
    return NextResponse.json({ error: resultado.mensaje }, { status: 400 })
  }
  return NextResponse.json({ ok: true, mensaje: resultado.mensaje })
}
