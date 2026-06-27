import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

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
  const { items, pagos, descuento_pct, observaciones, fiscalizar } = body

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
        cliente_id: 1,
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

    const { error: itemsError } = await supabase
      .from('venta_items')
      .insert(items.map((item: any) => ({
        venta_id: venta.id,
        articulo_id: item.articulo_id,
        cantidad: item.cantidad,
        precio_unitario: item.precio_unitario,
        descuento_pct: item.descuento_pct || 0,
        subtotal: item.precio_unitario * item.cantidad * (1 - (item.descuento_pct || 0) / 100),
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

    const { error: movError } = await supabase
      .from('movimientos')
      .insert({
        sucursal_id: usuarioSistema.sucursal_id || 1,
        tipo: 'Ingreso',
        categoria_gasto_id: 10,
        concepto_gasto_id: null,
        medio_pago_id: pagos[0].medio_pago_id,
        monto: total,
        fecha_utc: fechaHoy,
        mes_contable: fechaHoy.slice(0, 7) + '-01',
        origen_tipo: 'venta',
        origen_id: venta.id,
        usuario_id: user.id,
      })

    if (movError) console.error('Error al generar movimiento:', movError.message)

    if (fiscalizar) {
      const { error: compError } = await supabase
        .from('comprobantes')
        .insert({
          venta_id: venta.id,
          tipo_comprobante_id: 1,
          punto_venta_id: 1,
          estado_fiscal_id: 1,
          fecha_emision_utc: new Date().toISOString(),
          total,
          fiscalizacion_intentos: 0,
          impreso_enviado: false,
        })

      if (compError) console.error('Error al crear comprobante:', compError.message)
    }

    return NextResponse.json({
      ok: true,
      venta_id: venta.id,
      numero_venta: numeracion,
      mensaje: fiscalizar
        ? 'Venta registrada — factura en proceso'
        : 'Venta guardada',
    })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
