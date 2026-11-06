// Ruta destino: C:\Users\Usuario\Documents\sistema-habitus-sd\src\app\tienda\page.tsx
//
// Catálogo público de la Vitrina web. Sin login (ver excepción en src/proxy.ts).
// Lee de la vista articulos_catalogo_web — NUNCA de la tabla articulos directo,
// para no correr riesgo de exponer costo_sin_iva ni otras columnas internas.
//
// Agrupa por nombre_base + marca cuando el artículo ya está migrado al sistema
// de Sabores (5 rubros por ahora: Proteínas, Creatinas, Barras, Geles, Bebidas
// Isotónicas) — ProductoCard muestra un selector de sabor. El resto del
// catálogo (nombre_base = null) se sigue mostrando suelto, sin agrupar.
//
// CACHÉ (06/11/2026): esta página ya NO se calcula en cada visita. Es estática
// y Vercel la regenera como máximo cada 10 minutos (ISR) o al instante cuando
// el panel guarda un artículo/precio/foto o se concreta una venta (ver
// lib/tienda/revalidarTiendaServidor.ts). Por eso:
//   - no lee searchParams ni cookies (cualquiera de las dos la volvería dinámica);
//   - el servidor entrega el catálogo en orden alfabético fijo y TODO lo demás
//     (filtros, búsqueda, orden y el mezclado aleatorio) lo hace el navegador
//     en components/tienda/CatalogoTienda.tsx.

import Link from 'next/link'
import CarritoBoton from '@/components/tienda/CarritoBoton'
import CatalogoTienda from '@/components/tienda/CatalogoTienda'
import { Mail, Phone, MapPin } from 'lucide-react'
import { traerFilasCatalogo } from '@/lib/tienda/catalogo'
import { agrupar } from '@/lib/tienda/catalogoUtil'

export const revalidate = 600

export default async function TiendaPage() {
  const filas = await traerFilasCatalogo()
  const grupos = agrupar(filas)

  // .sort() sin comparador ordena por código UTF-16: las mayúsculas acentuadas
  // (ej. "Ó" en "Óxido Nítrico") quedan después de la Z en vez de junto a la O.
  // localeCompare con locale 'es' ordena como espera un hablante de español.
  const rubros = [...new Set(filas.map(a => a.rubro).filter((r): r is string => !!r))]
    .sort((a, b) => a.localeCompare(b, 'es'))
  // Marca es un filtro que cruza todos los rubros (igual que en Empretienda:
  // /productos?marca=X mezcla categorías) — por eso la lista sale de TODO el
  // catálogo, no solo del rubro elegido, para poder combinar ambos filtros.
  const marcas = [...new Set(filas.map(a => a.marca).filter((m): m is string => !!m))]
    .sort((a, b) => a.localeCompare(b, 'es'))

  return (
    <div className="min-h-screen bg-surface-subtle">
      {/* Sin JavaScript la grilla no se oculta nunca (ver CatalogoTienda) */}
      <noscript>
        <style>{'.catalogo-oculto{opacity:1!important}'}</style>
      </noscript>

      {/* Header */}
      <header className="bg-charcoal text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 relative flex items-center justify-center">
          <Link href="/tienda">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-habitus.png" alt="Hábitus SD — Suplementos Deportivos" className="h-20 w-auto" />
          </Link>
          <div className="absolute right-4 sm:right-6 top-1/2 -translate-y-1/2">
            <CarritoBoton />
          </div>
        </div>
      </header>

      {/* Skip link */}
      <a href="#productos" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-charcoal focus:text-white focus:px-4 focus:py-2 focus:rounded-lg">
        Saltar al catálogo
      </a>

      {/* Carrusel + filtros + grilla (filtrado y orden aleatorio en el navegador) */}
      <CatalogoTienda grupos={grupos} rubros={rubros} marcas={marcas} />

      <footer className="bg-charcoal text-white mt-6">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-sm">
          <a href="mailto:habitus.sd@gmail.com" className="flex items-center gap-2 hover:text-offer-teal transition-colors">
            <Mail className="w-4 h-4 text-offer-teal shrink-0" />
            habitus.sd@gmail.com
          </a>
          <a href="tel:+5492993244332" className="flex items-center gap-2 hover:text-offer-teal transition-colors">
            <Phone className="w-4 h-4 text-offer-teal shrink-0" />
            +54 9 299 324-4332
          </a>
          <p className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-offer-teal shrink-0" />
            Avenida Roca 54 — Cinco Saltos — Río Negro — Patagonia
          </p>
        </div>
      </footer>
    </div>
  )
}
