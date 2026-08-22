// Ruta destino: C:\Users\Usuario\Documents\sistema-habitus-sd\src\lib\slug.ts
//
// El id va SIEMPRE primero en el slug — así la URL nunca se rompe aunque el
// nombre del producto cambie después (el id es la fuente de verdad para
// buscarlo, el texto de atrás es solo decorativo/legible para humanos y
// buscadores).

export function slugify(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // saca acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function armarSlugProducto(id: number, nombre: string): string {
  return `${id}-${slugify(nombre)}`
}

// Devuelve null si el slug no empieza con un número — nunca "adivina" un id.
export function idDesdeSlugProducto(slugParam: string): number | null {
  const match = slugParam.match(/^(\d+)/)
  return match ? parseInt(match[1], 10) : null
}
