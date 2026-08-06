// Ruta destino: C:\Users\Usuario\Documents\sistema-habitus-sd\src\components\tienda\FiltrosTienda.tsx
'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { SlidersHorizontal } from 'lucide-react'
import { PopoverRoot, PopoverTrigger, PopoverContent, PopoverCloseButton } from '@/components/Popover'

export default function FiltrosTienda({ marcas }: { marcas: string[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const marcasSeleccionadas = (searchParams.get('marca') || '').split(',').filter(Boolean)
  const soloStock = searchParams.get('stock') === 'con'
  const cantidadActiva = marcasSeleccionadas.length + (soloStock ? 1 : 0)

  function actualizarParam(clave: string, valor: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (valor) params.set(clave, valor)
    else params.delete(clave)
    router.push(`/tienda?${params.toString()}`)
  }

  function toggleMarca(m: string) {
    const nuevas = marcasSeleccionadas.includes(m)
      ? marcasSeleccionadas.filter(x => x !== m)
      : [...marcasSeleccionadas, m]
    actualizarParam('marca', nuevas.length > 0 ? nuevas.join(',') : null)
  }

  function limpiarFiltros() {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('marca')
    params.delete('stock')
    router.push(`/tienda?${params.toString()}`)
  }

  return (
    <PopoverRoot>
      <PopoverTrigger className="shrink-0 flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium border border-gray-300 bg-white text-gray-600 hover:border-[#00a19a] transition-colors">
        <SlidersHorizontal className="w-3.5 h-3.5" />
        Filtros
        {cantidadActiva > 0 && (
          <span className="bg-[#00a19a] text-white text-[10px] font-semibold rounded-full w-4 h-4 flex items-center justify-center">
            {cantidadActiva}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-64 p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-[#3c3c3b]">Filtros</p>
          <PopoverCloseButton className="text-gray-400 hover:text-gray-600 text-xs" />
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer mb-3 pb-3 border-b border-gray-100">
          <input
            type="checkbox"
            checked={soloStock}
            onChange={e => actualizarParam('stock', e.target.checked ? 'con' : null)}
            className="rounded border-gray-300 text-[#00a19a] focus:ring-[#00a19a]"
          />
          Solo con stock
        </label>

        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Marca</p>
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {marcas.map(m => (
            <label key={m} className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={marcasSeleccionadas.includes(m)}
                onChange={() => toggleMarca(m)}
                className="rounded border-gray-300 text-[#00a19a] focus:ring-[#00a19a]"
              />
              {m}
            </label>
          ))}
        </div>

        {cantidadActiva > 0 && (
          <button onClick={limpiarFiltros} className="text-xs text-red-500 hover:text-red-600 mt-3">
            Limpiar filtros
          </button>
        )}
      </PopoverContent>
    </PopoverRoot>
  )
}
