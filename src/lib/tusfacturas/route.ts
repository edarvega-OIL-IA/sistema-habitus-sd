import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { fiscalizacionActiva, emitirFacturaC } from '@/lib/tusfacturas/emitir'
import { mapearVentaAFacturaC, VentaParaFacturar, PUNTO_VENTA_ID, TIPO_COMPROBANTE_ID_FACTURA } from '@/lib/tusfacturas/mapeo'
import { esRespuestaExitosa } from '@/lib/tusfacturas/tipos'

// Estados de estados_fiscales en producción (verificado por SELECT, no asumido)
const ESTADO_FISCAL_PENDIENTE = 1
const ESTADO_FISCAL_CAE_RECIBIDO = 3
const ESTADO_FISCAL_CAE_RECHAZADO = 4

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

    const { error: movError } = await supabase
      .from('movimientos')
      .insert({
        sucursal_id: usuarioSistema.sucursal_id || 1,
        tipo: 'Ingreso',
        categoria_gasto_id: 10, // Ventas
        concepto_gasto_id: 35, // Venta local
        medio_pago_id: pagos[0].medio_pago_id,
        monto: total,
        fecha_utc: fechaHoy,
        mes_contable: fechaHoy.slice(0, 7) + '-01',
        origen_tipo: 'venta',
        origen_id: venta.id,
        usuario_id: user.id,
      })

    if (movError) {
      console.error('Error al generar movimiento para venta', venta.id, ':', movError.message)
    }

    // ── Fiscalización AFIP/ARCA vía TusFacturasAPP ──────────────────────────
    // Gateado por FISCALIZACION_TUSFACTURAS_ACTIVA (Vercel). Mientras esa
    // variable no esté en 'true', este bloque no se ejecuta y el
    // comportamiento es idéntico al que ya está en producción: la venta
    // queda guardada con estado_venta_id=1 ("Fiscal", pendiente) si se
    // tildó Fiscalizar, sin ningún llamado externo.
    let mensajeFiscal: string | null = null

    if (fiscalizar && fiscalizacionActiva()) {
      try {
        // 1) Reservar el próximo número de comprobante (consume numeración real)
        const { data: proximoNumero, error: numComprobanteError } = await supabase
          .rpc('obtener_proximo_numero_comprobante', {
            p_punto_venta_id: PUNTO_VENTA_ID,
            p_tipo_comprobante_id: TIPO_COMPROBANTE_ID_FACTURA,
          })

        if (numComprobanteError) throw new Error('Error al obtener numeración de comprobante: ' + numComprobanteError.message)

        const numeroFormateado = String(proximoNumero).padStart(8, '0')

        // 2) Insertar comprobante en estado Pendiente ANTES de llamar a la API
        //    (si el request falla, el número queda documentado como consumido —
        //    nunca se vuelve a pedir uno nuevo para reintentar la misma venta)
        const { data: comprobante, error: comprobanteInsertError } = await supabase
          .from('comprobantes')
          .insert({
            venta_id: venta.id,
            tipo_comprobante_id: TIPO_COMPROBANTE_ID_FACTURA,
            punto_venta_id: PUNTO_VENTA_ID,
            numero: proximoNumero,
            estado_fiscal_id: ESTADO_FISCAL_PENDIENTE,
            fecha_emision_utc: new Date().toISOString(),
            total,
            fiscalizacion_intentos: 0,
          })
          .select('id')
          .single()

        if (comprobanteInsertError) throw new Error('Error al crear comprobante: ' + comprobanteInsertError.message)

        // 3) Traer datos del cliente (hoy siempre id=1, Consumidor Final —
        //    preparado para cuando el POS permita cargar cliente real)
        const { data: clienteData } = await supabase
          .from('clientes')
          .select('nombre, cuit, dni, domicilio, email')
          .eq('id', 1)
          .single()

        // 4) Traer nombre/código de cada artículo (query separada, nunca join anidado)
        const articuloIds = items.map((item: any) => item.articulo_id)
        const { data: articulosData } = await supabase
          .from('articulos')
          .select('id, nombre, codigo_interno')
          .in('id', articuloIds)

        const articulosMap = new Map((articulosData || []).map(a => [a.id, a]))

        const ventaParaFacturar: VentaParaFacturar = {
          venta_id: venta.id,
          fecha_utc: fechaHoy,
          total,
          cliente: {
            cuit: clienteData?.cuit ?? null,
            dni: clienteData?.dni ?? null,
            nombre: clienteData?.nombre || 'Consumidor Final',
            domicilio: clienteData?.domicilio ?? null,
            email: clienteData?.email ?? null,
          },
          items: items.map((item: any) => {
            const articulo = articulosMap.get(item.articulo_id)
            return {
              articulo_nombre: articulo?.nombre || 'Artículo',
              articulo_codigo: articulo?.codigo_interno || String(item.articulo_id),
              cantidad: item.cantidad,
              subtotal: item.precio_unitario * item.cantidad * (1 - (item.descuento_pct || 0) / 100),
            }
          }),
        }

        const jsonRequest = mapearVentaAFacturaC(ventaParaFacturar, numeroFormateado)
        const respuesta = await emitirFacturaC(jsonRequest)

        if (esRespuestaExitosa(respuesta)) {
          // 5a) Éxito: CAE recibido
          const caeLimpio = respuesta.cae.trim() // TusFacturasAPP envía el CAE con un espacio al final
          await supabase
            .from('comprobantes')
            .update({
              estado_fiscal_id: ESTADO_FISCAL_CAE_RECIBIDO,
              factura_cae: caeLimpio,
              factura_cae_vencimiento: convertirFechaDDMMYYYYaISO(respuesta.vencimiento_cae),
              fiscalizacion_intentos: 1,
            })
            .eq('id', comprobante.id)

          await supabase
            .from('ventas')
            .update({ estado_venta_id: 4 }) // Fiscalizada
            .eq('id', venta.id)

          mensajeFiscal = `Factura C ${respuesta.comprobante_nro} — CAE ${caeLimpio}`
        } else {
          // 5b) Error: queda documentado, sin tocar estado_venta_id (sigue en 1=Fiscal, pendiente de revisión manual)
          console.error('TusFacturasAPP rechazó el comprobante de venta', venta.id, ':', respuesta.errores)

          await supabase
            .from('comprobantes')
            .update({
              estado_fiscal_id: ESTADO_FISCAL_CAE_RECHAZADO,
              fiscalizacion_intentos: 1,
            })
            .eq('id', comprobante.id)

          mensajeFiscal = 'La venta se guardó pero la fiscalización fue rechazada — revisar manualmente'
        }
      } catch (fiscalError: any) {
        // Cualquier error en este bloque NUNCA revierte la venta —
        // la venta ya está guardada y confirmada, solo queda pendiente de fiscalizar.
        console.error('Error en pipeline de fiscalización, venta', venta.id, ':', fiscalError.message)
        mensajeFiscal = 'La venta se guardó pero hubo un error al fiscalizar — revisar manualmente'
      }
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

function convertirFechaDDMMYYYYaISO(fecha: string): string {
  const [dia, mes, anio] = fecha.split('/')
  return `${anio}-${mes}-${dia}`
}
