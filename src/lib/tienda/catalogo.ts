// Ruta destino: C:\Users\Usuario\Documents\sistema-habitus-sd\src\lib\tienda\catalogo.ts
//
// Lectura del catálogo público para el servidor (solo se importa desde páginas
// de servidor: tienda/page.tsx y sitemap.ts). Lee de la vista
// articulos_catalogo_web — NUNCA de articulos — con el cliente público sin
// cookies, para que las páginas puedan cachearse.

import { createPublicClient } from '@/lib/supabase/publico'
import type { FilaCatalogo } from './catalogoUtil'

// Solo las columnas que el listado realmente usa: sin descripcion (texto
// largo que la grilla nunca muestra), peso_kg ni rubro_id.
const COLUMNAS_LISTADO =
  'id, nombre, nombre_base, rubro, marca_id, marca, sabor, atributo_valor, precio, precio_original, en_oferta, stock, imagen_url'

// Supabase corta cada consulta en 1.000 filas sin avisar: se pagina con un
// orden estable para no perder artículos si el catálogo crece.
const TAMANO_PAGINA = 1000

export async function traerFilasCatalogo(): Promise<FilaCatalogo[]> {
  const supabase = createPublicClient()
  const filas: FilaCatalogo[] = []

  for (let desde = 0; ; desde += TAMANO_PAGINA) {
    const { data, error } = await supabase
      .from('articulos_catalogo_web')
      .select(COLUMNAS_LISTADO)
      .order('id')
      .range(desde, desde + TAMANO_PAGINA - 1)

    // Si falla, se lanza el error: Next conserva la versión anterior en caché
    // en vez de guardar durante minutos una página de error.
    if (error) throw new Error('No se pudo leer el catálogo web: ' + error.message)

    const pagina = (data || []) as unknown as FilaCatalogo[]
    filas.push(...pagina)
    if (pagina.length < TAMANO_PAGINA) break
  }

  return filas
}
