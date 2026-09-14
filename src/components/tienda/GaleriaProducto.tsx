// Ruta destino: C:\Users\Usuario\Documents\sistema-habitus-sd\src\components\tienda\GaleriaProducto.tsx
'use client'

import { useState, useEffect } from 'react'
import { Package } from 'lucide-react'

interface Foto {
  url: string
  alt: string
}

interface Props {
  titulo: string
  fotos: Foto[]
  enOferta: boolean
  sinStock: boolean
}

export default function GaleriaProducto({ titulo, fotos, enOferta, sinStock }: Props) {
  const [indice, setIndice] = useState(0)

  // Si cambia la variante seleccionada (URL distinta → fotos distintas),
  // siempre arrancar mostrando la primera foto de la nueva variante.
  useEffect(() => { setIndice(0) }, [fotos])

  const actual = fotos[indice]

  return (
    <div className="flex flex-col">
      <div className="aspect-square bg-surface-light flex items-center justify-center relative">
        {actual ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={actual.url} alt={actual.alt || titulo} className="w-full h-full object-cover" />
        ) : (
          <Package className="w-16 h-16 text-gray-300" />
        )}
        {enOferta && !sinStock && (
          <span className="absolute top-3 left-3 bg-offer-teal text-white text-xs font-semibold px-2.5 py-1 rounded-full">
            OFERTA
          </span>
        )}
        {sinStock && (
          <span className="absolute top-3 left-3 bg-gray-500 text-white text-xs font-semibold px-2.5 py-1 rounded-full">
            SIN STOCK
          </span>
        )}
      </div>

      {fotos.length > 1 && (
        <div role="group" aria-label="Fotos del producto" className="flex gap-2 p-3 overflow-x-auto">
          {fotos.map((foto, i) => (
            <button
              key={foto.url + i}
              type="button"
              onClick={() => setIndice(i)}
              aria-label={`Ver foto ${i + 1} de ${fotos.length}`}
              aria-current={i === indice}
              className={`shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-colors ${
                i === indice ? 'border-offer-teal' : 'border-transparent hover:border-gray-300'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={foto.url} alt={foto.alt || `${titulo} — foto ${i + 1}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
