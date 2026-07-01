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

// Quita acentos/diacríticos y pasa a minúsculas, para que la búsqueda
// no dependa de tildes ni mayúsculas (ej: "creatina" encuentra "Creatína").
function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

// Umbral de rebote: si llega el MISMO texto escaneado dos veces dentro de esta
// ventana, se considera doble lectura de hardware (no una segunda venta real)
// y se ignora. Un cajero re-escaneando el mismo producto a propósito (para
// sumar unidades) normalmente tarda bastante más que esto en volver a apretar
// el gatillo del lector.
const UMBRAL_REBOTE_MS = 400

// Umbral para distinguir tecleo de lector (caracteres en milisegundos) de
// tecleo humano manual en el campo de cantidad (bastante más lento).
const UMBRAL_VELOCIDAD_ESCANEO_MS = 30

export default function BuscadorProductos({ onAgregarItem }: BuscadorProductosProps) {
  const [query, setQuery] = useState('')
  const [resultados, setResultados] = useState<Articulo[]>([])
  const [indiceFoco, setIndiceFoco] = useState<number>(-1)
  const [popup, setPopup] = useState<PopupCantidad | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const cantidadRef = useRef<HTMLInputElement>(null)
  const timerPopupRef = useRef<NodeJS.Timeout | null>(null)
  const codigoBarrasBuffer = useRef<string>('')
  const popupRef = useRef<PopupCantidad | null>(null)
  const listaRef = useRef<HTMLDivElement>(null)

  // Anti-rebote de escaneos duplicados (mismo texto, disparado dos veces por el hardware)
  const ultimoEscaneo = useRef<{ valor: string; ts: number }>({ valor: '', ts: 0 })
  // Catálogo completo cargado una sola vez al montar (igual que en Compras),
  // se filtra en memoria sin ida y vuelta al servidor por cada tecla o escaneo.
  const catalogoRef = useRef<Articulo[]>([])
  const [catalogoListo, setCatalogoListo] = useState(false)
  // Detección de ráfaga de caracteres (lector) dentro del popup de cantidad
  const ultimoKeyPopupTs = useRef<number>(0)
  const enRafagaPopup = useRef<boolean>(false)
  const cantidadAntesDeRafaga = useRef<number>(1)

  useEffect(() => { popupRef.current = popup }, [popup])

  useEffect(() => {
    inputRef.current?.focus()
    cargarCatalogo()
  }, [])

  async function cargarCatalogo() {
    const supabase = createClient()
    const { data } = await supabase
      .from('articulos')
      .select('id, nombre, codigo_interno, codigo_barra, precio_local, disponible_local, rubros(nombre), marcas(nombre)')
      .eq('activo', true)
      .eq('disponible_local', true)
    catalogoRef.current = ((data as any[]) || []).map(a => ({
      ...a,
      _rubro: a.rubros?.nombre || '',
      _marca: a.marcas?.nombre || '',
    }))
    setCatalogoListo(true)
  }

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
      // Reset de detección de ráfaga al abrir popup para un producto (nuevo o el mismo)
      ultimoKeyPopupTs.current = 0
      enRafagaPopup.current = false
      cantidadAntesDeRafaga.current = popup.cantidad
    }
    return () => { if (timerPopupRef.current) clearTimeout(timerPopupRef.current) }
  }, [popup?.articulo.id])

  // Reset índice de foco cuando cambian los resultados
  useEffect(() => { setIndiceFoco(-1) }, [resultados])

  // Devuelve true si este mismo texto ya fue escaneado hace menos de UMBRAL_REBOTE_MS
  // (rebote de hardware). Si no es duplicado, registra este escaneo como el último.
  function esEscaneoDuplicado(valor: string): boolean {
    const ahora = Date.now()
    const esDuplicado = valor === ultimoEscaneo.current.valor && (ahora - ultimoEscaneo.current.ts) < UMBRAL_REBOTE_MS
    if (!esDuplicado) {
      ultimoEscaneo.current = { valor, ts: ahora }
    }
    return esDuplicado
  }

  // Filtro tokenizado e insensible a acentos sobre el catálogo ya cargado en memoria.
  // Cada palabra escrita debe estar presente en algún lugar del texto buscable,
  // sin importar el orden (ej: "whey one fit" encuentra "Classic Whey Protein... One Fit").
  function filtrar(valor: string): Articulo[] {
    const tokens = normalizar(valor).trim().split(/\s+/).filter(Boolean)
    if (tokens.length === 0) return []
    return catalogoRef.current
      .filter(a => {
        const haystack = normalizar(
          [a.nombre, a.codigo_interno, a.codigo_barra, (a as any)._rubro, (a as any)._marca]
            .filter(Boolean)
            .join(' ')
        )
        return tokens.every(t => haystack.includes(t))
      })
      .slice(0, 8)
  }

  function buscar(valor: string) {
    const encontrados = filtrar(valor)
    setResultados(encontrados)
    if (encontrados.length === 1) {
      abrirPopup(encontrados[0])
      setResultados([])
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const valor = e.target.value
    setQuery(valor)
    buscar(valor)
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
      // Filtro anti-rebote: si es el mismo texto que se acaba de procesar
      // hace instantes, es una doble lectura del scanner — se ignora.
      if (esEscaneoDuplicado(query.trim())) {
        setQuery('')
        return
      }
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
      codigoBarrasBuffer.current = ''
      enRafagaPopup.current = false
      if (buffer.length > 4) {
        // Es un escaneo de otro producto mientras el popup seguía abierto.
        // Aplicar el mismo filtro anti-rebote que en el buscador principal.
        if (esEscaneoDuplicado(buffer)) return
        confirmarPopup()
        setTimeout(() => buscar(buffer), 100)
      } else {
        confirmarPopup()
      }
      return
    }
    if (e.key === 'Escape') { cerrarPopup(); return }

    if (e.key.length === 1) {
      const ahora = Date.now()
      const delta = ahora - ultimoKeyPopupTs.current
      ultimoKeyPopupTs.current = ahora

      if (delta < UMBRAL_VELOCIDAD_ESCANEO_MS) {
        // Caracteres llegando a velocidad de lector: bloquear que toquen
        // el campo visible de cantidad (que es type="number") y solo
        // acumularlos en el buffer para detectar el próximo producto.
        e.preventDefault()
        if (!enRafagaPopup.current) {
          // El primer carácter de esta ráfaga ya se filtró al campo antes
          // de que pudiéramos detectar que era un escaneo — se revierte.
          enRafagaPopup.current = true
          setPopup(p => (p ? { ...p, cantidad: cantidadAntesDeRafaga.current } : p))
        }
        codigoBarrasBuffer.current += e.key
      } else {
        // Tecleo lento = edición manual real del cajero. No es un escaneo:
        // se deja pasar normalmente y no se acumula en el buffer de código.
        enRafagaPopup.current = false
        codigoBarrasBuffer.current = ''
      }
    }
  }

  function handleCantidadChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = parseInt(e.target.value)
    if (popup && val > 0) {
      if (timerPopupRef.current) clearTimeout(timerPopupRef.current)
      timerPopupRef.current = setTimeout(() => confirmarPopupRef(), 2000)
      setPopup({ ...popup, cantidad: val })
      cantidadAntesDeRafaga.current = val
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
        {!catalogoListo && <span className="absolute right-3 top-3 text-gray-400 text-xs">cargando catálogo...</span>}
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
