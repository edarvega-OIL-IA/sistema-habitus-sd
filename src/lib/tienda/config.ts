// Ruta destino: C:\Users\Usuario\Documents\sistema-habitus-sd\src\lib\tienda\config.ts

// Rubros que exigen un mínimo de unidades por rubro completo — cualquier
// combinación de productos (distintos nombre_base) y sabores dentro del
// rubro cuenta junta para ese total. Barras de proteína y Geles exigen
// 10 unidades cada uno (mínimos independientes, no se suman entre sí).
export const MINIMOS_POR_RUBRO: Record<string, number> = {
  'Barras de proteína': 10,
  'Geles': 10,
}
