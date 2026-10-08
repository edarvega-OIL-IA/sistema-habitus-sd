// Ruta destino: C:\Users\Usuario\Documents\sistema-habitus-sd\src\app\api\avisos-stock\route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { normalizarWhatsapp } from '@/lib/whatsapp'

const MEDIOS_VALIDOS = ['whatsapp', 'email', 'ambos']
const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: Request) {
  // Cualquier error inesperado devuelve igual un JSON (nunca una respuesta vacía)
  // y queda registrado en los logs del servidor (Vercel → Logs).
  try {
    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ ok: false, mensaje: 'Pedido inválido' }, { status: 400 })
    }

    const { articulo_id, medio_preferido, whatsapp, email } = body

    if (!articulo_id || typeof articulo_id !== 'number') {
      return NextResponse.json({ ok: false, mensaje: 'Falta el artículo' }, { status: 400 })
    }
    if (typeof medio_preferido !== 'string' || !MEDIOS_VALIDOS.includes(medio_preferido)) {
      return NextResponse.json({ ok: false, mensaje: 'Medio de contacto inválido' }, { status: 400 })
    }
    const necesitaWhatsapp = medio_preferido === 'whatsapp' || medio_preferido === 'ambos'
    const necesitaEmail = medio_preferido === 'email' || medio_preferido === 'ambos'

    // El formulario ya manda el número normalizado ("+549..."); se vuelve a normalizar
    // acá por si llega crudo desde otro lado (si no trae "+", se asume Argentina).
    let whatsappFinal: string | null = null
    if (necesitaWhatsapp) {
      if (!whatsapp || typeof whatsapp !== 'string') {
        return NextResponse.json({ ok: false, mensaje: 'Falta el WhatsApp' }, { status: 400 })
      }
      whatsappFinal = normalizarWhatsapp(whatsapp)
      if (!whatsappFinal) {
        return NextResponse.json({ ok: false, mensaje: 'El WhatsApp no parece válido' }, { status: 400 })
      }
    }

    let emailFinal: string | null = null
    if (necesitaEmail) {
      if (!email || typeof email !== 'string') {
        return NextResponse.json({ ok: false, mensaje: 'Falta el email' }, { status: 400 })
      }
      emailFinal = email.trim()
      if (!EMAIL_VALIDO.test(emailFinal)) {
        return NextResponse.json({ ok: false, mensaje: 'El email no parece válido' }, { status: 400 })
      }
    }

    const supabase = await createClient()
    const { error } = await supabase.from('avisos_stock').insert({
      articulo_id,
      medio_preferido,
      whatsapp: whatsappFinal,
      email: emailFinal,
    })

    if (error) {
      console.error('Error al guardar aviso de stock:', error.message)
      return NextResponse.json({ ok: false, mensaje: 'No se pudo guardar el aviso' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Error inesperado en /api/avisos-stock:', err)
    return NextResponse.json({ ok: false, mensaje: 'No se pudo guardar el aviso' }, { status: 500 })
  }
}
