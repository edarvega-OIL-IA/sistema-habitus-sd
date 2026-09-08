// Ruta destino: C:\Users\Usuario\Documents\sistema-habitus-sd\src\lib\correoargentino\pesoCarrito.ts
//
// Calcula el peso total (en gramos) de un carrito para cotizar envíos por
// MiCorreo. Compartido entre api/tienda/cotizar-envio/route.ts (cotización
// previa al pago) y api/tienda/checkout/route.ts (re-cotización server-side
// al confirmar) — un solo lugar para el criterio de peso por defecto.

import { PESO_DEFECTO_GRAMOS } from '@/lib/config'

interface ItemCarrito {
  articuloId: number
  cantidad: number
}

export async function calcularPesoCarritoGramos(
  admin: any,
  items: ItemCarrito[]
): Promise<{ pesoTotalGramos: number; algunPesoEstimado: boolean }> {
  const articuloIds = items.map(i => i.articuloId)
  const { data: articulos, error } = await admin
    .from('articulos')
    .select('id, peso_kg')
    .in('id', articuloIds)

  if (error) throw new Error('Error al leer peso de artículos: ' + error.message)

  const pesoMap = new Map<number, number | null>((articulos || []).map((a: any) => [a.id, a.peso_kg]))
  let pesoTotalGramos = 0
  let algunPesoEstimado = false

  for (const item of items) {
    const pesoKg = pesoMap.get(item.articuloId)
    if (pesoKg && pesoKg > 0) {
      pesoTotalGramos += pesoKg * 1000 * item.cantidad
    } else {
      algunPesoEstimado = true
      pesoTotalGramos += PESO_DEFECTO_GRAMOS * item.cantidad
    }
  }

  return { pesoTotalGramos: Math.round(pesoTotalGramos), algunPesoEstimado }
}
