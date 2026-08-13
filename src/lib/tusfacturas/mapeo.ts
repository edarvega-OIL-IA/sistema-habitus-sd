// Ruta destino: C:\Users\Usuario\Documents\sistema-habitus-sd\src\lib\tusfacturas\mapeo.ts

import { TusFacturasComprobante, TusFacturasDetalleItem, TusFacturasRequestBody, TusFacturasCliente, TusFacturasCondicionIva } from './tipos'

const PUNTO_VENTA = '0004'
const RUBRO = 'Suplementos deportivos'

// IDs en producción — puntos_venta.id=3 (PV 0004), tipos_comprobante.id=1 (Factura), id=3 (Nota Crédito)
export const PUNTO_VENTA_ID = 3
export const TIPO_COMPROBANTE_ID_FACTURA = 1
export const TIPO_COMPROBANTE_ID_NOTA_CREDITO = 3

// CUIT propio (monotributista) — el mismo bajo el que se emite toda factura
// real. Requerido por TusFacturasAPP en comprobantes_asociados de una NC:
// "debe coincidir con el CUIT desde donde estás emitiendo la NC".
export const CUIT_EMISOR = '23238900719'

// Tabla de referencia oficial TusFacturasAPP — "Condición de Venta" (código a
// enviar en condicion_pago), verificada en developers.tusfacturas.app el 27/07/2026.
// Contado = 0 días. Cuenta corriente sin plazo estándar = código genérico 205.
const CODIGO_CONTADO = '201'
const CODIGO_CUENTA_CORRIENTE_GENERICA = '205'
const CODIGOS_POR_DIAS_PLAZO: Record<number, string> = {
  5: '213', 10: '206', 15: '207', 20: '209', 30: '202', 45: '208', 60: '203', 90: '204',
}

// Tabla de referencia oficial TusFacturasAPP — "Condición ante el IVA".
// El nombre viene de nuestra tabla `condiciones_iva`; folleto de valores hoy
// soportados: los que puede tener un cliente real de Habitus SD.
const CODIGOS_CONDICION_IVA: Record<string, TusFacturasCondicionIva> = {
  'Consumidor Final': 'CF',
  'Responsable Inscripto': 'RI',
  'Monotributista': 'M',
  'Exento': 'E',
}

export interface ItemParaFacturar {
  articulo_nombre: string
  articulo_codigo: string // codigo_interno o sku del artículo
  cantidad: number
  subtotal: number // ya con cualquier descuento de línea aplicado
}

export interface ClienteParaFacturar {
  id: number // clientes.id — se usa para armar el "codigo" propio ante TusFacturasAPP
  nombre: string
  cuit?: string | null
  dni?: string | null
  domicilio?: string | null
  email?: string | null
  condicionIva: string // tal cual viene de condiciones_iva.nombre (ej. "Exento")
  tieneCuentaCorriente: boolean
  plazoDiasCtaCte?: number | null
}

export interface VentaParaFacturar {
  venta_id: number
  fecha_utc: string // 'YYYY-MM-DD', tal como está en ventas.fecha_utc
  total: number
  items: ItemParaFacturar[]
  cliente: ClienteParaFacturar
}

export interface OpcionesFacturacion {
  // Si el cliente tiene cuenta corriente habilitada, esta venta puntual
  // puede igual pagarse al contado — por eso es una opción aparte, no algo
  // que se deduce solo del perfil del cliente.
  esContado: boolean
}

// Datos mínimos del comprobante original que se está anulando — lo que
// exige TusFacturasAPP en el bloque "comprobantes_asociados" de una NC.
export interface ComprobanteOriginalParaNC {
  numero: number // sin formatear — el bloque comprobantes_asociados usa entero plano, ej. 31, no "00000031"
  fecha_utc: string // 'YYYY-MM-DD', tal como está en comprobantes.fecha_emision_utc o ventas.fecha_utc
}

export function formatearFechaDDMMYYYY(fechaUtc: string): string {
  // fechaUtc viene como 'YYYY-MM-DD' (DATE) — nunca usar new Date() para esto (regla del proyecto)
  const [anio, mes, dia] = fechaUtc.split('-')
  return `${dia}/${mes}/${anio}`
}

// Suma días a una fecha DATE ('YYYY-MM-DD') para calcular el vencimiento de
// cuenta corriente. Distinto del caso de "nunca usar new Date() para
// mostrar fechas": acá Date.UTC se usa solo como calculadora de aritmética
// de fechas (construido y leído siempre en UTC, nunca en hora local), no
// para mostrar nada en pantalla — no tiene el bug de husos horarios que
// motiva esa regla.
function sumarDiasAFechaUtc(fechaUtc: string, dias: number): string {
  const [anio, mes, dia] = fechaUtc.split('-').map(Number)
  const fecha = new Date(Date.UTC(anio, mes - 1, dia))
  fecha.setUTCDate(fecha.getUTCDate() + dias)
  const anioR = fecha.getUTCFullYear()
  const mesR = String(fecha.getUTCMonth() + 1).padStart(2, '0')
  const diaR = String(fecha.getUTCDate()).padStart(2, '0')
  return `${anioR}-${mesR}-${diaR}`
}

function resolverCondicionIva(nombreCondicion: string | null | undefined): TusFacturasCondicionIva {
  if (!nombreCondicion) return 'CF'
  return CODIGOS_CONDICION_IVA[nombreCondicion] ?? 'CF'
}

// Devuelve el código de condicion_pago de TusFacturasAPP + cuántos días de
// plazo corresponden (para calcular el vencimiento del comprobante).
function resolverCondicionPago(esContado: boolean, plazoDiasCtaCte: number | null | undefined): { codigo: string; dias: number } {
  if (esContado) return { codigo: CODIGO_CONTADO, dias: 0 }
  const dias = plazoDiasCtaCte ?? 0
  const codigoEspecifico = CODIGOS_POR_DIAS_PLAZO[dias]
  return { codigo: codigoEspecifico ?? CODIGO_CUENTA_CORRIENTE_GENERICA, dias }
}

function resolverCliente(cliente: ClienteParaFacturar, condicionIva: TusFacturasCondicionIva, condicionPagoCodigo: string): TusFacturasCliente {
  const tieneDocumento = !!(cliente.cuit || cliente.dni)
  const documentoTipo: 'CUIT' | 'DNI' | 'OTRO' = cliente.cuit ? 'CUIT' : cliente.dni ? 'DNI' : 'OTRO'
  const documentoNro = cliente.cuit
    ? cliente.cuit.replace(/\D/g, '')
    : cliente.dni
      ? cliente.dni.replace(/\D/g, '')
      : '0'

  return {
    documento_tipo: documentoTipo,
    documento_nro: documentoNro,
    razon_social: cliente.nombre,
    domicilio: cliente.domicilio || 'No especifica',
    provincia: '16', // Río Negro — hoy todos los clientes reales son de Río Negro; si algún día hay uno de otra provincia, mapear por localidades.provincia_id
    codigo: tieneDocumento ? `CLI-${cliente.id}` : 'CONSUMIDOR-FINAL',
    condicion_iva: condicionIva,
    condicion_iva_operacion: condicionIva,
    condicion_pago: condicionPagoCodigo,
    email: cliente.email || undefined,
    envia_por_mail: 'N',
    reclama_deuda: 'N',
    rg5329: 'N',
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
  opciones: OpcionesFacturacion = { esContado: true },
): TusFacturasRequestBody {
  const detalle: TusFacturasDetalleItem[] = venta.items.map((item) => ({
    cantidad: String(item.cantidad),
    afecta_stock: 'N', // el stock se gestiona en nuestro sistema, no en TusFacturasAPP
    producto: {
      descripcion: item.articulo_nombre.slice(0, 200),
      codigo: item.articulo_codigo,
      unidad_bulto: '1',
      unidad_medida: '7', // Unidad — tabla de referencia AFIP
      precio_unitario_sin_iva: (item.subtotal / item.cantidad).toFixed(2),
      alicuota: '0',
      lista_precios: 'standard',
      actualiza_precio: 'N',
      rg5329: 'N',
    },
    bonificacion_porcentaje: 0,
    leyenda: '',
  }))

  const fechaComprobante = formatearFechaDDMMYYYY(venta.fecha_utc)
  const condicionIva = resolverCondicionIva(venta.cliente.condicionIva)
  const { codigo: condicionPagoCodigo, dias: diasPlazo } = resolverCondicionPago(opciones.esContado, venta.cliente.plazoDiasCtaCte)
  const fechaVencimiento = diasPlazo > 0
    ? formatearFechaDDMMYYYY(sumarDiasAFechaUtc(venta.fecha_utc, diasPlazo))
    : fechaComprobante

  const subtotalDetalle = venta.items.reduce((sum, item) => sum + item.subtotal, 0)
  const bonificacionGeneral = subtotalDetalle - venta.total

  const comprobante: TusFacturasComprobante = {
    fecha: fechaComprobante,
    vencimiento: fechaVencimiento,
    idioma: '1',
    periodo_facturado_desde: fechaComprobante,
    periodo_facturado_hasta: fechaComprobante,
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
    cliente: resolverCliente(venta.cliente, condicionIva, condicionPagoCodigo),
    comprobante,
  }
}

/**
 * Nota de Crédito C — SIEMPRE por el total completo del comprobante original
 * (decisión de diseño: "anular y refacturar", no NC parcial). Un único
 * renglón de detalle describiendo la anulación, en vez de repetir los ítems
 * originales — para AFIP no importa (solo mira el total), y para el cliente
 * que abre el PDF es más claro que dice "anula tal factura" en una línea.
 *
 * El bloque comprobantes_asociados es lo que ARCA exige para vincular esta
 * NC con la Factura que cancela — sin esto, ARCA la rechaza directamente.
 */
export function mapearVentaANotaCreditoC(
  venta: VentaParaFacturar,
  comprobanteOriginal: ComprobanteOriginalParaNC,
  numeroComprobante: string, // NC — numeración propia, ya formateada con ceros a la izquierda
  opciones: OpcionesFacturacion = { esContado: true },
): TusFacturasRequestBody {
  const fechaComprobante = formatearFechaDDMMYYYY(venta.fecha_utc)
  const condicionIva = resolverCondicionIva(venta.cliente.condicionIva)
  const { codigo: condicionPagoCodigo } = resolverCondicionPago(opciones.esContado, venta.cliente.plazoDiasCtaCte)

  const numeroOriginalFormateado = String(comprobanteOriginal.numero).padStart(8, '0')

  const detalle: TusFacturasDetalleItem[] = [
    {
      cantidad: '1',
      afecta_stock: 'N',
      producto: {
        descripcion: `Anulación total de Factura C ${PUNTO_VENTA}-${numeroOriginalFormateado}`.slice(0, 200),
        codigo: 'NC-ANULACION',
        unidad_bulto: '1',
        unidad_medida: '7',
        precio_unitario_sin_iva: venta.total.toFixed(2),
        alicuota: '0',
        lista_precios: 'standard',
        actualiza_precio: 'N',
        rg5329: 'N',
      },
      bonificacion_porcentaje: 0,
      leyenda: '',
    },
  ]

  const comprobante: TusFacturasComprobante = {
    fecha: fechaComprobante,
    vencimiento: fechaComprobante,
    idioma: '1',
    periodo_facturado_desde: fechaComprobante,
    periodo_facturado_hasta: fechaComprobante,
    tipo: 'NOTA DE CREDITO C',
    operacion: 'V',
    punto_venta: PUNTO_VENTA,
    numero: numeroComprobante,
    moneda: 'PES',
    cotizacion: 1,
    rubro: RUBRO,
    rubro_grupo_contable: RUBRO,
    detalle,
    bonificacion: '0.00',
    leyenda_gral: ' ',
    total: venta.total.toFixed(2),
    external_reference: `venta-${venta.venta_id}-nc`,
    comprobantes_asociados: [
      {
        tipo_comprobante: 'FACTURA C',
        punto_venta: PUNTO_VENTA,
        numero: comprobanteOriginal.numero,
        comprobante_fecha: formatearFechaDDMMYYYY(comprobanteOriginal.fecha_utc),
        cuit: CUIT_EMISOR,
      },
    ],
  }

  return {
    usertoken: process.env.TUSFACTURAS_USERTOKEN as string,
    apikey: process.env.TUSFACTURAS_APIKEY as string,
    apitoken: process.env.TUSFACTURAS_APITOKEN as string,
    cliente: resolverCliente(venta.cliente, condicionIva, condicionPagoCodigo),
    comprobante,
  }
}
