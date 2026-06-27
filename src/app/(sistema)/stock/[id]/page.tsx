'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'

interface Articulo {
  id: number
  nombre: string
  codigo_interno: string | null
  codigo_barra: string | null
}

interface ItemMovimiento {
  articulo_id: number
  nombre: string
  cantidad: number
  stock_actual: number
}

interface SubtipoMovimiento {
  id: number
  tipo_movimiento_stock_id: number
  nombre: string
}

interface Deportista {
  id: number
  nombre: string
  apellido: string
}

export default function StockEditarPage() {
  const router = useRouter()
  const params = useParams()
  const movimientoId = Number(params.id)

  const [cargando, setCargando] = useState(true)
  const [tipoNombre, setTipoNombre] = useState('')
  const [tipoId, setTipoId] = useState(0)
  const [subtipos, setSubtipos] = useState<SubtipoMovimiento[]>([])
  const [deportistas, setDeportistas] = useState<Deportista[]>([])
  const [subtipoSeleccionado, setSubtipoSeleccionado] = useState<number>(0)
  const [deportistaSeleccionado, setDeportistaSeleccionado] = useState<number>(0)
  const [items, setItems] = useState<ItemMovimiento[]>([])
  const [observaciones, setObservaciones] = useState('')
  const [query, setQuery] = useState('')
  const [resultados, setResultados] = useState<Articulo[]>([])
  const [buscando, setBuscando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exito, setExito] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const subtiposFiltrados = subtipos.filter(s => s.tipo_movimiento_stock_id === tipoId)
  const subtipoNombre = subtipos.find(s => s.id === subtipoSeleccionado)?.nombre ?? ''
  const esSponsoreо = subtipoNombre === 'Sponsoreo'

  useEffect(() => { cargarDatos() }, [])
  useEffect(() => { if (!cargando) inputRef.current?.focus() }, [cargando])

  async function cargarDatos() {
    const supabase = createClient()
    const [movRes, subtiposRes, deportistasRes] = await Promise.all([
      supabase
        .from('movimientos_stock')
        .select(`
          id, observaciones,
          tipo_movimiento_stock:tipos_movimiento_stock(id, nombre),
          subtipo_movimiento_stock:subtipos_movimiento_stock(id),
          deportista:deportistas(id),
          movimiento_stock_items(cantidad, articulo:articulos(id, nombre))
        `)
        .eq('id', movimientoId)
        .single(),
      supabase.from('subtipos_movimiento_stock').select('id, tipo_movimiento_stock_id, nombre').eq('activo', true).order('nombre'),
      supabase.from('deportistas').select('id, nombre, apellido').eq('activo', true).order('apellido'),
    ])

    if (movRes.error || !movRes.data) {
      router.push('/stock')
      return
    }

    const mov = movRes.data as any
    setTipoNombre(mov.tipo_movimiento_stock?.nombre ?? '')
    setTipoId(mov.tipo_movimiento_stock?.id ?? 0)
    setSubtipoSeleccionado(mov.subtipo_movimiento_stock?.id ?? 0)
    setDeportistaSeleccionado(mov.deportista?.id ?? 0)
    setObservaciones(mov.observaciones ?? '')
    setSubtipos(subtiposRes.data || [])
    setDeportistas(deportistasRes.data || [])

    // Cargar items con stock actual
    const itemsConStock = await Promise.all(
      (mov.movimiento_stock_items || []).map(async (item: any) => {
        const { data: stockData } = await supabase
          .from('articulo_stock')
          .select('stock_actual')
          .eq('articulo_id', item.articulo.id)
          .eq('sucursal_id', 1)
          .single()
        return {
          articulo_id: item.articulo.id,
          nombre: item.articulo.nombre,
          cantidad: item.cantidad,
          stock_actual: stockData?.stock_actual ?? 0,
        }
      })
    )
    setItems(itemsConStock)
    setCargando(false)
  }

  async function buscar(valor: string) {
    if (!valor.trim()) { setResultados([]); return }
    setBuscando(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('articulos')
      .select('id, nombre, codigo_interno, codigo_barra')
      .eq('activo', true)
      .or(`nombre.ilike.%${valor}%,codigo_interno.ilike.%${valor}%,codigo_barra.ilike.%${valor}%`)
      .limit(8)
    setResultados(data || [])
    setBuscando(false)
    if (data && data.length === 1) agregarArticulo(data[0])
  }

  async function agregarArticulo(articulo: Articulo) {
    setResultados([])
    setQuery('')
    const existente = items.find(i => i.articulo_id === articulo.id)
    if (existente) {
      setItems(prev => prev.map(i =>
        i.articulo_id === articulo.id ? { ...i, cantidad: i.cantidad + 1 } : i
      ))
      setTimeout(() => inputRef.current?.focus(), 50)
      return
    }
    const supabase = createClient()
    const { data } = await supabase
      .from('articulo_stock')
      .select('stock_actual')
      .eq('articulo_id', articulo.id)
      .eq('sucursal_id', 1)
      .single()
    setItems(prev => [...prev, {
      articulo_id: articulo.id,
      nombre: articulo.nombre,
      cantidad: 1,
      stock_actual: data?.stock_actual ?? 0,
    }])
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const valor = e.target.value
    setQuery(valor)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => buscar(valor), 150)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && query.trim()) {
      if (timerRef.current) clearTimeout(timerRef.current)
      buscar(query)
    }
    if (e.key === 'Escape') { setQuery(''); setResultados([]) }
  }

  function actualizarCantidad(articulo_id: number, valor: string) {
    const cant = parseFloat(valor)
    if (cant >= 0) setItems(prev => prev.map(i => i.articulo_id === articulo_id ? { ...i, cantidad: cant } : i))
  }

  function eliminarItem(articulo_id: number) {
    setItems(prev => prev.filter(i => i.articulo_id !== articulo_id))
  }

  async function guardar() {
    if (subtiposFiltrados.length > 0 && !subtipoSeleccionado) { setError('Seleccioná un motivo'); return }
    if (esSponsoreо && !deportistaSeleccionado) { setError('Seleccioná el deportista'); return }
    if (items.length === 0) { setError('Agregá al menos un artículo'); return }

    setGuardando(true)
    setError(null)
    const supabase = createClient()

    try {
      const { error: fnError } = await supabase.rpc('editar_movimiento_stock', {
        p_movimiento_id: movimientoId,
        p_subtipo_id: subtipoSeleccionado || null,
        p_deportista_id: esSponsoreо ? deportistaSeleccionado : null,
        p_observaciones: observaciones || null,
        p_items: items.map(i => ({ articulo_id: i.articulo_id, cantidad: i.cantidad })),
      })

      if (fnError) throw new Error(fnError.message)

      setExito('Movimiento actualizado')
      setTimeout(() => router.push('/stock'), 1500)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  const inputClass = "w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]"

  if (cargando) {
    return <div className="max-w-2xl mx-auto mt-10 text-center text-gray-400 text-sm">Cargando...</div>
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[#3c3c3b]">Editar movimiento de stock</h1>
        <button type="button" onClick={() => router.push('/stock')}
          className="px-4 py-2 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50">
          Volver
        </button>
      </div>

      {exito && (
        <div className="bg-[#e8f7f6] border border-[#00a19a] rounded-lg px-4 py-3 text-sm text-[#00796b]">
          ✓ {exito}
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-5">

        {/* Tipo — solo lectura */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
          <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded text-sm text-gray-500">
            {tipoNombre} — no se puede modificar
          </div>
        </div>

        {/* Subtipo */}
        {subtiposFiltrados.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Motivo</label>
            <div className="flex gap-2 flex-wrap">
              {subtiposFiltrados.map(s => (
                <button key={s.id} type="button"
                  onClick={() => setSubtipoSeleccionado(s.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    subtipoSeleccionado === s.id
                      ? 'bg-[#3c3c3b] text-white border-[#3c3c3b]'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-[#3c3c3b]'
                  }`}>
                  {s.nombre}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Deportista */}
        {esSponsoreо && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Deportista</label>
            <select value={deportistaSeleccionado}
              onChange={e => setDeportistaSeleccionado(parseInt(e.target.value))}
              className={inputClass}>
              <option value={0}>Seleccionar deportista</option>
              {deportistas.map(d => (
                <option key={d.id} value={d.id}>{d.apellido}, {d.nombre}</option>
              ))}
            </select>
          </div>
        )}

        {/* Buscador */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Agregar artículo</label>
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
            <span className="absolute left-3 top-3 text-[#00a19a]">🔍</span>
            {buscando && <span className="absolute right-3 top-3 text-gray-400 text-xs">buscando...</span>}
            {resultados.length > 1 && (
              <div className="absolute z-20 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-64 overflow-y-auto">
                {resultados.map(a => (
                  <button key={a.id} type="button" onClick={() => agregarArticulo(a)}
                    className="w-full text-left px-4 py-3 hover:bg-[#e8f7f6] border-b border-gray-100 last:border-0">
                    <div className="text-sm font-medium text-[#3c3c3b]">{a.nombre}</div>
                    {a.codigo_interno && <div className="text-xs text-gray-400">Cód: {a.codigo_interno}</div>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Lista de items */}
        {items.length > 0 && (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-2 text-left">Artículo</th>
                  <th className="px-4 py-2 text-center w-32">Cantidad</th>
                  <th className="px-4 py-2 text-center w-24">Stock actual</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.articulo_id} className="border-t border-gray-100">
                    <td className="px-4 py-3 text-[#3c3c3b]">{item.nombre}</td>
                    <td className="px-4 py-3">
                      <input
                        type="number" min="0" value={item.cantidad}
                        onChange={e => actualizarCantidad(item.articulo_id, e.target.value)}
                        className="w-full text-center border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-[#00a19a]"
                      />
                    </td>
                    <td className="px-4 py-3 text-center text-gray-500">{item.stock_actual}</td>
                    <td className="px-2 py-3 text-center">
                      <button type="button" onClick={() => eliminarItem(item.articulo_id)}
                        className="text-gray-300 hover:text-red-500">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Observaciones */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
          <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)}
            rows={2} className={inputClass} placeholder="Observaciones opcionales" />
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={() => router.push('/stock')}
            className="px-4 py-2 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50">
            Cancelar
          </button>
          <button type="button" onClick={guardar} disabled={guardando || items.length === 0}
            className="flex-1 h-11 bg-[#00a19a] text-white rounded-lg font-medium hover:bg-[#008f89] disabled:opacity-50">
            {guardando ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}
