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

interface DireccionEnvio {
  calle: string
  numero: string
  localidad: string
  provincia: string
  cp: string
}

const METODOS_ENVIO_VALIDOS = ['retiro_local', 'envio_cinco_saltos'] as const
type MetodoEnvio = (typeof METODOS_ENVIO_VALIDOS)[number]

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Body inválido' }, { status: 400 })

  const {
    items,
    medioElegido,
    cliente,
    observaciones,
    metodoEnvio = 'retiro_local',
    direccion,
  } = body as {
    items: ItemCarrito[]
    medioElegido: 'mercado_pago' | 'retiro_efectivo'
    cliente: ClienteCheckout
    observaciones?: string
    metodoEnvio?: MetodoEnvio
    direccion?: DireccionEnvio
  }

  if (!items || items.length === 0)
    return NextResponse.json({ error: 'El carrito está vacío' }, { status: 400 })
  if (medioElegido !== 'mercado_pago' && medioElegido !== 'retiro_efectivo')
    return NextResponse.json({ error: 'Medio de pago inválido' }, { status: 400 })
  if (!cliente?.nombre || !cliente?.telefono)
    return NextResponse.json({ error: 'Nombre y teléfono son obligatorios' }, { status: 400 })
  if (!METODOS_ENVIO_VALIDOS.includes(metodoEnvio))
    return NextResponse.json({ error: 'Método de envío inválido' }, { status: 400 })
  if (metodoEnvio === 'envio_cinco_saltos' && (!direccion?.calle?.trim() || !direccion?.numero?.trim()))
    return NextResponse.json({ error: 'Falta la dirección de entrega' }, { status: 400 })
  if (metodoEnvio === 'envio_cinco_saltos' && medioElegido !== 'mercado_pago')
    return NextResponse.json({ error: 'El envío a domicilio se paga por adelantado con Mercado Pago' }, { status: 400 })

  const admin = createAdminClient()

  try {
    // ── Traer datos reales de los artículos — nunca confiar en precio ──────
    // ni disponibilidad que mande el navegador.
    const articuloIds = items.map(i => i.articuloId)
    const { data: articulos, error: artError } = await admin
      .from('articulos')
      .select('id, nombre, nombre_base, rubro_id, marca_id, precio_local, precio_web, precio_oferta_web, disponible_web, sabor_id')
      .in('id', articuloIds)

    if (artError) throw new Error('Error al leer artículos: ' + artError.message)

    const { data: sabores } = await admin.from('sabores').select('id, nombre')
    const saboresMap = new Map((sabores || []).map((s: any) => [s.id, s.nombre]))

    const { data: rubros } = await admin.from('rubros').select('id, nombre')
    const rubrosMap = new Map((rubros || []).map((r: any) => [r.id, r.nombre]))

    const { data: marcas } = await admin.from('marcas').select('id, nombre')
    const marcasMap = new Map((marcas || []).map((m: any) => [m.id, m.nombre]))

    const { data: stockData, error: stockError } = await admin
      .from('articulo_stock')
      .select('articulo_id, stock_actual')
      .eq('sucursal_id', SUCURSAL_ID)
      .in('articulo_id', articuloIds)

    if (stockError) throw new Error('Error al leer stock: ' + stockError.message)
    const stockMap = new Map((stockData || []).map((s: any) => [s.articulo_id, s.stock_actual]))

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
      const nombreArticulo = art.nombre_base ?? art.nombre
      if (!art.disponible_web) {
        errores.push(`${nombreArticulo} ya no está disponible`)
        continue
      }
      const stockReal = stockMap.get(item.articuloId) ?? 0
      if (stockReal < item.cantidad) {
        errores.push(`${nombreArticulo}: solo quedan ${stockReal} unidades`)
        continue
      }
      const precio = art.precio_oferta_web ?? art.precio_web ?? art.precio_local
      lineas.push({
        articulo_id: art.id,
        nombre_base: nombreArticulo,
        sabor: art.sabor_id ? saboresMap.get(art.sabor_id) ?? null : null,
        marca: art.marca_id ? marcasMap.get(art.marca_id) ?? null : null,
        rubro_nombre: rubrosMap.get(art.rubro_id) ?? null,
        cantidad: item.cantidad,
        precio_unitario: precio,
        subtotal: precio * item.cantidad,
      })
    }

    if (errores.length > 0)
      return NextResponse.json({ error: 'Hay artículos que cambiaron', detalles: errores }, { status: 409 })

    // ── Mínimo de compra por rubro completo (server-side, última línea de ──
    // defensa — cualquier combinación de productos y sabores del rubro cuenta
    // junta). Mismo criterio que el frontend en carrito/page.tsx.
    const totalesPorRubro = new Map<string, number>()
    for (const linea of lineas) {
      if (!linea.rubro_nombre || !(linea.rubro_nombre in MINIMOS_POR_RUBRO)) continue
      totalesPorRubro.set(
        linea.rubro_nombre,
        (totalesPorRubro.get(linea.rubro_nombre) || 0) + linea.cantidad
      )
    }
    for (const [rubroNombre, cantidadTotal] of totalesPorRubro.entries()) {
      const minimo = MINIMOS_POR_RUBRO[rubroNombre]
      if (cantidadTotal < minimo) {
        const faltante = minimo - cantidadTotal
        return NextResponse.json(
          {
            error: `${rubroNombre}: tenés ${cantidadTotal} ${cantidadTotal === 1 ? 'unidad' : 'unidades'}, el mínimo es ${minimo} — faltan ${faltante}.`,
          },
          { status: 400 }
        )
      }
    }

    const subtotalMercaderia = lineas.reduce((sum, l) => sum + l.subtotal, 0)

    // ── Costo de envío — SIEMPRE recalculado server-side contra la config ──
    // vigente en configuracion_envios. Nunca se confía en un monto que
    // mande el navegador (podría estar desactualizado, o directamente
    // manipulado).
    let costoEnvio = 0
    if (metodoEnvio === 'envio_cinco_saltos') {
      const { data: config, error: configError } = await admin
        .from('configuracion_envios')
        .select('tarifa_cinco_saltos, envio_cinco_saltos_activo')
        .eq('id', 1)
        .single()

      if (configError || !config) throw new Error('No se pudo leer la configuración de envíos')
      if (!config.envio_cinco_saltos_activo)
        return NextResponse.json(
          { error: 'El envío en Cinco Saltos no está disponible en este momento. Elegí "Retiro en local".' },
          { status: 409 }
        )
      costoEnvio = config.tarifa_cinco_saltos
    }

    const total = subtotalMercaderia + costoEnvio

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
        observaciones: observaciones?.trim() ? observaciones.trim().slice(0, 300) : null,
        metodo_envio: metodoEnvio,
        costo_envio: costoEnvio,
        ...(metodoEnvio === 'envio_cinco_saltos' && direccion
          ? {
              direccion_calle: direccion.calle.trim(),
              direccion_numero: direccion.numero.trim(),
              direccion_localidad: direccion.localidad,
              direccion_provincia: direccion.provincia,
              direccion_cp: direccion.cp,
            }
          : {}),
      })
      .select('id')
      .single()

    if (pedidoError) throw new Error('Error al crear el pedido: ' + pedidoError.message)

    if (medioElegido === 'retiro_efectivo') {
      return NextResponse.json({ ok: true, pedidoId: pedido.id })
    }

    // ── Mercado Pago: generar la Preference (Checkout Pro) ──────────────
    const origin = request.nextUrl.origin
    const itemsPreference: any[] = lineas.map(l => ({
      title: l.sabor ? `${l.nombre_base} - ${l.sabor}` : l.nombre_base,
      quantity: l.cantidad,
      unit_price: l.precio_unitario,
      currency_id: 'ARS',
    }))
    if (costoEnvio > 0) {
      itemsPreference.push({
        title: 'Envío a domicilio — Cinco Saltos',
        quantity: 1,
        unit_price: costoEnvio,
        currency_id: 'ARS',
      })
    }

    const preferenceBody = {
      items: itemsPreference,
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
