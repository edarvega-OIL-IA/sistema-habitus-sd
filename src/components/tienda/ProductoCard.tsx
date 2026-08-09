// Ruta destino: C:\Users\Usuario\Documents\sistema-habitus-sd\src\components\tienda\ProductoCard.tsx
'use client'

import { useState } from 'react'
import { Package, Minus, Plus, ShoppingCart, Check } from 'lucide-react'
import { useCarrito } from './CarritoContext'

interface Variante {
  id: number
  sabor: string | null
  atributo_valor: string | null
  precio: number
  en_oferta: boolean
  stock: number
  imagen_url: string | null
}

interface Props {
  titulo: string
  marca: string | null
  rubro: string | null
  variantes: Variante[]
}

const fmt = (n: number) => '$' + n.toLocaleString('es-AR', { minimumFractionDigits: 2 })

export default function ProductoCard({ titulo, marca, rubro, variantes }: Props) {
  // Por defecto, la primera variante con stock — si ninguna tiene, la primera nomás
  const inicial = variantes.find(v => v.stock > 0) ?? variantes[0]
  const [seleccionadaId, setSeleccionadaId] = useState(inicial.id)
  const [cantidad, setCantidad] = useState(1)
  const [agregado, setAgregado] = useState(false)
  const { agregar } = useCarrito()

  const seleccionada = variantes.find(v => v.id === seleccionadaId) ?? inicial
  const sinStock = seleccionada.stock <= 0
  const tieneVariantes = variantes.length > 1

  function cambiarSabor(id: number) {
    setSeleccionadaId(id)
    setCantidad(1) // el stock puede ser distinto en la nueva variante
  }

  function handleAgregar() {
    agregar(
      {
        articuloId: seleccionada.id,
        nombreBase: titulo,
        sabor: seleccionada.sabor,
        marca,
        rubro,
        precio: seleccionada.precio,
        imagenUrl: seleccionada.imagen_url,
        stockDisponible: seleccionada.stock,
      },
      cantidad
    )
    setAgregado(true)
    setTimeout(() => setAgregado(false), 1500)
  }

  return (
    <div className={`bg-white rounded-xl border border-border-gray overflow-hidden flex flex-col ${sinStock ? 'opacity-60' : ''}`}>
      <div className="aspect-square bg-surface-light flex items-center justify-center relative">
        {seleccionada.imagen_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={seleccionada.imagen_url} alt={titulo} loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <Package className="w-10 h-10 text-gray-300" />
        )}
        {seleccionada.en_oferta && !sinStock && (
          <span className="absolute top-2 left-2 bg-offer-teal text-white text-xs font-semibold px-2 py-0.5 rounded-full">
            OFERTA
          </span>
        )}
        {sinStock && (
          <span className="absolute top-2 left-2 bg-gray-500 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
            SIN STOCK
          </span>
        )}
      </div>
      <div className="p-3 flex flex-col flex-1">
        {marca && <p className="text-xs text-medium-gray uppercase tracking-wide">{marca}</p>}
        <p className="text-sm font-medium text-charcoal leading-snug mt-0.5 line-clamp-2">{titulo}</p>

        {tieneVariantes ? (
          <div role="radiogroup" aria-label="Sabores disponibles" className="flex flex-wrap gap-1 mt-2">
            {variantes.map(v => (
              <button
                key={v.id}
                type="button"
                role="radio"
                aria-checked={v.id === seleccionadaId}
                onClick={() => cambiarSabor(v.id)}
                title={v.stock <= 0 ? `${v.sabor} — sin stock` : v.sabor || ''}
                className={`relative px-2 py-0.5 rounded-full text-xs font-medium border transition-colors before:content-[''] before:absolute before:inset-0 before:-m-2 ${
                  v.id === seleccionadaId
                    ? 'bg-offer-teal text-white border-offer-teal ring-2 ring-offer-teal ring-offset-1'
                    : v.stock <= 0
                    ? 'bg-white text-gray-300 border-border-gray'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-offer-teal focus:ring-2 focus:ring-offer-teal focus:ring-offset-1'
                }`}
              >
                {v.sabor || 'Sabor'}
                {v.id === seleccionadaId && <span className="sr-only"> (seleccionado)</span>}
              </button>
            ))}
          </div>
        ) : (
          seleccionada.atributo_valor && <p className="text-xs text-medium-gray mt-0.5">{seleccionada.atributo_valor}</p>
        )}

        <div className="mt-auto pt-2">
          <p className="text-base font-bold text-charcoal">{fmt(seleccionada.precio)}</p>

          {!sinStock && (
            <div className="flex items-center gap-2 mt-2">
              <div className="flex items-center border border-gray-300 rounded-lg">
                <button
                  type="button"
                  onClick={() => setCantidad(c => Math.max(1, c - 1))}
                  disabled={cantidad <= 1}
                  aria-label="Disminuir cantidad"
                  className="min-w-[44px] min-h-[44px] w-7 h-7 flex items-center justify-center text-medium-gray hover:text-offer-teal disabled:opacity-30 disabled:hover:text-medium-gray"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="w-7 text-center text-sm font-medium text-charcoal" role="status" aria-live="polite" aria-label="Cantidad">{cantidad}</span>
                <button
                  type="button"
                  onClick={() => setCantidad(c => Math.min(seleccionada.stock, c + 1))}
                  disabled={cantidad >= seleccionada.stock}
                  aria-label="Aumentar cantidad"
                  className="min-w-[44px] min-h-[44px] w-7 h-7 flex items-center justify-center text-medium-gray hover:text-offer-teal disabled:opacity-30 disabled:hover:text-medium-gray"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
              <button
                type="button"
                onClick={handleAgregar}
                className={`flex-1 h-7 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                  agregado ? 'bg-offer-teal text-white' : 'bg-charcoal text-white hover:bg-black'
                }`}
              >
                {agregado ? <Check className="w-3.5 h-3.5" /> : <ShoppingCart className="w-3.5 h-3.5" />}
                {agregado ? 'Agregado' : 'Agregar'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
