// Ruta destino: C:\Users\Usuario\Documents\sistema-habitus-sd\src\lib\tusfacturas\mapeo.ts

import { TusFacturasComprobante, TusFacturasDetalleItem, TusFacturasRequestBody, TusFacturasCliente } from './tipos'

const PUNTO_VENTA = '0004'
const RUBRO = 'Suplementos deportivos'

// IDs en producción — puntos_venta.id=3 (PV 0004), tipos_comprobante.id=1 (Factura)
export const PUNTO_VENTA_ID = 3
export const TIPO_COMPROBANTE_ID_FACTURA = 1

// Datos fijos del emisor para clientes sin CUIT/DNI cargado (Consumidor Final sin especificar datos).
// Documentación TusFacturasAPP: documento_tipo="OTRO", documento_nro="0".
// "condicion_pago" usa la tabla de referencia de TusFacturasAPP, no la nuestra: "201" = Contado.
const CONDICION_PAGO_CONTADO = '201'

export interface ItemParaFacturar {
  articulo_nombre: string
  articulo_codigo: string // codigo_interno o sku del artículo
  cantidad: number
  subtotal: number // ya con cualquier descuento de línea aplicado
}

export interface ClienteParaFacturar {
  // undefined/null en cualquiera de estos campos = tratar como Consumidor Final sin datos
  cuit?: string | null
  dni?: string | null
  nombre: string
  domicilio?: string | null
  email?: string | null
}

export interface VentaParaFacturar {
  venta_id: number
  fecha_utc: string // 'YYYY-MM-DD', tal como está en ventas.fecha_utc
  total: number
  items: ItemParaFacturar[]
  cliente: ClienteParaFacturar
}

function formatearFechaDDMMYYYY(fechaUtc: string): string {
  // fechaUtc viene como 'YYYY-MM-DD' (DATE) — nunca usar new Date() para esto (regla del proyecto)
  const [anio, mes, dia] = fechaUtc.split('-')
  return `${dia}/${mes}/${anio}`
}

function resolverCliente(cliente: ClienteParaFacturar): TusFacturasCliente {
  if (cliente.cuit) {
    return {
      documento_tipo: 'CUIT',
      documento_nro: cliente.cuit.replace(/\D/g, ''),
      razon_social: cliente.nombre,
      domicilio: cliente.domicilio || 'No especifica',
      provincia: '16', // Río Negro — tabla oficial de provincias TusFacturasAPP
      condicion_iva: 'CF',
      condicion_iva_operacion: 'CF',
      condicion_pago: CONDICION_PAGO_CONTADO,
      email: cliente.email || undefined,
      envia_por_mail: 'N',
      reclama_deuda: 'N',
    }
  }

  if (cliente.dni) {
    return {
      documento_tipo: 'DNI',
      documento_nro: cliente.dni.replace(/\D/g, ''),
      razon_social: cliente.nombre,
      domicilio: cliente.domicilio || 'No especifica',
      provincia: '16',
      condicion_iva: 'CF',
      condicion_iva_operacion: 'CF',
      condicion_pago: CONDICION_PAGO_CONTADO,
      email: cliente.email || undefined,
      envia_por_mail: 'N',
      reclama_deuda: 'N',
    }
  }

  // Consumidor Final sin especificar datos
  return {
    documento_tipo: 'OTRO',
    documento_nro: '0',
    razon_social: 'Consumidor Final',
    domicilio: 'No especifica',
    provincia: '16',
    condicion_iva: 'CF',
    condicion_iva_operacion: 'CF',
    condicion_pago: CONDICION_PAGO_CONTADO,
    envia_por_mail: 'N',
    reclama_deuda: 'N',
  }
}

/**
 * IMPORTANTE: para comprobantes A/B/C/M, AFIP/ARCA recibe SOLO TOTALES vía WSFEv1,
 * nunca el detalle de items (confirmado en documentación oficial de TusFacturasAPP).
 * El array "detalle" es solo para la gestión interna de TusFacturasAPP (PDF, reportes),
 * no afecta la validez fiscal del comprobante. Por eso "total" es el campo que
 * realmente importa que sea exacto — debe ser ventas.total, no una suma recalculada acá.
 */
export function mapearVentaAFacturaC(
  venta: VentaParaFacturar,
  numeroComprobante: string, // ya formateado con ceros a la izquierda, ej "00000002"
): TusFacturasRequestBody {
  const detalle: TusFacturasDetalleItem[] = venta.items.map((item) => ({
    cantidad: String(item.cantidad),
    producto: {
      descripcion: item.articulo_nombre.slice(0, 200),
      codigo: item.articulo_codigo,
      unidad_bulto: '1',
      precio_unitario_sin_iva: (item.subtotal / item.cantidad).toFixed(2),
      alicuota: '0',
      lista_precios: 'standard',
    },
    bonificacion_porcentaje: 0,
    leyenda: '',
  }))

  const fechaComprobante = formatearFechaDDMMYYYY(venta.fecha_utc)

  const subtotalDetalle = venta.items.reduce((sum, item) => sum + item.subtotal, 0)
  const bonificacionGeneral = subtotalDetalle - venta.total

  const comprobante: TusFacturasComprobante = {
    fecha: fechaComprobante,
    vencimiento: fechaComprobante, // Contado (condicion_pago=201) = 0 días de plazo
    tipo: 'FACTURA C',
    operacion: 'V',
    punto_venta: PUNTO_VENTA,
    numero: numeroComprobante,
    moneda: 'PES',
    cotizacion: 1,
    rubro: RUBRO,
    rubro_grupo_contable: RUBRO,
    detalle,
    bonificacion: bonificacionGeneral.toFixed(2),
    leyenda_gral: ' ',
    total: venta.total.toFixed(2),
    external_reference: `venta-${venta.venta_id}`,
  }

  return {
    usertoken: process.env.TUSFACTURAS_USERTOKEN as string,
    apikey: process.env.TUSFACTURAS_APIKEY as string,
    apitoken: process.env.TUSFACTURAS_APITOKEN as string,
    cliente: resolverCliente(venta.cliente),
    comprobante,
  }
}
