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

  const rubrosSeleccionados = (searchParams.get('rubro') || '').split(',').filter(Boolean)
  const marcasSeleccionadas = (searchParams.get('marca') || '').split(',').filter(Boolean)
  const soloStock = searchParams.get('stock') === 'con'
  const hayFiltrosActivos = rubrosSeleccionados.length > 0 || marcasSeleccionadas.length > 0 || soloStock

  function actualizarParam(clave: string, valor: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (valor) params.set(clave, valor)
    else params.delete(clave)
    router.push(`/tienda?${params.toString()}`)
  }

  function toggleValor(clave: 'rubro' | 'marca', seleccionados: string[], valor: string) {
    const nuevos = seleccionados.includes(valor)
      ? seleccionados.filter(x => x !== valor)
      : [...seleccionados, valor]
    actualizarParam(clave, nuevos.length > 0 ? nuevos.join(',') : null)
  }

  function limpiarTodo() {
    router.push('/tienda')
  }

  // Encabezado de sección: mismo estilo para Categorías y Marca, con más
  // afordancia visual de que es clickeable (fondo al pasar el mouse, flecha
  // más grande).
  function EncabezadoSeccion({ titulo, abierto, onClick }: { titulo: string; abierto: boolean; onClick: () => void }) {
    return (
      <button
        onClick={onClick}
        className="flex items-center justify-between w-full text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-2 py-1.5 -mx-2 rounded hover:bg-gray-100 hover:text-[#3c3c3b] transition-colors"
      >
        {titulo}
        <ChevronDown className={`w-4 h-4 transition-transform ${abierto ? 'rotate-180' : ''}`} />
      </button>
    )
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
          <EncabezadoSeccion titulo="Categorías" abierto={categoriasAbierto} onClick={() => setCategoriasAbierto(prev => !prev)} />
          {categoriasAbierto && (
            <div className="space-y-1">
              {rubros.map(r => (
                <label key={r} className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rubrosSeleccionados.includes(r)}
                    onChange={() => toggleValor('rubro', rubrosSeleccionados, r)}
                    className="rounded border-gray-300 text-[#00a19a] focus:ring-[#00a19a]"
                  />
                  {r}
                </label>
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
          <EncabezadoSeccion titulo="Marca" abierto={marcaAbierto} onClick={() => setMarcaAbierto(prev => !prev)} />
          {marcaAbierto && (
            <div className="space-y-1">
              {marcas.map(m => (
                <label key={m} className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={marcasSeleccionadas.includes(m)}
                    onChange={() => toggleValor('marca', marcasSeleccionadas, m)}
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
