// Ruta destino: C:\Users\Usuario\Documents\sistema-habitus-sd\src\app\tienda\carrito\page.tsx
'use client'

import Link from 'next/link'
import { ArrowLeft, Minus, Plus, Trash2, Package, AlertTriangle } from 'lucide-react'
import { useCarrito } from '@/components/tienda/CarritoContext'
import { MINIMOS_POR_RUBRO } from '@/lib/tienda/config'

const fmt = (n: number) => '$' + n.toLocaleString('es-AR', { minimumFractionDigits: 2 })

export default function CarritoPage() {
  const { items, cargado, actualizarCantidad, quitar, vaciar, totalPrecio } = useCarrito()

  // Chequeo de mínimo por nombre_base — mezclando sabores, solo para los
  // rubros que lo exigen (ver src/lib/tienda/config.ts).
  const totalesPorNombreBase = new Map<string, { cantidad: number; minimo: number }>()
  for (const it of items) {
    const minimo = it.rubro ? MINIMOS_POR_RUBRO[it.rubro] : undefined
    if (!minimo) continue
    const actual = totalesPorNombreBase.get(it.nombreBase)
    totalesPorNombreBase.set(it.nombreBase, { cantidad: (actual?.cantidad || 0) + it.cantidad, minimo })
  }
  const faltantes = [...totalesPorNombreBase.entries()].filter(([, v]) => v.cantidad < v.minimo)
  const hayFaltantes = faltantes.length > 0

  if (!cargado) {
    return <div className="min-h-screen bg-surface-subtle flex items-center justify-center"><p className="text-sm text-medium-gray">Cargando carrito...</p></div>
  }

  return (
    <div className="min-h-screen bg-surface-subtle">
      <header className="bg-charcoal text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
          <Link href="/tienda" className="text-xs text-white/60 hover:text-white flex items-center gap-1 mb-2">
            <ArrowLeft className="w-3 h-3" /> Seguir comprando
          </Link>
          <h1 className="text-xl font-bold">Tu carrito</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        {items.length === 0 ? (
          <div className="bg-white border border-border-gray rounded-lg p-12 text-center">
            <p className="text-sm text-medium-gray mb-3">Todavía no agregaste nada al carrito.</p>
            <Link href="/tienda" className="text-sm text-offer-teal font-medium hover:underline">Ver catálogo</Link>
          </div>
        ) : (
          <>
            {hayFaltantes && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4 flex gap-3">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800">
                  <p className="font-medium mb-1">Faltan unidades para el pedido mínimo:</p>
                  <ul className="space-y-0.5">
                    {faltantes.map(([nombreBase, v]) => (
                      <li key={nombreBase}>
                        {nombreBase}: tenés {v.cantidad}, el mínimo es {v.minimo} (podés combinar sabores) — faltan {v.minimo - v.cantidad}.
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <div className="bg-white rounded-lg border border-border-gray divide-y divide-gray-100">
              {items.map(it => (
                <div key={it.articuloId} className="p-4 flex gap-3 items-center">
                  <div className="w-16 h-16 rounded-lg bg-surface-light shrink-0 flex items-center justify-center overflow-hidden">
                    {it.imagenUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={it.imagenUrl} alt={it.nombreBase} loading="lazy" className="w-full h-full object-cover" />
                    ) : (
                      <Package className="w-6 h-6 text-gray-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    {it.marca && <p className="text-xs text-medium-gray uppercase tracking-wide">{it.marca}</p>}
                    <p className="text-sm font-medium text-charcoal leading-snug">{it.nombreBase}</p>
                    {it.sabor && <p className="text-xs text-medium-gray">{it.sabor}</p>}
                    <p className="text-sm font-bold text-charcoal mt-1">{fmt(it.precio)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <button onClick={() => quitar(it.articuloId)} aria-label="Quitar producto" className="text-gray-300 hover:text-red-500 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <div className="flex items-center border border-gray-300 rounded-lg">
                      <button
                        onClick={() => actualizarCantidad(it.articuloId, it.cantidad - 1)}
                        disabled={it.cantidad <= 1}
                        aria-label="Disminuir cantidad"
                        className="min-w-[44px] min-h-[44px] w-7 h-7 flex items-center justify-center text-medium-gray hover:text-offer-teal disabled:opacity-30"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-7 text-center text-sm font-medium text-charcoal" role="status" aria-live="polite" aria-label="Cantidad">{it.cantidad}</span>
                      <button
                        onClick={() => actualizarCantidad(it.articuloId, it.cantidad + 1)}
                        disabled={it.cantidad >= it.stockDisponible}
                        aria-label="Aumentar cantidad"
                        className="min-w-[44px] min-h-[44px] w-7 h-7 flex items-center justify-center text-medium-gray hover:text-offer-teal disabled:opacity-30"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center mt-4">
              <button onClick={vaciar} className="text-xs text-medium-gray hover:text-red-500">Vaciar carrito</button>
              <p className="text-lg font-bold text-charcoal">Total: {fmt(totalPrecio)}</p>
            </div>

            {hayFaltantes ? (
              <button
                disabled
                title="Completá el pedido mínimo para continuar"
                className="w-full mt-4 bg-offer-teal text-white py-3 rounded-lg font-semibold text-sm opacity-40 cursor-not-allowed transition-colors"
              >
                Continuar
              </button>
            ) : (
              <Link
                href="/tienda/checkout"
                className="w-full mt-4 bg-offer-teal text-white py-3 rounded-lg font-semibold text-sm hover:bg-offer-teal/90 transition-colors flex items-center justify-center"
              >
                Continuar
              </Link>
            )}
          </>
        )}
      </main>
    </div>
  )
}
