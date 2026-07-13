// Ruta destino: C:\Users\Usuario\Documents\sistema-habitus-sd\src\lib\tusfacturas\emitir.ts

import { TusFacturasRequestBody, TusFacturasRespuesta } from './tipos'

const ENDPOINT = 'https://www.tusfacturas.app/app/api/v2/facturacion/nuevo'

/**
 * Interruptor general: mientras esta variable no esté en 'true' en Vercel,
 * ninguna venta va a disparar un request real a TusFacturasAPP, sin importar
 * qué pase en el resto del código. Puesto a propósito en 'false' por defecto
 * durante el período paralelo con Cover (hasta que Ariel decida activarlo).
 *
 * Variable de entorno en Vercel: FISCALIZACION_TUSFACTURAS_ACTIVA=true
 */
export function fiscalizacionActiva(): boolean {
  return process.env.FISCALIZACION_TUSFACTURAS_ACTIVA === 'true'
}

/**
 * Llama a la API de facturación instantánea de TusFacturasAPP.
 * NUNCA loguear apikey/apitoken/usertoken en console.log — solo el resultado.
 */
export async function emitirFacturaC(body: TusFacturasRequestBody): Promise<TusFacturasRespuesta> {
  const respuesta = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const data = (await respuesta.json()) as TusFacturasRespuesta
  return data
}
