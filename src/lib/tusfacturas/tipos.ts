// Ruta destino: C:\Users\Usuario\Documents\sistema-habitus-sd\src\lib\tusfacturas\tipos.ts

// Tabla de referencia oficial TusFacturasAPP (condiciones ante el IVA):
// CF=Consumidor Final, RI=Responsable Inscripto, M=Monotributo, E=Exento
export type TusFacturasCondicionIva = 'CF' | 'RI' | 'M' | 'E'

export interface TusFacturasCliente {
  documento_tipo: 'CUIT' | 'DNI' | 'OTRO'
  documento_nro: string
  razon_social: string
  domicilio: string
  provincia: string
  codigo: string // identificador propio del cliente en nuestro sistema (REQUERIDO por TusFacturasAPP)
  condicion_iva: TusFacturasCondicionIva
  condicion_iva_operacion?: TusFacturasCondicionIva
  condicion_pago: string
  email?: string
  envia_por_mail: 'N'
  reclama_deuda: 'N'
  rg5329: 'N' // Ariel no está alcanzado por el régimen de percepción RG5329
}

export interface TusFacturasProducto {
  descripcion: string
  codigo: string
  unidad_bulto: string
  unidad_medida: string // '7' = Unidad (tabla de referencia AFIP)
  precio_unitario_sin_iva: string
  alicuota: '0' // Factura C siempre alícuota 0
  lista_precios: string
  actualiza_precio: 'N' // el catálogo de precios vive en nuestro sistema, no en TusFacturasAPP
  rg5329: 'N'
}

export interface TusFacturasDetalleItem {
  cantidad: string
  afecta_stock: 'N' // el stock se gestiona en nuestro sistema, no en TusFacturasAPP
  producto: TusFacturasProducto
  bonificacion_porcentaje: number
  leyenda: string
}

// Requerido por ARCA para vincular una Nota de Crédito/Débito con el
// comprobante que anula. Estructura y nombres de campo exactos según
// documentación oficial TusFacturasAPP (developers.tusfacturas.app,
// verificado 13/08/2026): "numero" va como entero plano (sin ceros a la
// izquierda), "cuit" es siempre el propio CUIT emisor (mismo con el que se
// está facturando), no el del cliente.
export interface TusFacturasComprobanteAsociado {
  tipo_comprobante: string // ej. "FACTURA C" — misma nomenclatura que TusFacturasComprobante.tipo
  punto_venta: string // "0004"
  numero: number
  comprobante_fecha: string // dd/mm/yyyy
  cuit: string // CUIT del emisor (nuestro), sin puntos ni guiones
}

export interface TusFacturasComprobante {
  fecha: string // dd/mm/yyyy
  vencimiento: string // dd/mm/yyyy — obligatorio (changelog TusFacturasAPP 01/10/2023). Igual a "fecha" porque condicion_pago=Contado (0 días).
  idioma: '1' // 1=Español, 2=Inglés — REQUERIDO
  periodo_facturado_desde: string // dd/mm/yyyy — REQUERIDO. Venta de mostrador: mismo día que "fecha"
  periodo_facturado_hasta: string // dd/mm/yyyy — REQUERIDO. Venta de mostrador: mismo día que "fecha"
  tipo: 'FACTURA C' | 'NOTA DE CREDITO C'
  operacion: 'V'
  punto_venta: string // "0004"
  numero: string // con ceros a la izquierda, ej "00000002"
  moneda: 'PES'
  cotizacion: number
  rubro: string
  rubro_grupo_contable: string
  detalle: TusFacturasDetalleItem[]
  bonificacion: string
  leyenda_gral: string
  total: string
  external_reference: string // usamos ventas.id para poder rastrear
  // Solo presente al emitir una Nota de Crédito/Débito — ARCA la rechaza
  // sin esto si el tipo es NC/ND.
  comprobantes_asociados?: TusFacturasComprobanteAsociado[]
}

export interface TusFacturasRequestBody {
  usertoken: string
  apikey: string
  apitoken: string
  cliente: TusFacturasCliente
  comprobante: TusFacturasComprobante
}

// Respuesta de éxito (facturación instantánea)
export interface TusFacturasRespuestaExito {
  error: 'N'
  errores: []
  cae: string
  comprobante_nro: string // formato "00004-00000002"
  vencimiento_cae: string // dd/mm/yyyy — OJO: el nombre real de este campo es "vencimiento_cae", no "cae_vencimiento"
  observaciones?: string
}

// Respuesta de error
export interface TusFacturasRespuestaError {
  error: 'S'
  errores: string[]
  error_cod?: string[]
  error_details?: { code: string; text: string }[]
  external_reference?: string
}

export type TusFacturasRespuesta = TusFacturasRespuestaExito | TusFacturasRespuestaError

export function esRespuestaExitosa(r: TusFacturasRespuesta): r is TusFacturasRespuestaExito {
  return r.error === 'N'
}
