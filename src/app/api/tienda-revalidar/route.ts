// Ruta destino: C:\Users\Usuario\Documents\sistema-habitus-sd\src\app\api\tienda-revalidar\route.ts
//
// Avisa a Vercel que la Vitrina (/tienda y las fichas) cambió y hay que
// regenerarla. La llama el panel interno después de guardar un artículo, un
// precio o una foto (ver lib/tienda/revalidarTienda.ts). Requiere sesión:
// el proxy ya bloquea esta ruta a quien no esté logueado y acá se vuelve a
// comprobar por las dudas. No es pública a propósito (no está en RUTAS_PUBLICAS).

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { revalidarTiendaServidor } from '@/lib/tienda/revalidarTiendaServidor'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  revalidarTiendaServidor()
  return NextResponse.json({ ok: true })
}
