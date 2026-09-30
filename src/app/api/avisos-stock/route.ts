// Ruta destino: C:\Users\Usuario\Documents\sistema-habitus-sd\src\app\api\avisos-stock\route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const MEDIOS_VALIDOS = ['whatsapp', 'email', 'ambos']

export async function POST(request: Request) {
  const body = await request.json()
  const { articulo_id, medio_preferido, whatsapp, email } = body

  if (!articulo_id || typeof articulo_id !== 'number') {
    return NextResponse.json({ ok: false, mensaje: 'Falta el artículo' }, { status: 400 })
  }
  if (!MEDIOS_VALIDOS.includes(medio_preferido)) {
    return NextResponse.json({ ok: false, mensaje: 'Medio de contacto inválido' }, { status: 400 })
  }
  const necesitaWhatsapp = medio_preferido === 'whatsapp' || medio_preferido === 'ambos'
  const necesitaEmail = medio_preferido === 'email' || medio_preferido === 'ambos'
  if (necesitaWhatsapp && (!whatsapp || typeof whatsapp !== 'string')) {
    return NextResponse.json({ ok: false, mensaje: 'Falta el WhatsApp' }, { status: 400 })
  }
  if (necesitaEmail && (!email || typeof email !== 'string')) {
    return NextResponse.json({ ok: false, mensaje: 'Falta el email' }, { status: 400 })
  }

  const supabase = await createClient()
  const { error } = await supabase.from('avisos_stock').insert({
    articulo_id,
    medio_preferido,
    whatsapp: necesitaWhatsapp ? whatsapp : null,
    email: necesitaEmail ? email : null,
  })

  if (error) {
    console.error('Error al guardar aviso de stock:', error.message)
    return NextResponse.json({ ok: false, mensaje: 'No se pudo guardar el aviso' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
