// Ruta destino: C:\Users\Usuario\Documents\sistema-habitus-sd\src\lib\tusfacturas\tipos.ts

export interface TusFacturasCliente {
  documento_tipo: 'CUIT' | 'DNI' | 'OTRO'
  documento_nro: string
  razon_social: string
  domicilio: string
  provincia: string
  condicion_iva: 'CF' // Consumidor Final — único caso contemplado por ahora
  condicion_iva_operacion?: 'CF'
  condicion_pago: string
  email?: string
  envia_por_mail: 'N'
  reclama_deuda: 'N'
}

export interface TusFacturasProducto {
  descripcion: string
  codigo: string
  unidad_bulto: string
  precio_unitario_sin_iva: string
  alicuota: '0' // Factura C siempre alícuota 0
  lista_precios: string
}

export interface TusFacturasDetalleItem {
  cantidad: string
  producto: TusFacturasProducto
  bonificacion_porcentaje: number
  leyenda: string
}

export interface TusFacturasComprobante {
  fecha: string // dd/mm/yyyy
  tipo: 'FACTURA C'
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
  cae_vencimiento: string // dd/mm/yyyy
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
