// Ruta destino: C:\Users\Usuario\Documents\sistema-habitus-sd\src\lib\ordenSabores.ts
//
// Criterio único de orden de sabores/variantes para la Vitrina web
// (catálogo y ficha de producto). Alfabético, con dos excepciones que van
// siempre al final: "Neutro" y las variantes sin sabor ni atributo.

function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

// 0 = sabor común · 1 = Neutro (al final de los sabores) · 2 = sin sabor
function rango(s: string | null | undefined): 0 | 1 | 2 {
  if (!s) return 2
  return normalizar(s).startsWith('neutro') ? 1 : 0
}

export function compararSabores(a: string | null | undefined, b: string | null | undefined): number {
  const dif = rango(a) - rango(b)
  if (dif !== 0) return dif
  return (a || '').localeCompare(b || '', 'es')
}
