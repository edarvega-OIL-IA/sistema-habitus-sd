// Ruta destino: C:\Users\Usuario\Documents\sistema-habitus-sd\src\app\api\fiscalizacion\route.ts

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { fiscalizarVenta } from '@/lib/tusfacturas/fiscalizar'

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: usuarioSistema } = await supabase
    .from('usuarios')
    .select('rol_id')
    .eq('id', user.id)
    .single()

  // Solo Admin — mismo criterio que /articulos/precios
  if (usuarioSistema?.rol_id !== 1)
    return NextResponse.json({ error: 'Esta acción requiere rol Admin' }, { status: 403 })

  const body = await request.json()
  const { venta_id, cliente_id, es_contado } = body

  if (!venta_id || !cliente_id)
    return NextResponse.json({ error: 'Faltan venta_id o cliente_id' }, { status: 400 })

  const resultado = await fiscalizarVenta(venta_id, cliente_id, es_contado !== false)

  return NextResponse.json(resultado, { status: resultado.ok ? 200 : 422 })
}
