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

// ============================================================
// DISEÑO (sesión 16, tercera vuelta)
// ------------------------------------------------------------
// Causa real del bug de cantidades erráticas: al abrir el popup de
// cantidad, el foco del teclado saltaba del buscador a ese campo. Esa
// transición no es instantánea — durante esa ventana breve, si el
// lector mandaba una segunda transmisión completa del mismo código
// (confirmado con diagnóstico: ~150ms después de la primera), esos
// caracteres podían caer en cualquiera de los dos campos según el
// instante exacto, y ninguno de los dos manejaba bien ese caso.
//
// Fix: el foco JAMÁS se mueve automáticamente al campo de cantidad.
// Ese campo es una pantalla (se actualiza por estado), y solo se vuelve
// realmente editable si el cajero hace clic ahí con el mouse — un gesto
// que un lector de código nunca puede disparar por sí solo. Todo lo que
// venga del lector, sea el primer escaneo o una transmisión repetida,
// entra siempre por el mismo lugar: el buscador, que nunca pierde el foco
// mientras haya actividad de escaneo.
// ============================================================

export default function BuscadorProductos({ onAgregarItem }: BuscadorProductosProps) {
  const [query, setQuery] = useState('')
  const [resultados, setResultados] = useState<Articulo[]>([])
  const [indiceFoco, setIndiceFoco] = useState<number>(-1)
  const [popup, setPopup] = useState<PopupCantidad | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const cantidadRef = useRef<HTMLInputElement>(null)
  const timerPopupRef = useRef<NodeJS.Timeout | null>(null)
  const popupRef = useRef<PopupCantidad | null>(null)
  const listaRef = useRef<HTMLDivElement>(null)

  // Catálogo completo cargado una sola vez, filtrado en memoria.
  const catalogoRef = useRef<Articulo[]>([])
  const [catalogoListo, setCatalogoListo] = useState(false)

  // Anti-rebote con ventana deslizante: mientras sigan llegando lecturas
  // del mismo código, el bloqueo se mantiene; se libera recién con un
  // silencio real de más de UMBRAL_REBOTE_MS.
  const ultimoEscaneo = useRef<{ valor: string; ts: number }>({ valor: '', ts: 0 })
  const UMBRAL_REBOTE_MS = 1200

  useEffect(() => { popupRef.current = popup }, [popup])

  useEffect(() => {
    inputRef.current?.focus()
    cargarCatalogo()
  }, [])

  async function cargarCatalogo() {
    const supabase = createClient()
    const { data } = await supabase
      .from('articulos')
      .select('id, nombre, codigo_interno, codigo_barra, precio_local, disponible_local')
      .eq('activo', true)
      .eq('disponible_local', true)
    catalogoRef.current = (data as Articulo[]) || []
    setCatalogoListo(true)
  }

  function filtrar(valor: string): Articulo[] {
    const tokens = normalizar(valor).trim().split(/\s+/).filter(Boolean)
    if (tokens.length === 0) return []
    return catalogoRef.current
      .filter(a => {
        const haystack = normalizar([a.nombre, a.codigo_interno, a.codigo_barra].filter(Boolean).join(' '))
        return tokens.every(t => haystack.includes(t))
      })
      .slice(0, 8)
  }

  function esEscaneoDuplicado(valor: string): boolean {
    const ahora = Date.now()
    const esDuplicado = valor === ultimoEscaneo.current.valor && (ahora - ultimoEscaneo.current.ts) < UMBRAL_REBOTE_MS
    ultimoEscaneo.current = { valor, ts: ahora }
    return esDuplicado
  }

  // Actualiza SOLO la lista de sugerencias mientras se tipea — nunca abre
  // el popup acá (eso queda reservado al Enter, con el texto completo).
  function actualizarSugerencias(valor: string) {
    setResultados(filtrar(valor))
  }

  function buscar(valor: string) {
    const encontrados = filtrar(valor)
    if (encontrados.length === 1) {
      abrirPopup(encontrados[0])
    } else {
      setResultados(encontrados)
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const valor = e.target.value
    setQuery(valor)
    actualizarSugerencias(valor)
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
      const texto = query.trim()

      // Filtro anti-rebote: si es el mismo texto que se acaba de procesar
      // hace instantes (o mientras sigue llegando en ráfaga), se ignora.
      if (esEscaneoDuplicado(texto)) {
        setQuery('')
        return
      }

      // Resguardo extra: si hay un popup abierto y el código escaneado ahora
      // corresponde exactamente al MISMO artículo que ya está esperando
      // confirmación, es sin dudas una transmisión repetida del lector —
      // se ignora sin importar el tiempo transcurrido.
      if (popup) {
        const art = popup.articulo
        const coincideConElAbierto =
          texto === art.codigo_barra || texto === art.codigo_interno
        if (coincideConElAbierto) {
          setQuery('')
          return
        }
      }

      buscar(texto)
    }
    if (e.key === 'Escape') { setQuery(''); setResultados([]) }
  }

  function abrirPopup(articulo: Articulo) {
    if (timerPopupRef.current) clearTimeout(timerPopupRef.current)
    setPopup({ articulo, cantidad: 1 })
    setQuery('')
    setResultados([])
    // El foco se queda en el buscador — nunca salta al campo de cantidad.
    // Así, cualquier transmisión adicional del lector (incluso si llega en
    // el peor momento posible) sigue entrando siempre por el mismo lugar.
    setTimeout(() => { inputRef.current?.focus() }, 0)
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
    setPopup(null)
    setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select() }, 50)
  }

  useEffect(() => {
    function handleGlobalKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey && e.key === 'b') {
        e.preventDefault()
        cerrarPopup()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }
    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [])

  useEffect(() => {
    if (popup) {
      timerPopupRef.current = setTimeout(() => confirmarPopupRef(), 2000)
    }
    return () => { if (timerPopupRef.current) clearTimeout(timerPopupRef.current) }
  }, [popup?.articulo.id])

  useEffect(() => { setIndiceFoco(-1) }, [resultados])

  // El campo de cantidad se edita a mano SOLO si el cajero hace clic ahí
  // (foco real por intención real). Un lector nunca puede disparar un
  // clic de mouse, así que no necesita ninguna protección anti-ráfaga.
  function handleCantidadChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = parseInt(e.target.value)
    if (popup && val > 0) {
      if (timerPopupRef.current) clearTimeout(timerPopupRef.current)
      timerPopupRef.current = setTimeout(() => confirmarPopupRef(), 2000)
      setPopup({ ...popup, cantidad: val })
    }
  }

  function handleCantidadKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); confirmarPopup() }
    if (e.key === 'Escape') { e.preventDefault(); cerrarPopup() }
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
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#00a19a] text-base">🔍</span>
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

      {/* Popup de cantidad — el foco del teclado NO se mueve acá automáticamente */}
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
                onKeyDown={handleCantidadKeyDown}
                onFocus={e => e.target.select()}
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
              <br />
              <span className="text-gray-300">Para cambiar la cantidad a mano, hacé clic en el número.</span>
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
