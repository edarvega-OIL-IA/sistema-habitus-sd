// Ruta destino: C:\Users\Usuario\Documents\sistema-habitus-sd\src\components\tienda\CarritoBoton.tsx
'use client'

import Link from 'next/link'
import { ShoppingCart } from 'lucide-react'
import { useCarrito } from './CarritoContext'

export default function CarritoBoton() {
  const { cantidadTotal } = useCarrito()

  return (
    <Link
      href="/tienda/carrito"
      className="relative flex items-center justify-center w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
      aria-label="Ver carrito"
    >
      <ShoppingCart className="w-5 h-5 text-white" />
      {cantidadTotal > 0 && (
        <span className="absolute -top-1 -right-1 bg-[#00a19a] text-white text-[10px] font-semibold rounded-full w-5 h-5 flex items-center justify-center">
          {cantidadTotal}
        </span>
      )}
    </Link>
  )
}
