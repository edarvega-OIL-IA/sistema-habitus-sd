// Ruta destino: C:\Users\Usuario\Documents\sistema-habitus-sd\src\lib\tusfacturas\fiscalizar.ts

import { createClient } from '@/lib/supabase/server'
import { fiscalizacionActiva, emitirFacturaC } from './emitir'
import { mapearVentaAFacturaC, VentaParaFacturar, PUNTO_VENTA_ID, TIPO_COMPROBANTE_ID_FACTURA } from './mapeo'
import { esRespuestaExitosa } from './tipos'

// Estados de estados_fiscales en producción (verificado por SELECT, no asumido)
const ESTADO_FISCAL_PENDIENTE = 1
const ESTADO_FISCAL_CAE_RECIBIDO = 3
const ESTADO_FISCAL_CAE_RECHAZADO = 4

export interface ResultadoFiscalizacion {
  ok: boolean
  mensaje: string
}

/**
 * Fiscaliza una venta ya existente ante ARCA/AFIP vía TusFacturasAPP.
 *
 * Usado por DOS caminos que antes tenían la lógica duplicada:
 *  1. El flujo automático del POS (api/ventas/route.ts), justo al confirmar
 *     la venta — cliente_id=1 (Consumidor Final), siempre contado.
 *  2. La pantalla manual de Fiscalización (api/fiscalizacion/route.ts) —
 *     para ventas Guardadas o Rechazadas, con cliente y forma de pago
 *     elegidos a mano.
 *
 * Si ya existe un comprobante para esta venta (reintento de un rechazo
 * previo), reutiliza el mismo número ya reservado — nunca pide uno nuevo
 * para la misma venta, para no desperdiciar numeración real ante ARCA.
 */
export async function fiscalizarVenta(
  ventaId: number,
  clienteId: number,
  esContado: boolean,
  // Cliente opcional — por defecto arma el cliente de servidor atado a la
  // sesión del usuario logueado (POS, pantalla manual). El webhook de
  // Mercado Pago no tiene ninguna sesión detrás (nadie está logueado
  // cuando corre), así que le pasa el cliente admin (Service Role) acá,
  // en vez de que esta función arme el suyo propio y todo quede bloqueado
  // por RLS en silencio (bug real 08/08/2026: devolvía "No se encontró la
  // venta" no porque no existiera, sino porque el cliente sin sesión no
  // tenía permiso para leerla).
  supabaseClient?: any,
): Promise<ResultadoFiscalizacion> {
  const supabase = supabaseClient ?? await createClient()

  if (!fiscalizacionActiva()) {
    return { ok: false, mensaje: 'La fiscalización está desactivada (FISCALIZACION_TUSFACTURAS_ACTIVA no está en "true")' }
  }

  const { data: venta, error: ventaError } = await supabase
    .from('ventas')
    .select('id, total, fecha_utc')
    .eq('id', ventaId)
    .single()
  if (ventaError || !venta) return { ok: false, mensaje: 'No se encontró la venta' }

  const { data: items, error: itemsError } = await supabase
    .from('venta_items')
    .select('articulo_id, cantidad, precio_unitario, descuento_pct')
    .eq('venta_id', ventaId)
  if (itemsError || !items || items.length === 0)
    return { ok: false, mensaje: 'La venta no tiene ítems cargados' }

  const { data: cliente, error: clienteError } = await supabase
    .from('clientes')
    .select('id, nombre, cuit, dni, domicilio, email, tiene_cuenta_corriente, plazo_dias_cta_cte, condiciones_iva ( nombre )')
    .eq('id', clienteId)
    .single()
  if (clienteError || !cliente) return { ok: false, mensaje: 'No se encontró el cliente' }

  // Query separada + merge por Map (nunca join anidado — regla del proyecto)
  const articuloIds = items.map((i: any) => i.articulo_id)
  const { data: articulosData } = await supabase
    .from('articulos')
    .select('id, nombre, codigo_interno')
    .in('id', articuloIds)
  const articulosMap = new Map((articulosData || []).map((a: any) => [a.id, a]))

  // ¿Ya existe un comprobante para esta venta? (reintento tras rechazo)
  const { data: comprobanteExistente } = await supabase
    .from('comprobantes')
    .select('id, numero, fiscalizacion_intentos')
    .eq('venta_id', ventaId)
    .maybeSingle()

  let comprobanteId: number
  let numeroFormateado: string
  let intentosPrevios = 0

  if (comprobanteExistente) {
    comprobanteId = comprobanteExistente.id
    numeroFormateado = String(comprobanteExistente.numero).padStart(8, '0')
    intentosPrevios = comprobanteExistente.fiscalizacion_intentos ?? 0
    await supabase
      .from('comprobantes')
      .update({ estado_fiscal_id: ESTADO_FISCAL_PENDIENTE, mensaje_error: null })
      .eq('id', comprobanteId)
  } else {
    const { data: proximoNumero, error: numError } = await supabase.rpc('obtener_proximo_numero_comprobante', {
      p_punto_venta_id: PUNTO_VENTA_ID,
      p_tipo_comprobante_id: TIPO_COMPROBANTE_ID_FACTURA,
    })
    if (numError) return { ok: false, mensaje: 'Error al obtener numeración: ' + numError.message }
    numeroFormateado = String(proximoNumero).padStart(8, '0')

    const { data: nuevoComprobante, error: insertError } = await supabase
      .from('comprobantes')
      .insert({
        venta_id: ventaId,
        tipo_comprobante_id: TIPO_COMPROBANTE_ID_FACTURA,
        punto_venta_id: PUNTO_VENTA_ID,
        numero: proximoNumero,
        estado_fiscal_id: ESTADO_FISCAL_PENDIENTE,
        fecha_emision_utc: new Date().toISOString(),
        total: venta.total,
        fiscalizacion_intentos: 0,
      })
      .select('id')
      .single()
    if (insertError || !nuevoComprobante)
      return { ok: false, mensaje: 'Error al crear comprobante: ' + insertError?.message }
    comprobanteId = nuevoComprobante.id
  }

  const condicionesIva = cliente.condiciones_iva as unknown as { nombre: string } | null

  const ventaParaFacturar: VentaParaFacturar = {
    venta_id: ventaId,
    fecha_utc: venta.fecha_utc,
    total: venta.total,
    cliente: {
      id: cliente.id,
      nombre: cliente.nombre,
      cuit: cliente.cuit,
      dni: cliente.dni,
      domicilio: cliente.domicilio,
      email: cliente.email,
      condicionIva: condicionesIva?.nombre ?? 'Consumidor Final',
      tieneCuentaCorriente: cliente.tiene_cuenta_corriente,
      plazoDiasCtaCte: cliente.plazo_dias_cta_cte,
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

  try {
    const jsonRequest = mapearVentaAFacturaC(ventaParaFacturar, numeroFormateado, { esContado })
    const respuesta = await emitirFacturaC(jsonRequest)

    if (esRespuestaExitosa(respuesta)) {
      const caeLimpio = respuesta.cae.trim() // TusFacturasAPP envía el CAE con un espacio al final
      await supabase
        .from('comprobantes')
        .update({
          estado_fiscal_id: ESTADO_FISCAL_CAE_RECIBIDO,
          factura_cae: caeLimpio,
          factura_cae_vencimiento: convertirFechaDDMMYYYYaISO(respuesta.vencimiento_cae),
          mensaje_error: null,
          fiscalizacion_intentos: intentosPrevios + 1,
        })
        .eq('id', comprobanteId)

      await supabase.from('ventas').update({ estado_venta_id: 4, cliente_id: clienteId }).eq('id', ventaId)

      return { ok: true, mensaje: `Factura C ${respuesta.comprobante_nro} — CAE ${caeLimpio}` }
    } else {
      const mensajeError = respuesta.errores?.join(' | ') || 'ARCA/TusFacturasAPP rechazó el comprobante sin detalle'
      console.error('TusFacturasAPP rechazó el comprobante de venta', ventaId, ':', respuesta.errores)

      await supabase
        .from('comprobantes')
        .update({
          estado_fiscal_id: ESTADO_FISCAL_CAE_RECHAZADO,
          mensaje_error: mensajeError,
          fiscalizacion_intentos: intentosPrevios + 1,
        })
        .eq('id', comprobanteId)

      // La venta queda en estado_venta_id=1 ("Fiscal", pendiente de revisión
      // manual) para que aparezca en la pantalla de Fiscalización.
      await supabase.from('ventas').update({ estado_venta_id: 1, cliente_id: clienteId }).eq('id', ventaId)

      return { ok: false, mensaje: mensajeError }
    }
  } catch (err: any) {
    const mensajeError = 'Error de red/sistema al llamar a TusFacturasAPP: ' + (err?.message || 'desconocido')
    console.error('Error en pipeline de fiscalización, venta', ventaId, ':', err?.message)

    await supabase
      .from('comprobantes')
      .update({
        estado_fiscal_id: ESTADO_FISCAL_CAE_RECHAZADO,
        mensaje_error: mensajeError,
        fiscalizacion_intentos: intentosPrevios + 1,
      })
      .eq('id', comprobanteId)

    await supabase.from('ventas').update({ estado_venta_id: 1, cliente_id: clienteId }).eq('id', ventaId)

    return { ok: false, mensaje: mensajeError }
  }
}

function convertirFechaDDMMYYYYaISO(fecha: string): string {
  const [dia, mes, anio] = fecha.split('/')
  return `${anio}-${mes}-${dia}`
}
