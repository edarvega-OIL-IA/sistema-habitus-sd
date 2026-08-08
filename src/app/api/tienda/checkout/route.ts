// Ruta destino: C:\Users\Usuario\Documents\sistema-habitus-sd\src\app\api\tienda\checkout\route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { MINIMOS_POR_RUBRO } from '@/lib/tienda/config'

const SUCURSAL_ID = 1 // única sucursal existente hoy

interface ItemCarrito {
  articuloId: number
  cantidad: number
}

interface ClienteCheckout {
  nombre: string
  telefono: string
  email?: string
  dni?: string
  cuit?: string
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Body inválido' }, { status: 400 })

  const { items, medioElegido, cliente } = body as {
    items: ItemCarrito[]
    medioElegido: 'mercado_pago' | 'retiro_efectivo'
    cliente: ClienteCheckout
  }

  if (!items || items.length === 0)
    return NextResponse.json({ error: 'El carrito está vacío' }, { status: 400 })
  if (medioElegido !== 'mercado_pago' && medioElegido !== 'retiro_efectivo')
    return NextResponse.json({ error: 'Medio de pago inválido' }, { status: 400 })
  if (!cliente?.nombre || !cliente?.telefono)
    return NextResponse.json({ error: 'Nombre y teléfono son obligatorios' }, { status: 400 })

  const admin = createAdminClient()

  try {
    // ── Traer datos reales de los artículos — nunca confiar en precio ──────
    // ni disponibilidad que mande el navegador.
    const articuloIds = items.map(i => i.articuloId)
    const { data: articulos, error: artError } = await admin
      .from('articulos')
      .select('id, nombre_base, rubro_id, precio_local, precio_web, precio_oferta_web, disponible_web, sabor_id')
      .in('id', articuloIds)

    if (artError) throw new Error('Error al leer artículos: ' + artError.message)

    const { data: sabores } = await admin.from('sabores').select('id, nombre')
    const saboresMap = new Map((sabores || []).map((s: any) => [s.id, s.nombre]))

    const { data: rubros } = await admin.from('rubros').select('id, nombre')
    const rubrosMap = new Map((rubros || []).map((r: any) => [r.id, r.nombre]))

    const { data: stockData, error: stockError } = await admin
      .from('articulo_stock')
      .select('articulo_id, stock')
      .eq('sucursal_id', SUCURSAL_ID)
      .in('articulo_id', articuloIds)

    if (stockError) throw new Error('Error al leer stock: ' + stockError.message)
    const stockMap = new Map((stockData || []).map((s: any) => [s.articulo_id, s.stock]))

    const articulosMap = new Map((articulos || []).map((a: any) => [a.id, a]))

    // ── Armar cada línea con precio/stock reales, validando en el camino ───
    const lineas: any[] = []
    const errores: string[] = []

    for (const item of items) {
      const art = articulosMap.get(item.articuloId)
      if (!art) {
        errores.push(`Artículo ${item.articuloId} ya no existe en el catálogo`)
        continue
      }
      if (!art.disponible_web) {
        errores.push(`${art.nombre_base} ya no está disponible`)
        continue
      }
      const stockReal = stockMap.get(item.articuloId) ?? 0
      if (stockReal < item.cantidad) {
        errores.push(`${art.nombre_base}: solo quedan ${stockReal} unidades`)
        continue
      }
      const precio = art.precio_oferta_web ?? art.precio_web ?? art.precio_local
      lineas.push({
        articulo_id: art.id,
        nombre_base: art.nombre_base,
        sabor: art.sabor_id ? saboresMap.get(art.sabor_id) ?? null : null,
        rubro_nombre: rubrosMap.get(art.rubro_id) ?? null,
        cantidad: item.cantidad,
        precio_unitario: precio,
        subtotal: precio * item.cantidad,
      })
    }

    if (errores.length > 0)
      return NextResponse.json({ error: 'Hay artículos que cambiaron', detalles: errores }, { status: 409 })

    // ── Mínimo de compra por rubro (server-side, no solo el aviso visual) ──
    const totalesPorRubroYBase = new Map<string, number>()
    for (const linea of lineas) {
      if (!linea.rubro_nombre || !(linea.rubro_nombre in MINIMOS_POR_RUBRO)) continue
      const clave = `${linea.rubro_nombre}::${linea.nombre_base}`
      totalesPorRubroYBase.set(clave, (totalesPorRubroYBase.get(clave) || 0) + linea.cantidad)
    }
    for (const [clave, cantidadTotal] of totalesPorRubroYBase.entries()) {
      const [rubroNombre, nombreBase] = clave.split('::')
      const minimo = MINIMOS_POR_RUBRO[rubroNombre]
      if (cantidadTotal < minimo)
        return NextResponse.json(
          { error: `${nombreBase} requiere un mínimo de ${minimo} unidades (mezclando sabores)` },
          { status: 409 }
        )
    }

    const total = lineas.reduce((sum, l) => sum + l.subtotal, 0)

    // ── Crear el pedido ──────────────────────────────────────────────────
    const { data: pedido, error: pedidoError } = await admin
      .from('pedidos_web')
      .insert({
        sucursal_id: SUCURSAL_ID,
        estado: medioElegido === 'mercado_pago' ? 'pendiente_pago' : 'pendiente_retiro',
        medio_elegido: medioElegido,
        cliente_nombre: cliente.nombre,
        cliente_telefono: cliente.telefono,
        cliente_email: cliente.email || null,
        cliente_dni: cliente.dni || null,
        cliente_cuit: cliente.cuit || null,
        items: lineas,
        total,
      })
      .select('id')
      .single()

    if (pedidoError) throw new Error('Error al crear el pedido: ' + pedidoError.message)

    if (medioElegido === 'retiro_efectivo') {
      return NextResponse.json({ ok: true, pedidoId: pedido.id })
    }

    // ── Mercado Pago: generar la Preference (Checkout Pro) ──────────────
    const origin = request.nextUrl.origin
    const preferenceBody = {
      items: lineas.map(l => ({
        title: l.sabor ? `${l.nombre_base} - ${l.sabor}` : l.nombre_base,
        quantity: l.cantidad,
        unit_price: l.precio_unitario,
        currency_id: 'ARS',
      })),
      external_reference: String(pedido.id),
      notification_url: `${origin}/api/tienda/webhook-mp`,
      back_urls: {
        success: `${origin}/tienda/pedido-confirmado?pedido=${pedido.id}`,
        pending: `${origin}/tienda/pedido-confirmado?pedido=${pedido.id}`,
        failure: `${origin}/tienda/carrito?pago=fallido`,
      },
      auto_return: 'approved',
    }

    const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(preferenceBody),
    })

    const mpData = await mpResponse.json()

    if (!mpResponse.ok) {
      console.error('Error de Mercado Pago al crear preference:', mpData)
      return NextResponse.json({ error: 'No se pudo iniciar el pago con Mercado Pago' }, { status: 502 })
    }

    await admin
      .from('pedidos_web')
      .update({ mercadopago_preference_id: mpData.id })
      .eq('id', pedido.id)

    return NextResponse.json({ ok: true, pedidoId: pedido.id, redirectUrl: mpData.init_point })
  } catch (error: any) {
    console.error('Error en checkout de tienda:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
