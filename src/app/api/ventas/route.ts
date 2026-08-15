import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { fiscalizarVenta } from '@/lib/tusfacturas/fiscalizar'

// Cliente por defecto del POS de mostrador cuando no se selecciona uno
// puntual (venta común) — id=1, Consumidor Final.
const CLIENTE_ID_CONSUMIDOR_FINAL = 1

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: usuarioSistema } = await supabase
    .from('usuarios')
    .select('id, rol_id, sucursal_id')
    .eq('id', user.id)
    .single()

  if (!usuarioSistema) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 403 })

  const body = await request.json()
  const { items, pagos, descuento_pct, observaciones, fiscalizar, cliente_id } = body
  // Si el POS no manda cliente (venta normal de mostrador), Consumidor Final.
  const clienteIdVenta = cliente_id || CLIENTE_ID_CONSUMIDOR_FINAL

  if (!items || items.length === 0)
    return NextResponse.json({ error: 'La venta debe tener al menos un artículo' }, { status: 400 })
  if (!pagos || pagos.length === 0)
    return NextResponse.json({ error: 'La venta debe tener al menos un pago' }, { status: 400 })

  // Calcular totales
  const subtotal = items.reduce((sum: number, item: any) => {
    return sum + item.precio_unitario * item.cantidad * (1 - (item.descuento_pct || 0) / 100)
  }, 0)
  const total = subtotal * (1 - (descuento_pct || 0) / 100)
  const totalPagos = pagos.reduce((sum: number, p: any) => sum + p.monto, 0)

  // Si el pago no cubre el total → siempre error
  if (totalPagos < total - 1)
    return NextResponse.json({ error: 'El monto pagado no cubre el total' }, { status: 400 })

  // Si hay excedente (vuelto) solo se permite cuando hay efectivo entre los medios de pago
  const mediosPagoIds: number[] = pagos.map((p: any) => p.medio_pago_id)
  if (totalPagos > total + 1) {
    const { data: medios } = await supabase
      .from('medios_pago')
      .select('id, nombre')
      .in('id', mediosPagoIds)
    const tieneEfectivo = medios?.some(m => m.nombre === 'Efectivo') ?? false
    if (!tieneEfectivo)
      return NextResponse.json({ error: 'El monto debe coincidir con el total' }, { status: 400 })
  }

  try {
    // Obtener cierre de turno activo
    const { data: cierreActivo } = await supabase
      .from('cierres_turno')
      .select('id')
      .eq('sucursal_id', usuarioSistema.sucursal_id || 1)
      .eq('estado_cierre_turno_id', 1)
      .maybeSingle()

    const { data: numeracion, error: numError } = await supabase
      .rpc('incrementar_numero_venta', { p_sucursal_id: usuarioSistema.sucursal_id || 1 })

    if (numError) throw new Error('Error al obtener numeración: ' + numError.message)

    const fechaHoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })

    const { data: venta, error: ventaError } = await supabase
      .from('ventas')
      .insert({
        numero_venta: numeracion,
        cliente_id: clienteIdVenta,
        sucursal_id: usuarioSistema.sucursal_id || 1,
        usuario_id: user.id,
        estado_venta_id: fiscalizar ? 1 : 2,
        descuento_pct: descuento_pct || 0,
        subtotal,
        total,
        observaciones,
        fecha_utc: fechaHoy,
        cierre_turno_id: cierreActivo?.id || null,
      })
      .select('id')
      .single()

    if (ventaError) throw new Error('Error al crear venta: ' + ventaError.message)

    // Costo real al momento de esta venta (29/07) — se graba fijo en
    // venta_items.costo_unitario para que el margen de esta venta no
    // cambie después si el costo del artículo se actualiza con una compra
    // futura. Query separada (nunca join anidado, regla del proyecto).
    const articuloIdsVenta = items.map((item: any) => item.articulo_id)
    const { data: costosData } = await supabase
      .from('articulos')
      .select('id, costo_sin_iva')
      .in('id', articuloIdsVenta)
    const costosMap = new Map((costosData || []).map((a: any) => [a.id, a.costo_sin_iva]))

    const { error: itemsError } = await supabase
      .from('venta_items')
      .insert(items.map((item: any) => ({
        venta_id: venta.id,
        articulo_id: item.articulo_id,
        cantidad: item.cantidad,
        precio_unitario: item.precio_unitario,
        descuento_pct: item.descuento_pct || 0,
        subtotal: item.precio_unitario * item.cantidad * (1 - (item.descuento_pct || 0) / 100),
        costo_unitario: costosMap.get(item.articulo_id) ?? null,
      })))

    if (itemsError) throw new Error('Error al guardar items: ' + itemsError.message)

    const { error: pagosError } = await supabase
      .from('venta_pagos')
      .insert(pagos.map((pago: any) => ({
        venta_id: venta.id,
        medio_pago_id: pago.medio_pago_id,
        emisor_pago_id: pago.emisor_pago_id || null,
        monto: pago.monto,
        referencia: pago.referencia || null,
      })))

    if (pagosError) throw new Error('Error al guardar pagos: ' + pagosError.message)

    // Descontar stock: cabecera (movimientos_stock, tipo Egreso=2) + un
    // detalle por artículo (movimiento_stock_items). El trigger
    // fn_aplicar_item_stock descuenta articulo_stock automáticamente al
    // insertar cada fila de detalle — mismo mecanismo que ya usa Compras.
    const { data: movStock, error: movStockError } = await supabase
      .from('movimientos_stock')
      .insert({
        sucursal_id: usuarioSistema.sucursal_id || 1,
        tipo_movimiento_stock_id: 2, // Egreso
        estado_movimiento_stock_id: 2, // Confirmado
        origen_tipo: 'venta',
        origen_id: venta.id,
        observaciones: `Venta #${numeracion}`,
        fecha_utc: fechaHoy,
      })
      .select('id')
      .single()

    if (movStockError) {
      console.error('Error al crear movimiento de stock para venta', venta.id, ':', movStockError.message)
    } else {
      const { error: stockItemsError } = await supabase
        .from('movimiento_stock_items')
        .insert(items.map((item: any) => ({
          movimiento_stock_id: movStock.id,
          articulo_id: item.articulo_id,
          cantidad: item.cantidad,
        })))

      if (stockItemsError) {
        console.error('Error al descontar stock de venta', venta.id, ':', stockItemsError.message)
      }
    }

    // ── Movimiento financiero (ledger) — UNA FILA POR CADA MEDIO DE PAGO ────
    // BUG CORREGIDO (17/07/2026): antes se insertaba una sola fila con el
    // medio de pago del PRIMER ítem de "pagos" y el TOTAL completo de la
    // venta — en ventas con pago mixto (ej. parte Efectivo + parte
    // Transferencia) esto inflaba artificialmente el total declarado en el
    // primer medio, rompiendo la trazabilidad de efectivo en Movimientos.
    // Fix: se reparte proporcionalmente cada pago sobre el total real de la
    // venta (así el vuelto en efectivo, si lo hay, no infla el total —
    // "totalPagos" puede ser mayor a "total" cuando hay vuelto), y el
    // redondeo de centavos se absorbe en el último ítem para que la suma
    // de las filas coincida exactamente con "total".
    const factorProporcion = total / totalPagos
    let sumaAcumulada = 0
    const contribuciones = pagos.map((pago: any, i: number) => {
      let monto: number
      if (i === pagos.length - 1) {
        // Último pago: absorbe el redondeo para que la suma cierre exacta
        monto = Math.round((total - sumaAcumulada) * 100) / 100
      } else {
        monto = Math.round(pago.monto * factorProporcion * 100) / 100
        sumaAcumulada += monto
      }
      return { medio_pago_id: pago.medio_pago_id, monto }
    })

    const { error: movError } = await supabase
      .from('movimientos')
      .insert(contribuciones.map((c: { medio_pago_id: number; monto: number }) => ({
        sucursal_id: usuarioSistema.sucursal_id || 1,
        tipo: 'Ingreso',
        categoria_gasto_id: 10, // Ventas
        concepto_gasto_id: 35, // Venta local
        medio_pago_id: c.medio_pago_id,
        monto: c.monto,
        fecha_utc: fechaHoy,
        mes_contable: fechaHoy.slice(0, 7) + '-01',
        origen_tipo: 'venta',
        origen_id: venta.id,
        usuario_id: user.id,
      })))

    if (movError) {
      console.error('Error al generar movimiento para venta', venta.id, ':', movError.message)
    }

    // ── Fiscalización AFIP/ARCA vía TusFacturasAPP ──────────────────────────
    // Pipeline compartido con la pantalla manual de Fiscalización — ver
    // lib/tusfacturas/fiscalizar.ts. Gateado por FISCALIZACION_TUSFACTURAS_ACTIVA
    // (Vercel) adentro de esa misma función: mientras no esté en 'true', no
    // se llama a nada externo y la venta queda guardada con estado_venta_id=1
    // ("Fiscal", pendiente) si se tildó Fiscalizar.
    //
    // Cualquier error acá NUNCA revierte la venta — ya está guardada y
    // confirmada, fiscalizarVenta() se encarga de dejarla marcada para
    // revisión manual en /fiscalizacion si algo sale mal.
    let mensajeFiscal: string | null = null

    if (fiscalizar) {
      const resultado = await fiscalizarVenta(venta.id, clienteIdVenta, true)
      mensajeFiscal = resultado.ok
        ? resultado.mensaje
        : 'La venta se guardó pero la fiscalización no se completó — revisar en Fiscalización'
    }

    return NextResponse.json({
      ok: true,
      venta_id: venta.id,
      numero_venta: numeracion,
      mensaje: mensajeFiscal
        ?? (fiscalizar ? 'Venta registrada — factura en proceso' : 'Venta guardada'),
    })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
