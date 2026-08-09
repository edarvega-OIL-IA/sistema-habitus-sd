// Ruta destino: C:\Users\Usuario\Documents\sistema-habitus-sd\src\components\tienda\OrdenTienda.tsx
'use client'

import { useRouter, useSearchParams } from 'next/navigation'

export default function OrdenTienda() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const orden = searchParams.get('orden') || 'relevancia'

  function cambiarOrden(valor: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (valor === 'relevancia') params.delete('orden')
    else params.set('orden', valor)
    router.push(`/tienda?${params.toString()}`)
  }

  return (
    <select
      value={orden}
      onChange={e => cambiarOrden(e.target.value)}
      className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-offer-teal focus:border-transparent"
    >
      <option value="relevancia">Ordenar por</option>
      <option value="precio_asc">Precio: menor a mayor</option>
      <option value="precio_desc">Precio: mayor a menor</option>
    </select>
  )
}
