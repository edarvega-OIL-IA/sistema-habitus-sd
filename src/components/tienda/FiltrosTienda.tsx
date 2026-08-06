// Ruta destino: C:\Users\Usuario\Documents\sistema-habitus-sd\src\components\tienda\FiltrosTienda.tsx
'use client'

import { useRouter, useSearchParams } from 'next/navigation'

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

  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        value={marcaActual}
        onChange={e => actualizarParam('marca', e.target.value || null)}
        className="px-3 py-1.5 rounded-full text-sm font-medium border border-gray-300 bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#00a19a] focus:border-[#00a19a]"
      >
        <option value="">Todas las marcas</option>
        {marcas.map(m => <option key={m} value={m}>{m}</option>)}
      </select>

      <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={soloStock}
          onChange={e => actualizarParam('stock', e.target.checked ? 'con' : null)}
          className="rounded border-gray-300 text-[#00a19a] focus:ring-[#00a19a]"
        />
        Solo con stock
      </label>
    </div>
  )
}
