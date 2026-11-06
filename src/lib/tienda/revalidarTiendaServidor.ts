// Ruta destino: C:\Users\Usuario\Documents\sistema-habitus-sd\src\lib\tienda\revalidarTiendaServidor.ts
//
// Invalida la caché de la Vitrina desde el servidor. Usar en rutas API
// (ventas, webhook de Mercado Pago, api/tienda-revalidar). Nunca lanza error:
// si falla, la Vitrina se actualiza igual sola por el tiempo de revalidación.

import { revalidatePath } from 'next/cache'

export function revalidarTiendaServidor() {
  try {
    revalidatePath('/tienda')
    revalidatePath('/tienda/producto/[slug]', 'page')
  } catch (error) {
    console.error('No se pudo revalidar la Vitrina:', error)
  }
}
