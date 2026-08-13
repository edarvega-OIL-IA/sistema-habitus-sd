// Ruta destino: C:\Users\Usuario\Documents\sistema-habitus-sd\src\lib\tusfacturas\notaCredito.ts

import { fiscalizacionActiva, emitirFacturaC } from './emitir'
import {
  mapearVentaANotaCreditoC,
  VentaParaFacturar,
  PUNTO_VENTA_ID,
  TIPO_COMPROBANTE_ID_NOTA_CREDITO,
  TIPO_COMPROBANTE_ID_FACTURA,
} from './mapeo'
import { esRespuestaExitosa } from './tipos'

const ESTADO_FISCAL_PENDIENTE = 1
const ESTADO_FISCAL_CAE_RECIBIDO = 3
const ESTADO_FISCAL_CAE_RECHAZADO = 4
const ESTADO_VENTA_ANULADA = 3 // mismo estado que usa anularVenta() en Registro de Ventas (Caso A)

export interface ResultadoNotaCredito {
  ok: boolean
  mensaje: string
}

/**
 * Emite una Nota de Crédito C que anula por el TOTAL COMPLETO una venta ya
 * fiscalizada (Caso B — venta con CAE, no se puede editar directamente).
 * Decisión de diseño acordada: siempre NC total, nunca parcial — si la
 * venta corregida requiere una nueva Factura, esa se genera aparte, con la
 * fiscalización normal (POS o pantalla manual), como una venta nueva.
 *
 * A diferencia de fiscalizarVenta(), esto SIEMPRE requiere un cliente con
 * sesión real (se dispara desde una acción explícita de un usuario logueado
 * en Registro de Ventas o Correcciones) — no tiene el caso de uso de un
 * webhook sin sesión detrás.
 *
 * NO mueve dinero real (venta_pagos / movimientos financieros) — solo
 * revierte stock y anula la venta. Si el caso real implica devolver plata
 * al cliente, o si el cobro ya hecho se aplica a la venta nueva/corregida,
 * eso es una decisión que el usuario define aparte (mismo criterio dual que
 * ya existe en EditarItemsVentaModal: "cobrar/devolver ahora" vs "ajuste
 * contable sin mover plata") — pendiente de decidir antes de automatizarlo.
 */
export async function emitirNotaCreditoVenta(
  ventaId: number,
  supabaseClient: any,
): Promise<ResultadoNotaCredito> {
  const supabase = supabaseClient

  if (!fiscalizacionActiva()) {
    return { ok: false, mensaje: 'La fiscalización está desactivada (FISCALIZACION_TUSFACTURAS_ACTIVA no está en "true")' }
  }

  const { data: venta, error: ventaError } = await supabase
    .from('ventas')
    .select('id, total, fecha_utc, estado_venta_id, sucursal_id, cliente_id')
    .eq('id', ventaId)
    .single()
  if (ventaError || !venta) return { ok: false, mensaje: 'No se encontró la venta' }

  if (venta.estado_venta_id !== 4) {
    return { ok: false, mensaje: 'Solo se puede emitir una Nota de Crédito para una venta Fiscalizada (con CAE)' }
  }

  // Comprobante original — la Factura con CAE que se va a anular
  const { data: comprobanteOriginal, error: compError } = await supabase
    .from('comprobantes')
    .select('id, numero, factura_cae, fecha_emision_utc')
    .eq('venta_id', ventaId)
    .eq('tipo_comprobante_id', TIPO_COMPROBANTE_ID_FACTURA)
    .maybeSingle()

  if (compError || !comprobanteOriginal)
    return { ok: false, mensaje: 'No se encontró el comprobante original de esta venta' }
  if (!comprobanteOriginal.factura_cae)
    return { ok: false, mensaje: 'El comprobante original no tiene CAE — no hay nada real que anular ante ARCA' }

  // ¿Ya existe una NC emitida para esta venta? — no duplicar
  const { data: ncExistente } = await supabase
    .from('comprobantes')
    .select('id, numero, factura_cae, fiscalizacion_intentos')
    .eq('venta_id', ventaId)
    .eq('tipo_comprobante_id', TIPO_COMPROBANTE_ID_NOTA_CREDITO)
    .maybeSingle()

  if (ncExistente?.factura_cae) {
    return { ok: false, mensaje: 'Esta venta ya tiene una Nota de Crédito emitida con CAE' }
  }

  const { data: cliente, error: clienteError } = await supabase
    .from('clientes')
    .select('id, nombre, cuit, dni, domicilio, email, tiene_cuenta_corriente, plazo_dias_cta_cte, condiciones_iva ( nombre )')
    .eq('id', venta.cliente_id)
    .single()
  if (clienteError || !cliente) return { ok: false, mensaje: 'No se encontró el cliente de la venta' }

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
    items: [], // no se usa en el mapeo de NC — un único renglón de anulación
  }

  // Reservar (o reutilizar, si es reintento de un rechazo previo) el
  // número de NC — mismo criterio que fiscalizarVenta con las Facturas.
  let comprobanteNCId: number
  let numeroNCFormateado: string
  let intentosPrevios = 0

  if (ncExistente) {
    comprobanteNCId = ncExistente.id
    numeroNCFormateado = String(ncExistente.numero).padStart(8, '0')
    intentosPrevios = ncExistente.fiscalizacion_intentos ?? 0
    await supabase
      .from('comprobantes')
      .update({ estado_fiscal_id: ESTADO_FISCAL_PENDIENTE, mensaje_error: null })
      .eq('id', comprobanteNCId)
  } else {
    const { data: proximoNumero, error: numError } = await supabase.rpc('obtener_proximo_numero_comprobante', {
      p_punto_venta_id: PUNTO_VENTA_ID,
      p_tipo_comprobante_id: TIPO_COMPROBANTE_ID_NOTA_CREDITO,
    })
    if (numError) return { ok: false, mensaje: 'Error al obtener numeración de NC: ' + numError.message }
    numeroNCFormateado = String(proximoNumero).padStart(8, '0')

    const { data: nuevoComprobante, error: insertError } = await supabase
      .from('comprobantes')
      .insert({
        venta_id: ventaId,
        tipo_comprobante_id: TIPO_COMPROBANTE_ID_NOTA_CREDITO,
        punto_venta_id: PUNTO_VENTA_ID,
        numero: proximoNumero,
        comprobante_asociado_id: comprobanteOriginal.id,
        estado_fiscal_id: ESTADO_FISCAL_PENDIENTE,
        fecha_emision_utc: new Date().toISOString(),
        total: venta.total,
        fiscalizacion_intentos: 0,
      })
      .select('id')
      .single()
    if (insertError || !nuevoComprobante)
      return { ok: false, mensaje: 'Error al crear comprobante de NC: ' + insertError?.message }
    comprobanteNCId = nuevoComprobante.id
  }

  try {
    const jsonRequest = mapearVentaANotaCreditoC(
      ventaParaFacturar,
      {
        numero: comprobanteOriginal.numero,
        fecha_utc: (comprobanteOriginal.fecha_emision_utc || venta.fecha_utc).slice(0, 10),
      },
      numeroNCFormateado,
      { esContado: true },
    )
    const respuesta = await emitirFacturaC(jsonRequest) // mismo endpoint genérico — sirve para cualquier tipo de comprobante

    if (esRespuestaExitosa(respuesta)) {
      const caeLimpio = respuesta.cae.trim()
      await supabase
        .from('comprobantes')
        .update({
          estado_fiscal_id: ESTADO_FISCAL_CAE_RECIBIDO,
          factura_cae: caeLimpio,
          factura_cae_vencimiento: convertirFechaDDMMYYYYaISO(respuesta.vencimiento_cae),
          mensaje_error: null,
          fiscalizacion_intentos: intentosPrevios + 1,
        })
        .eq('id', comprobanteNCId)

      // Revertir stock — misma mecánica que anularVenta() (Caso A): un
      // movimiento_stock de Ingreso compensatorio vía el trigger, nunca
      // UPDATE directo a articulo_stock.
      const { data: items } = await supabase
        .from('venta_items')
        .select('articulo_id, cantidad')
        .eq('venta_id', ventaId)

      if (items && items.length > 0) {
        const fechaHoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
        const { data: movStock, error: movStockError } = await supabase
          .from('movimientos_stock')
          .insert({
            sucursal_id: venta.sucursal_id,
            tipo_movimiento_stock_id: 1, // Ingreso
            estado_movimiento_stock_id: 2, // Confirmado
            origen_tipo: 'venta',
            origen_id: venta.id,
            observaciones: `Reversión de stock por Nota de Crédito — venta #${venta.id}`,
            fecha_utc: fechaHoy,
          })
          .select('id')
          .single()

        if (movStockError) {
          console.error('Error al revertir stock tras NC de venta', ventaId, ':', movStockError.message)
        } else {
          await supabase.from('movimiento_stock_items').insert(
            items.map((it: any) => ({
              movimiento_stock_id: movStock.id,
              articulo_id: it.articulo_id,
              cantidad: it.cantidad,
            }))
          )
        }
      }

      await supabase.from('ventas').update({ estado_venta_id: ESTADO_VENTA_ANULADA }).eq('id', ventaId)

      return {
        ok: true,
        mensaje: `Nota de Crédito C ${respuesta.comprobante_nro} — CAE ${caeLimpio}. Venta anulada y stock revertido.`,
      }
    } else {
      const mensajeError = respuesta.errores?.join(' | ') || 'ARCA/TusFacturasAPP rechazó la Nota de Crédito sin detalle'
      console.error('TusFacturasAPP rechazó la NC de la venta', ventaId, ':', respuesta.errores)

      await supabase
        .from('comprobantes')
        .update({
          estado_fiscal_id: ESTADO_FISCAL_CAE_RECHAZADO,
          mensaje_error: mensajeError,
          fiscalizacion_intentos: intentosPrevios + 1,
        })
        .eq('id', comprobanteNCId)

      return { ok: false, mensaje: mensajeError }
    }
  } catch (err: any) {
    const mensajeError = 'Error de red/sistema al llamar a TusFacturasAPP: ' + (err?.message || 'desconocido')
    console.error('Error en pipeline de NC, venta', ventaId, ':', err?.message)

    await supabase
      .from('comprobantes')
      .update({
        estado_fiscal_id: ESTADO_FISCAL_CAE_RECHAZADO,
        mensaje_error: mensajeError,
        fiscalizacion_intentos: intentosPrevios + 1,
      })
      .eq('id', comprobanteNCId)

    return { ok: false, mensaje: mensajeError }
  }
}

function convertirFechaDDMMYYYYaISO(fecha: string): string {
  const [dia, mes, anio] = fecha.split('/')
  return `${anio}-${mes}-${dia}`
}
