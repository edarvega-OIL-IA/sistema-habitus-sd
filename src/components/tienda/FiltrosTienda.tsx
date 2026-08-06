// Ruta destino: C:\Users\Usuario\Documents\sistema-habitus-sd\src\components\tienda\FiltrosTienda.tsx
'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Check } from 'lucide-react'

export default function FiltrosTienda({ marcas }: { marcas: string[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function actualizarParam(clave: string, valor: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (valor) params.set(clave, valor)
    else params.delete(clave)
    router.push(`/tienda?${params.toString()}`)
  }

  const marcaActual = searchParams.get('marca') || ''
  const soloStock = searchParams.get('stock') === 'con'

  const pillBase = 'shrink-0 px-4 py-1.5 rounded-full text-sm font-medium border transition-colors'
  const pillActivo = 'bg-[#00a19a] text-white border-[#00a19a]'
  const pillInactivo = 'bg-white text-gray-600 border-gray-300 hover:border-[#00a19a]'

  return (
    <div className="flex items-center gap-2 overflow-x-auto">
      <button
        type="button"
        onClick={() => actualizarParam('marca', null)}
        className={`${pillBase} ${!marcaActual ? pillActivo : pillInactivo}`}
      >
        Todas las marcas
      </button>
      {marcas.map(m => (
        <button
          key={m}
          type="button"
          onClick={() => actualizarParam('marca', marcaActual === m ? null : m)}
          className={`${pillBase} ${marcaActual === m ? pillActivo : pillInactivo}`}
        >
          {m}
        </button>
      ))}

      <span className="shrink-0 w-px self-stretch bg-gray-200 mx-1" />

      <button
        type="button"
        onClick={() => actualizarParam('stock', soloStock ? null : 'con')}
        className={`${pillBase} flex items-center gap-1.5 ${soloStock ? pillActivo : pillInactivo}`}
      >
        {soloStock && <Check className="w-3.5 h-3.5" />}
        Solo con stock
      </button>
    </div>
  )
}
