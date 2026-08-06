// Ruta destino: C:\Users\Usuario\Documents\sistema-habitus-sd\src\components\tienda\FiltrosTienda.tsx
'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronDown } from 'lucide-react'

export default function FiltrosTienda({ rubros, marcas }: { rubros: string[]; marcas: string[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [categoriasAbierto, setCategoriasAbierto] = useState(true)
  const [marcaAbierto, setMarcaAbierto] = useState(true)

  const rubroActual = searchParams.get('rubro') || ''
  const marcasSeleccionadas = (searchParams.get('marca') || '').split(',').filter(Boolean)
  const soloStock = searchParams.get('stock') === 'con'
  const hayFiltrosActivos = !!rubroActual || marcasSeleccionadas.length > 0 || soloStock

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

  function limpiarTodo() {
    router.push('/tienda')
  }

  return (
    <aside className="w-full md:w-56 shrink-0 space-y-6 md:sticky md:top-4 md:self-start md:max-h-[calc(100vh-2rem)] md:overflow-y-auto md:pr-2">
      {hayFiltrosActivos && (
        <button onClick={limpiarTodo} className="text-xs text-red-500 hover:text-red-600">
          ✕ Limpiar filtros
        </button>
      )}

      {rubros.length > 0 && (
        <div>
          <button
            onClick={() => setCategoriasAbierto(prev => !prev)}
            className="flex items-center justify-between w-full text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2"
          >
            Categorías
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${categoriasAbierto ? 'rotate-180' : ''}`} />
          </button>
          {categoriasAbierto && (
            <div className="space-y-0.5">
              <button
                onClick={() => actualizarParam('rubro', null)}
                className={`block w-full text-left px-3 py-1.5 rounded text-sm transition-colors ${
                  !rubroActual ? 'bg-[#00a19a]/10 text-[#00a19a] font-medium' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                Todos
              </button>
              {rubros.map(r => (
                <button
                  key={r}
                  onClick={() => actualizarParam('rubro', rubroActual === r ? null : r)}
                  className={`block w-full text-left px-3 py-1.5 rounded text-sm transition-colors ${
                    rubroActual === r ? 'bg-[#00a19a]/10 text-[#00a19a] font-medium' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={soloStock}
            onChange={e => actualizarParam('stock', e.target.checked ? 'con' : null)}
            className="rounded border-gray-300 text-[#00a19a] focus:ring-[#00a19a]"
          />
          Solo con stock
        </label>
      </div>

      {marcas.length > 0 && (
        <div>
          <button
            onClick={() => setMarcaAbierto(prev => !prev)}
            className="flex items-center justify-between w-full text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2"
          >
            Marca
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${marcaAbierto ? 'rotate-180' : ''}`} />
          </button>
          {marcaAbierto && (
            <div className="space-y-1">
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
          )}
        </div>
      )}
    </aside>
  )
}
