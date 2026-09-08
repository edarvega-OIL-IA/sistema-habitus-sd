// Ruta destino: C:\Users\Usuario\Documents\sistema-habitus-sd\src\app\api\tienda\cotizar-envio\route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cotizarEnvio } from '@/lib/correoargentino/micorreo'
import { CORREO_ARGENTINO_CP_ORIGEN, CORREO_ARGENTINO_CAJA_ESTANDAR, PESO_DEFECTO_GRAMOS } from '@/lib/config'

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
    // ── Peso real del carrito — nunca confiar en nada que mande el ──────
    // navegador. Se suma peso_kg × cantidad de cada artículo; los que no
    // tengan peso_kg cargado usan el piso de PESO_DEFECTO_GRAMOS (ver
    // lib/config.ts — regularizar esto es tarea pendiente, no bloqueante).
    const articuloIds = items.map(i => i.articuloId)
    const { data: articulos, error: artError } = await admin
      .from('articulos')
      .select('id, peso_kg')
      .in('id', articuloIds)

    if (artError) throw new Error('Error al leer artículos: ' + artError.message)

    const pesoMap = new Map((articulos || []).map((a: any) => [a.id, a.peso_kg]))
    let pesoTotalGramos = 0
    let algunPesoEstimado = false

    for (const item of items) {
      const pesoKg = pesoMap.get(item.articuloId)
      if (pesoKg && pesoKg > 0) {
        pesoTotalGramos += pesoKg * 1000 * item.cantidad
      } else {
        algunPesoEstimado = true
        pesoTotalGramos += PESO_DEFECTO_GRAMOS * item.cantidad
      }
    }

    pesoTotalGramos = Math.round(pesoTotalGramos)

    // Límites documentados de la API MiCorreo: 1g a 25000g por envío.
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
