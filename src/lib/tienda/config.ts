// Ruta destino: C:\Users\Usuario\Documents\sistema-habitus-sd\src\lib\tienda\config.ts

// Rubros que exigen un mínimo de unidades por nombre_base (mezclando
// sabores libremente) — hoy Barras de proteína (Ariel, 07/08). Geles queda
// pendiente de confirmar; se agrega acá como una línea más el día que
// se defina, sin tocar el resto de la lógica del carrito.
export const MINIMOS_POR_RUBRO: Record<string, number> = {
  'Barras de proteína': 10,
  'Geles': 10,
}
