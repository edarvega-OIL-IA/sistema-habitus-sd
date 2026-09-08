// Ruta destino: C:\Users\Usuario\Documents\sistema-habitus-sd\src\app\api\tienda\cotizar-envio\route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cotizarEnvio } from '@/lib/correoargentino/micorreo'
import { calcularPesoCarritoGramos } from '@/lib/correoargentino/pesoCarrito'
import { CORREO_ARGENTINO_CP_ORIGEN, CORREO_ARGENTINO_CAJA_ESTANDAR } from '@/lib/config'

interface ItemCarrito {
  articuloId: number
  cantidad: number
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Body inválido' }, { status: 400 })

  const { items, cp } = body as { items: ItemCarrito[]; cp: string }

  if (!items || items.length === 0)
    return NextResponse.json({ error: 'El carrito está vacío' }, { status: 400 })
  if (!cp || !/^\d{4}$/.test(cp.trim()))
    return NextResponse.json({ error: 'Código postal inválido' }, { status: 400 })

  const admin = createAdminClient()

  try {
    const { pesoTotalGramos, algunPesoEstimado } = await calcularPesoCarritoGramos(admin, items)

    // Límite documentado de la API MiCorreo: 1g a 25000g por envío.
    if (pesoTotalGramos > 25000) {
      return NextResponse.json(
        { error: 'El pedido supera el peso máximo permitido para un solo envío (25kg). Contactanos para coordinarlo.' },
        { status: 409 }
      )
    }

    const cotizacion = await cotizarEnvio({
      postalCodeOrigin: CORREO_ARGENTINO_CP_ORIGEN,
      postalCodeDestination: cp.trim(),
      dimensions: {
        weight: Math.max(pesoTotalGramos, 1),
        height: CORREO_ARGENTINO_CAJA_ESTANDAR.alto,
        width: CORREO_ARGENTINO_CAJA_ESTANDAR.ancho,
        length: CORREO_ARGENTINO_CAJA_ESTANDAR.largo,
      },
    })

    return NextResponse.json({
      ok: true,
      pesoTotalGramos,
      pesoEstimado: algunPesoEstimado,
      opciones: cotizacion.rates,
      validoHasta: cotizacion.validTo,
    })
  } catch (error: any) {
    console.error('Error al cotizar envío MiCorreo:', error)
    return NextResponse.json(
      { error: 'No se pudo cotizar el envío en este momento. Probá de nuevo en un rato.' },
      { status: 502 }
    )
  }
}
