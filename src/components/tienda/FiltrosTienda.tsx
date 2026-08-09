// Ruta destino: C:\Users\Usuario\Documents\sistema-habitus-sd\src\components\tienda\FiltrosTienda.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronDown, Search } from 'lucide-react'

export default function FiltrosTienda({ rubros, marcas }: { rubros: string[]; marcas: string[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  // Categorías y Marca arrancan cerradas — con ~20 rubros desplegados de
  // entrada, el sidebar tapaba toda la pantalla antes de ver un producto.
  const [categoriasAbierto, setCategoriasAbierto] = useState(false)
  const [marcaAbierto, setMarcaAbierto] = useState(false)
  const [busqueda, setBusqueda] = useState(searchParams.get('q') || '')

  const rubrosSeleccionados = (searchParams.get('rubro') || '').split(',').filter(Boolean)
  const marcasSeleccionadas = (searchParams.get('marca') || '').split(',').filter(Boolean)
  const soloStock = searchParams.get('stock') === 'con'
  const hayFiltrosActivos = rubrosSeleccionados.length > 0 || marcasSeleccionadas.length > 0 || soloStock || !!searchParams.get('q')

  function actualizarParam(clave: string, valor: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (valor) params.set(clave, valor)
    else params.delete(clave)
    router.push(`/tienda?${params.toString()}`)
  }

  // Buscador con debounce — no navega en cada tecla, espera una pausa breve.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (busqueda !== (searchParams.get('q') || '')) actualizarParam('q', busqueda || null)
    }, 400)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busqueda])

  function toggleValor(clave: 'rubro' | 'marca', seleccionados: string[], valor: string) {
    const nuevos = seleccionados.includes(valor)
      ? seleccionados.filter(x => x !== valor)
      : [...seleccionados, valor]
    actualizarParam(clave, nuevos.length > 0 ? nuevos.join(',') : null)
  }

  function limpiarTodo() {
    setBusqueda('')
    router.push('/tienda')
  }

  // Encabezado de sección: mismo estilo para Categorías y Marca, con más
  // afordancia visual de que es clickeable (fondo al pasar el mouse, flecha
  // más grande). Ahora usa h2 para jerarquía semántica.
  function EncabezadoSeccion({ titulo, abierto, onClick }: { titulo: string; abierto: boolean; onClick: () => void }) {
    return (
      <h2 className="m-0">
        <button
          onClick={onClick}
          className="flex items-center justify-between w-full text-xs font-semibold text-medium-gray uppercase tracking-wide mb-2 px-2 py-1.5 -mx-2 rounded hover:bg-gray-100 hover:text-charcoal transition-colors"
          aria-expanded={abierto}
        >
          {titulo}
          <ChevronDown className={`w-4 h-4 transition-transform ${abierto ? 'rotate-180' : ''}`} />
        </button>
      </h2>
    )
  }

  return (
    <aside className="w-full md:w-56 shrink-0 space-y-6 md:sticky md:top-4 md:self-start md:max-h-[calc(100vh-2rem)] md:overflow-y-auto md:pr-2">
      {hayFiltrosActivos && (
        <button onClick={limpiarTodo} className="text-xs text-red-500 hover:text-red-600">
          ✕ Limpiar filtros
        </button>
      )}

      {/* Buscador */}
      <div className="relative">
        <label htmlFor="tienda-search" className="sr-only">Buscar producto</label>
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-medium-gray w-4 h-4" />
        <input
          id="tienda-search"
          type="text"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar producto..."
          className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-offer-teal focus:border-transparent"
        />
      </div>

      {/* Solo con stock — arriba de todo, no un checkbox perdido en el medio */}
      <div>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={soloStock}
            onChange={e => actualizarParam('stock', e.target.checked ? 'con' : null)}
            className="rounded border-gray-300 text-offer-teal focus:ring-offer-teal"
          />
          Solo con stock
        </label>
      </div>

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
                    className="rounded border-gray-300 text-offer-teal focus:ring-offer-teal"
                  />
                  {r}
                </label>
              ))}
            </div>
          )}
        </div>
      )}

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
                    className="rounded border-gray-300 text-offer-teal focus:ring-offer-teal"
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
