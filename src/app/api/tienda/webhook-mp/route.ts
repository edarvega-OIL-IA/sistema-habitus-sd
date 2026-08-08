// Ruta destino: C:\Users\Usuario\Documents\sistema-habitus-sd\src\app\api\tienda\webhook-mp\route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fiscalizarVenta } from '@/lib/tusfacturas/fiscalizar'

// Cliente por defecto de toda venta web — mismo criterio que el POS
// automático (api/ventas/route.ts): Consumidor Final fijo. El DNI/CUIT
// capturado en el checkout queda en pedidos_web para una mejora futura.
const CLIENTE_ID_CONSUMIDOR_FINAL = 1

// Usuario "de sistema" creado para atribuir ventas generadas por el
// webhook (nadie del local está logueado cuando esto corre). No tiene uso
// de login real — ver ESTADO-PROYECTO.md, sesión de checkout Vitrina web.
const USUARIO_ID_VENTA_WEB = 'fc0aaa88-84a9-4cb3-a9e5-579db2dc9481'

const MEDIO_PAGO_QR_MP = 5
const EMISOR_MERCADO_PAGO = 7

async function procesarNotificacion(request: NextRequest) {
  const url = request.nextUrl
  let body: any = null
  try {
    body = await request.json()
  } catch {
    body = null
  }

  const tipo = body?.type ?? body?.topic ?? url.searchParams.get('type') ?? url.searchParams.get('topic')
  const paymentId =
    body?.data?.id ?? url.searchParams.get('data.id') ?? url.searchParams.get('id')

  // Solo nos interesan notificaciones de pago — cualquier otro tipo
  // (merchant_order, etc.) se confirma sin procesar.
  if (tipo !== 'payment' || !paymentId) {
    return NextResponse.json({ ok: true, ignorado: true })
  }

  const admin = createAdminClient()

  try {
    // ── Confirmar el pago consultando la API de MP — nunca confiar en el
    // payload del webhook solo, cualquiera puede pegarle a esta URL.
    const pagoResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
    })
    if (!pagoResponse.ok) {
      console.error('No se pudo confirmar el pago', paymentId, 'contra la API de MP')
      return NextResponse.json({ ok: true }) // ack igual, para que MP no reintente en loop
    }
    const pago = await pagoResponse.json()

    const pedidoId = Number(pago.external_reference)
    if (!pedidoId) {
      console.error('Pago', paymentId, 'sin external_reference válido')
      return NextResponse.json({ ok: true })
    }

    const { data: pedido, error: pedidoError } = await admin
      .from('pedidos_web')
      .select('*')
      .eq('id', pedidoId)
      .single()

    if (pedidoError || !pedido) {
      console.error('Pedido', pedidoId, 'no encontrado para el pago', paymentId)
      return NextResponse.json({ ok: true })
    }

    // Idempotencia — MP puede reenviar la misma notificación varias veces
    if (pedido.venta_id) {
      return NextResponse.json({ ok: true, yaProcesado: true })
    }

    if (pago.status !== 'approved') {
      await admin
        .from('pedidos_web')
        .update({ mercadopago_payment_id: String(paymentId), estado: 'pago_rechazado' })
        .eq('id', pedidoId)
        .eq('estado', 'pendiente_pago') // no pisar un estado ya resuelto
      return NextResponse.json({ ok: true })
    }

    // ── Re-chequeo de stock real al momento de la aprobación ────────────
    const items: any[] = pedido.items
    const articuloIds = items.map(i => i.articulo_id)
    const { data: stockData } = await admin
      .from('articulo_stock')
      .select('articulo_id, stock_actual')
      .eq('sucursal_id', pedido.sucursal_id)
      .in('articulo_id', articuloIds)
    const stockMap = new Map((stockData || []).map((s: any) => [s.articulo_id, s.stock_actual]))

    const sinStock = items.some(i => (stockMap.get(i.articulo_id) ?? 0) < i.cantidad)
    if (sinStock) {
      await admin
        .from('pedidos_web')
        .update({ mercadopago_payment_id: String(paymentId), estado: 'pago_sin_stock' })
        .eq('id', pedidoId)
      console.error('Pedido', pedidoId, 'pagado pero sin stock real — revisar reembolso manual en MP')
      return NextResponse.json({ ok: true })
    }

    // ── Crear la venta real — mismo patrón que api/ventas/route.ts ──────
    const { data: numeracion, error: numError } = await admin.rpc('incrementar_numero_venta', {
      p_sucursal_id: pedido.sucursal_id,
    })
    if (numError) throw new Error('Error al obtener numeración: ' + numError.message)

    const fechaHoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })

    const { data: venta, error: ventaError } = await admin
      .from('ventas')
      .insert({
        numero_venta: numeracion,
        cliente_id: CLIENTE_ID_CONSUMIDOR_FINAL,
        sucursal_id: pedido.sucursal_id,
        usuario_id: USUARIO_ID_VENTA_WEB,
        estado_venta_id: 1, // Fiscal — se fiscaliza a continuación
        descuento_pct: 0,
        subtotal: pedido.total,
        total: pedido.total,
        observaciones: `Pedido web #${pedido.id} — Mercado Pago`,
        fecha_utc: fechaHoy,
        cierre_turno_id: null, // no depende de una caja abierta
      })
      .select('id')
      .single()

    if (ventaError) throw new Error('Error al crear venta: ' + ventaError.message)

    const { data: costosData } = await admin
      .from('articulos')
      .select('id, costo_sin_iva')
      .in('id', articuloIds)
    const costosMap = new Map((costosData || []).map((a: any) => [a.id, a.costo_sin_iva]))

    const { error: itemsError } = await admin.from('venta_items').insert(
      items.map((item: any) => ({
        venta_id: venta.id,
        articulo_id: item.articulo_id,
        cantidad: item.cantidad,
        precio_unitario: item.precio_unitario,
        descuento_pct: 0,
        subtotal: item.subtotal,
        costo_unitario: costosMap.get(item.articulo_id) ?? null,
      }))
    )
    if (itemsError) throw new Error('Error al guardar items: ' + itemsError.message)

    const { error: pagoVentaError } = await admin.from('venta_pagos').insert({
      venta_id: venta.id,
      medio_pago_id: MEDIO_PAGO_QR_MP,
      emisor_pago_id: EMISOR_MERCADO_PAGO,
      monto: pedido.total,
      referencia: String(paymentId),
    })
    if (pagoVentaError) throw new Error('Error al guardar pago: ' + pagoVentaError.message)

    // Descontar stock — mismo mecanismo que Compras y el POS (trigger
    // fn_aplicar_item_stock vía movimiento_stock_items)
    const { data: movStock, error: movStockError } = await admin
      .from('movimientos_stock')
      .insert({
        sucursal_id: pedido.sucursal_id,
        tipo_movimiento_stock_id: 2, // Egreso
        estado_movimiento_stock_id: 2, // Confirmado
        origen_tipo: 'venta',
        origen_id: venta.id,
        observaciones: `Venta web #${numeracion} — pedido ${pedido.id}`,
        fecha_utc: fechaHoy,
      })
      .select('id')
      .single()

    if (movStockError) {
      console.error('Error al crear movimiento de stock para venta web', venta.id, ':', movStockError.message)
    } else {
      const { error: stockItemsError } = await admin.from('movimiento_stock_items').insert(
        items.map((item: any) => ({
          movimiento_stock_id: movStock.id,
          articulo_id: item.articulo_id,
          cantidad: item.cantidad,
        }))
      )
      if (stockItemsError) {
        console.error('Error al descontar stock de venta web', venta.id, ':', stockItemsError.message)
      }
    }

    // Movimiento financiero
    const { error: movError } = await admin.from('movimientos').insert({
      sucursal_id: pedido.sucursal_id,
      tipo: 'Ingreso',
      categoria_gasto_id: 10, // Ventas
      concepto_gasto_id: 35, // Venta local
      medio_pago_id: MEDIO_PAGO_QR_MP,
      monto: pedido.total,
      fecha_utc: fechaHoy,
      mes_contable: fechaHoy.slice(0, 7) + '-01',
      origen_tipo: 'venta',
      origen_id: venta.id,
      usuario_id: USUARIO_ID_VENTA_WEB,
    })
    if (movError) {
      console.error('Error al generar movimiento para venta web', venta.id, ':', movError.message)
    }

    // Marcamos el pedido como confirmado y enlazado a la venta ANTES de
    // fiscalizar — así una fiscalización lenta, que falle, o que corte la
    // función por timeout (plan Hobby de Vercel, límite ~10s) nunca deja
    // un pedido ya pagado pegado en "pendiente_pago" (bug real 08/08/2026,
    // el pedido #3 quedó así con la venta creada pero no enlazada).
    await admin
      .from('pedidos_web')
      .update({ estado: 'confirmado', venta_id: venta.id, mercadopago_payment_id: String(paymentId) })
      .eq('id', pedidoId)

    // Fiscalización — mismo pipeline que el POS y la pantalla manual.
    // Try/catch propio: un error o timeout acá nunca debe afectar la
    // respuesta al webhook ni lo que ya se confirmó arriba. Si falla,
    // queda para revisión manual en /fiscalizacion, igual que el POS.
    try {
      await fiscalizarVenta(venta.id, CLIENTE_ID_CONSUMIDOR_FINAL, true)
    } catch (fiscalError: any) {
      console.error('Fiscalización falló para venta web', venta.id, ':', fiscalError.message)
    }

    return NextResponse.json({ ok: true, ventaId: venta.id })
  } catch (error: any) {
    console.error('Error procesando webhook de Mercado Pago:', error)
    // 200 igual — si devolvemos error, MP reintenta indefinidamente y
    // multiplicaría ventas si el fallo fue después de crear la venta.
    // Los console.error quedan en los logs de Vercel para revisar a mano.
    return NextResponse.json({ ok: true, error: error.message })
  }
}

export async function POST(request: NextRequest) {
  return procesarNotificacion(request)
}

export async function GET(request: NextRequest) {
  return procesarNotificacion(request)
}
