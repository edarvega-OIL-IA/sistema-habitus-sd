// Ruta destino: C:\Users\Usuario\Documents\sistema-habitus-sd\src\components\tienda\DetalleAgregar.tsx
'use client'

import { useState } from 'react'
import { Minus, Plus, ShoppingCart, Check } from 'lucide-react'
import { useCarrito } from './CarritoContext'

interface Props {
  articuloId: number
  titulo: string
  sabor: string | null
  marca: string | null
  rubro: string | null
  precio: number
  imagenUrl: string | null
  stock: number
}

export default function DetalleAgregar({ articuloId, titulo, sabor, marca, rubro, precio, imagenUrl, stock }: Props) {
  const [cantidad, setCantidad] = useState(1)
  const [agregado, setAgregado] = useState(false)
  const { agregar } = useCarrito()

  const sinStock = stock <= 0

  function handleAgregar() {
    agregar(
      {
        articuloId,
        nombreBase: titulo,
        sabor,
        marca,
        rubro,
        precio,
        imagenUrl,
        stockDisponible: stock,
      },
      cantidad
    )
    setAgregado(true)
    setTimeout(() => setAgregado(false), 1500)
  }

  if (sinStock) {
    return (
      <span className="inline-flex items-center bg-gray-100 text-gray-500 text-sm font-medium px-3 py-1.5 rounded-full">
        Sin stock por el momento
      </span>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center border border-gray-300 rounded-lg shrink-0">
        <button
          type="button"
          onClick={() => setCantidad(c => Math.max(1, c - 1))}
          disabled={cantidad <= 1}
          aria-label="Disminuir cantidad"
          className="w-11 h-11 flex items-center justify-center text-medium-gray hover:text-offer-teal disabled:opacity-30"
        >
          <Minus className="w-4 h-4" />
        </button>
        <span className="w-10 text-center text-base font-medium text-charcoal" role="status" aria-live="polite" aria-label="Cantidad">
          {cantidad}
        </span>
        <button
          type="button"
          onClick={() => setCantidad(c => Math.min(stock, c + 1))}
          disabled={cantidad >= stock}
          aria-label="Aumentar cantidad"
          className="w-11 h-11 flex items-center justify-center text-medium-gray hover:text-offer-teal disabled:opacity-30"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
      <button
        type="button"
        onClick={handleAgregar}
        className={`flex-1 min-w-[160px] h-11 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
          agregado ? 'bg-offer-teal text-white' : 'bg-charcoal text-white hover:bg-black'
        }`}
      >
        {agregado ? <Check className="w-4 h-4" /> : <ShoppingCart className="w-4 h-4" />}
        {agregado ? 'Agregado al carrito' : 'Agregar al carrito'}
      </button>
    </div>
  )
}
