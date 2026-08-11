import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const TUSFACTURAS_ENDPOINT = 'https://www.tusfacturas.app/app/api/v2/facturacion/regenerar_pdf'
const PUNTO_VENTA = '0004'
const TIPO_COMPROBANTE = 'FACTURA C'

interface RegenerarPdfRequest {
  usertoken: string
  apikey: string
  apitoken: string
  comprobante: {
    tipo: string
    operacion: 'V' | 'C'
    punto_venta: string
    numero: string
  }
}

interface RegenerarPdfRespuesta {
  error: 'N' | 'S'
  comprobante_pdf_url?: string
  comprobante_ticket_url?: string
  errores?: string[]
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ ok: false, mensaje: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { venta_id } = body

    if (!venta_id) {
      return NextResponse.json({ ok: false, mensaje: 'venta_id es requerido' }, { status: 400 })
    }

    // Consultar comprobante asociado a la venta
    const { data: comprobante, error: comprobanteError } = await supabase
      .from('comprobantes')
      .select('id, numero, estado_fiscal_id, factura_cae')
      .eq('venta_id', venta_id)
      .maybeSingle()

    if (comprobanteError || !comprobante) {
      return NextResponse.json({ ok: false, mensaje: 'No se encontró el comprobante' }, { status: 404 })
    }

    // Verificar que tiene CAE confirmado (estado_fiscal_id = 3)
    if (comprobante.estado_fiscal_id !== 3) {
      return NextResponse.json(
        { ok: false, mensaje: 'El comprobante no tiene CAE confirmado' },
        { status: 400 }
      )
    }

    // Preparar request a TusFacturasAPP
    const requestBody: RegenerarPdfRequest = {
      usertoken: process.env.TUSFACTURAS_USERTOKEN!,
      apikey: process.env.TUSFACTURAS_APIKEY!,
      apitoken: process.env.TUSFACTURAS_APITOKEN!,
      comprobante: {
        tipo: TIPO_COMPROBANTE,
        operacion: 'V',
        punto_venta: PUNTO_VENTA,
        numero: String(comprobante.numero).padStart(8, '0'),
      },
    }

    console.log('[DEBUG] Request a TusFacturasAPP:', {
      endpoint: TUSFACTURAS_ENDPOINT,
      comprobante: requestBody.comprobante,
      tiene_credenciales: {
        usertoken: !!requestBody.usertoken,
        apikey: !!requestBody.apikey,
        apitoken: !!requestBody.apitoken,
      }
    })

    const response = await fetch(TUSFACTURAS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    })

    const data = (await response.json()) as RegenerarPdfRespuesta

    console.log('[DEBUG] Respuesta de TusFacturasAPP:', {
      status: response.status,
      error: data.error,
      tiene_pdf_url: !!data.comprobante_pdf_url,
      errores: data.errores,
    })

    if (data.error === 'N' && data.comprobante_pdf_url) {
      return NextResponse.json({
        ok: true,
        pdf_url: data.comprobante_pdf_url,
        ticket_url: data.comprobante_ticket_url,
      })
    } else {
      const mensajeError = data.errores?.join(' | ') || 'TusFacturasAPP no devolvió el PDF'
      return NextResponse.json({ ok: false, mensaje: mensajeError }, { status: 500 })
    }
  } catch (error: any) {
    console.error('Error al regenerar PDF:', error)
    return NextResponse.json(
      { ok: false, mensaje: 'Error al regenerar PDF: ' + error.message },
      { status: 500 }
    )
  }
}
