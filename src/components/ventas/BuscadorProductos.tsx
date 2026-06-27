'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Articulo {
  id: number
  nombre: string
  codigo_interno: string | null
  codigo_barra: string | null
  precio_local: number
  disponible_local: boolean
}

interface PopupCantidad {
  articulo: Articulo
  cantidad: number
}

interface BuscadorProductosProps {
  onAgregarItem: (articulo: Articulo, cantidad: number) => void
}

export default function BuscadorProductos({ onAgregarItem }: BuscadorProductosProps) {
  const [query, setQuery] = useState('')
  const [resultados, setResultados] = useState<Articulo[]>([])
  const [indiceFoco, setIndiceFoco] = useState<number>(-1)
  const [popup, setPopup] = useState<PopupCantidad | null>(null)
  const [buscando, setBuscando] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const cantidadRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const timerPopupRef = useRef<NodeJS.Timeout | null>(null)
  const codigoBarrasBuffer = useRef<string>('')
  const popupRef = useRef<PopupCantidad | null>(null)
  const listaRef = useRef<HTMLDivElement>(null)

  useEffect(() => { popupRef.current = popup }, [popup])

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey && e.key === 'b') {
        e.preventDefault()
        cerrarPopup()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    if (popup) {
      cantidadRef.current?.focus()
      cantidadRef.current?.select()
      timerPopupRef.current = setTimeout(() => confirmarPopupRef(), 2000)
    }
    return () => { if (timerPopupRef.current) clearTimeout(timerPopupRef.current) }
  }, [popup?.articulo.id])

  // Reset índice de foco cuando cambian los resultados
  useEffect(() => { setIndiceFoco(-1) }, [resultados])

  async function buscar(valor: string) {
    if (!valor.trim()) { setResultados([]); return }
    setBuscando(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('articulos')
      .select('id, nombre, codigo_interno, codigo_barra, precio_local, disponible_local')
      .eq('activo', true)
      .eq('disponible_local', true)
      .or(`nombre.ilike.%${valor}%,codigo_interno.ilike.%${valor}%,codigo_barra.ilike.%${valor}%`)
      .limit(8)

    setResultados(data || [])
    setBuscando(false)

    if (data && data.length === 1) {
      abrirPopup(data[0])
      setResultados([])
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const valor = e.target.value
    setQuery(valor)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => buscar(valor), 150)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (resultados.length > 1) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setIndiceFoco(prev => Math.min(prev + 1, resultados.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setIndiceFoco(prev => Math.max(prev - 1, 0))
        return
      }
      if (e.key === 'Enter' && indiceFoco >= 0) {
        e.preventDefault()
        abrirPopup(resultados[indiceFoco])
        return
      }
    }
    if (e.key === 'Enter' && query.trim()) {
      if (timerRef.current) clearTimeout(timerRef.current)
      buscar(query)
    }
    if (e.key === 'Escape') { setQuery(''); setResultados([]) }
  }

  function abrirPopup(articulo: Articulo) {
    if (timerPopupRef.current) clearTimeout(timerPopupRef.current)
    codigoBarrasBuffer.current = ''
    setPopup({ articulo, cantidad: 1 })
    setQuery('')
    setResultados([])
  }

  function confirmarPopupRef() {
    const p = popupRef.current
    if (!p) return
    if (timerPopupRef.current) clearTimeout(timerPopupRef.current)
    onAgregarItem(p.articulo, p.cantidad)
    setPopup(null)
    setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select() }, 50)
  }

  function confirmarPopup() {
    if (!popup) return
    if (timerPopupRef.current) clearTimeout(timerPopupRef.current)
    onAgregarItem(popup.articulo, popup.cantidad)
    setPopup(null)
    setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select() }, 50)
  }

  function cerrarPopup() {
    if (timerPopupRef.current) clearTimeout(timerPopupRef.current)
    codigoBarrasBuffer.current = ''
    setPopup(null)
    setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select() }, 50)
  }

  function handlePopupKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      const buffer = codigoBarrasBuffer.current
      if (buffer.length > 4) {
        confirmarPopup()
        setTimeout(() => buscar(buffer), 100)
      } else {
        confirmarPopup()
      }
      codigoBarrasBuffer.current = ''
      return
    }
    if (e.key === 'Escape') { cerrarPopup(); return }
    if (e.key.length === 1) codigoBarrasBuffer.current += e.key
  }

  function handleCantidadChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = parseInt(e.target.value)
    if (popup && val > 0) {
      if (timerPopupRef.current) clearTimeout(timerPopupRef.current)
      timerPopupRef.current = setTimeout(() => confirmarPopupRef(), 2000)
      setPopup({ ...popup, cantidad: val })
    }
  }

  return (
    <div className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="Escanear código o buscar por nombre..."
          className="w-full h-11 pl-10 pr-4 border-2 border-[#00a19a] rounded-lg text-sm focus:outline-none bg-white"
          autoComplete="off"
        />
        <span className="absolute left-3 top-3 text-[#00a19a] text-base">🔍</span>
        {buscando && <span className="absolute right-3 top-3 text-gray-400 text-xs">buscando...</span>}
      </div>

      {/* Lista de resultados con navegación por teclado */}
      {resultados.length > 1 && (
        <div ref={listaRef} className="absolute z-20 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-64 overflow-y-auto">
          {resultados.map((a, idx) => (
            <button
              key={a.id}
              onClick={() => abrirPopup(a)}
              className={`w-full text-left px-4 py-3 border-b border-gray-100 last:border-0 ${
                indiceFoco === idx ? 'bg-[#00a19a] text-white' : 'hover:bg-[#e8f7f6]'
              }`}
            >
              <div className={`text-sm font-medium ${indiceFoco === idx ? 'text-white' : 'text-[#3c3c3b]'}`}>
                {a.nombre}
              </div>
              <div className={`text-xs flex gap-3 mt-0.5 ${indiceFoco === idx ? 'text-white/80' : 'text-gray-500'}`}>
                {a.codigo_interno && <span>Cód: {a.codigo_interno}</span>}
                <span className={`font-medium ${indiceFoco === idx ? 'text-white' : 'text-[#00a19a]'}`}>
                  ${a.precio_local?.toLocaleString('es-AR')}
                </span>
              </div>
            </button>
          ))}
          <div className="px-4 py-1.5 text-xs text-gray-400 border-t border-gray-100">
            ↑↓ para navegar · Enter para seleccionar
          </div>
        </div>
      )}

      {/* Popup de cantidad */}
      {popup && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl p-6 w-80">
            <div className="text-sm font-medium text-[#3c3c3b] mb-1">{popup.articulo.nombre}</div>
            <div className="text-xs text-gray-500 mb-4">
              ${popup.articulo.precio_local?.toLocaleString('es-AR')} c/u
            </div>
            <div className="flex items-center gap-4 mb-4">
              <label className="text-sm text-gray-600 w-20">Cantidad</label>
              <input
                ref={cantidadRef}
                type="number"
                min="1"
                value={popup.cantidad}
                onChange={handleCantidadChange}
                onKeyDown={handlePopupKeyDown}
                className="w-24 h-12 text-center text-2xl font-bold border-2 border-[#00a19a] rounded-lg focus:outline-none"
              />
              <div className="text-sm text-gray-500">
                = <span className="font-semibold text-[#3c3c3b]">
                  ${(popup.articulo.precio_local * popup.cantidad).toLocaleString('es-AR')}
                </span>
              </div>
            </div>
            <div className="text-xs text-gray-400 mb-4">
              Enter para confirmar · Esc para cancelar · Escanear = siguiente producto
            </div>
            <div className="h-1 bg-gray-100 rounded overflow-hidden">
              <div className="h-full bg-[#00a19a] animate-[shrink_2s_linear_forwards]" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
