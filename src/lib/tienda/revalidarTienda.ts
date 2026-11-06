// Ruta destino: C:\Users\Usuario\Documents\sistema-habitus-sd\src\lib\tienda\revalidarTienda.ts
//
// Para usar desde pantallas del panel ('use client') justo después de guardar
// algo que se ve en la Vitrina (artículo, precio, fotos, "visible en tienda").
// Dispara y se olvida: nunca frena ni rompe el guardado. Si falla, la Vitrina
// se actualiza sola en unos minutos (revalidate de /tienda y de las fichas).
//
// Junta varios avisos seguidos en uno solo (p. ej. "Guardar todos los
// modificados" en Actualizar precios guarda de a uno): espera 800 ms sin
// nuevos avisos y recién ahí hace una única llamada.

let temporizador: ReturnType<typeof setTimeout> | null = null

export function revalidarTienda() {
  if (temporizador) clearTimeout(temporizador)
  temporizador = setTimeout(() => {
    temporizador = null
    fetch('/api/tienda-revalidar', { method: 'POST', keepalive: true }).catch(() => {})
  }, 800)
}
