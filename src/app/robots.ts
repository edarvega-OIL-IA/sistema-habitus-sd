// Ruta destino: C:\Users\Usuario\Documents\sistema-habitus-sd\src\app\robots.ts
import type { MetadataRoute } from 'next'

// Le dice a los buscadores y bots qué NO recorrer. Antes no existía robots.txt
// y cada combinación de filtros (?rubro=…&marca=…&q=…) era una página distinta
// para un rastreador. Las fichas de producto y /tienda quedan libres.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/tienda', '/tienda/producto/'],
        disallow: [
          '/*?',                      // cualquier URL con filtros/búsqueda/orden
          '/api/',
          '/login',
          '/tienda/carrito',
          '/tienda/checkout',
          '/tienda/pedido-confirmado',
        ],
      },
    ],
    sitemap: 'https://www.habitussd.com/sitemap.xml',
  }
}
