// Ruta destino: C:\Users\Usuario\Documents\sistema-habitus-sd\src\app\sitemap.ts
import type { MetadataRoute } from 'next'
import { traerFilasCatalogo } from '@/lib/tienda/catalogo'
import { armarSlugProducto } from '@/lib/slug'

const BASE = 'https://www.habitussd.com'

// Se regenera como máximo una vez por hora (queda en caché de Vercel).
export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const filas = await traerFilasCatalogo()

  // Una URL por variante/sabor, con el mismo slug que arma la ficha
  // (título = nombre_base si existe, si no el nombre).
  const fichas: MetadataRoute.Sitemap = filas.map(f => ({
    url: `${BASE}/tienda/producto/${armarSlugProducto(f.id, f.nombre_base || f.nombre)}`,
    changeFrequency: 'weekly',
  }))

  return [{ url: `${BASE}/tienda`, changeFrequency: 'daily' }, ...fichas]
}
