// Ruta destino: C:\Users\Usuario\Documents\sistema-habitus-sd\src\lib\correoargentino\recargo.ts
//
// Recargo que Ariel puede sumar al costo de envío de Correo Argentino (MiCorreo).
// Se configura en Configuración → Envíos (tabla configuracion_envios, id=1):
//   - correo_argentino_recargo_pct         → % sobre la tarifa que cotiza MiCorreo
//   - correo_argentino_recargo_monto_fijo  → monto fijo $ por envío
// Se aplican en este orden: tarifa × (1 + pct/100) + fijo. Con ambos en 0 la
// tarifa queda exactamente igual a la que cotiza MiCorreo.
//
// IMPORTANTE: tanto api/tienda/cotizar-envio (lo que ve el cliente) como
// api/tienda/checkout (lo que realmente se cobra) deben usar estas mismas
// funciones, para que el precio mostrado y el cobrado sean siempre idénticos.

import type { SupabaseClient } from '@supabase/supabase-js'

export interface RecargoEnvio {
  pct: number
  fijo: number
}

// Lee el recargo vigente. Si no se puede leer, lanza error a propósito (no
// asume 0): evita mostrar un precio y cobrar otro.
export async function obtenerRecargoEnvio(admin: SupabaseClient): Promise<RecargoEnvio> {
  const { data, error } = await admin
    .from('configuracion_envios')
    .select('correo_argentino_recargo_pct, correo_argentino_recargo_monto_fijo')
    .eq('id', 1)
    .single()

  if (error || !data) throw new Error('No se pudo leer el recargo de envío')

  return {
    pct: Math.max(0, Number(data.correo_argentino_recargo_pct) || 0),
    fijo: Math.max(0, Number(data.correo_argentino_recargo_monto_fijo) || 0),
  }
}

// Aplica el recargo a una tarifa y redondea a 2 decimales.
export function aplicarRecargo(precio: number, recargo: RecargoEnvio): number {
  const conRecargo = precio * (1 + recargo.pct / 100) + recargo.fijo
  return Math.round(conRecargo * 100) / 100
}
