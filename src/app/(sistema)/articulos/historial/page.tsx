'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FECHA_MIN, fechaMax, fechaFueraDeRango } from '@/lib/fechaLimites'

interface Articulo {
  id: number
  nombre: string
  rubro_id: number | null
  marca_id: number | null
  codigo_interno: string | null
}
interface Rubro { id: number; nombre: string }
interface Marca { id: number; nombre: string }
interface StockActual { articulo_id: number; stock_actual: number }
interface Subtipo { id: number; nombre: string }
interface MovimientoHeader {
  id: number
  fecha_utc: string
  creado_en: string
  tipo_movimiento_stock_id: number
  subtipo_movimiento_stock_id: number | null
  origen_tipo: string | null
  observaciones: string | null
}
interface MovimientoItem {
  movimiento_stock_id: number
  articulo_id: number
  cantidad: number
}

interface MovimientoArticulo {
  fecha_utc: string
  creado_en: string
  tipo_movimiento_stock_id: number
  motivo: string
  detalle: string
  cantidadConSigno: number
  stockCalculado: number // corrido, ya con este movimiento aplicado
}

export default function HistorialArticulosPage() {
  const [articulos, setArticulos] = useState<Articulo[]>([])
  const [rubros, setRubros] = useState<Rubro[]>([])
  const [marcas, setMarcas] = useState<Marca[]>([])
  const [stockActual, setStockActual] = useState<StockActual[]>([])
  const [subtipos, setSubtipos] = useState<Subtipo[]>([])
  const [movimientos, setMovimientos] = useState<MovimientoHeader[]>([])
  const [items, setItems] = useState<MovimientoItem[]>([])
  const [cargando, setCargando] = useState(true)

  // Filtros
  const [filtroRubro, setFiltroRubro] = useState('')
  const [filtroMarca, setFiltroMarca] = useState('')
  const [filtroNombre, setFiltroNombre] = useState('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [errFechaDesde, setErrFechaDesde] = useState(false)
  const [errFechaHasta, setErrFechaHasta] = useState(false)
  const [soloConDiferencia, setSoloConDiferencia] = useState(false)

  const [expandidos, setExpandidos] = useState<Set<number>>(new Set())

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    setCargando(true)
    const supabase = createClient()
    const [artRes, rubRes, marRes, stockRes, subtiposRes, movRes, itemsRes] = await Promise.all([
      supabase.from('articulos').select('id, nombre, rubro_id, marca_id, codigo_interno').eq('activo', true).eq('disponible_local', true),
      supabase.from('rubros').select('id, nombre').order('nombre'),
      supabase.from('marcas').select('id, nombre'),
      supabase.from('articulo_stock').select('articulo_id, stock_actual').eq('sucursal_id', 1),
      supabase.from('subtipos_movimiento_stock').select('id, nombre'),
      supabase.from('movimientos_stock')
        .select('id, fecha_utc, creado_en, tipo_movimiento_stock_id, subtipo_movimiento_stock_id, origen_tipo, observaciones')
        .eq('sucursal_id', 1),
      supabase.from('movimiento_stock_items').select('movimiento_stock_id, articulo_id, cantidad'),
    ])

    setArticulos((artRes.data as any) || [])
    setRubros((rubRes.data as any) || [])
    setMarcas((marRes.data as any) || [])
    setStockActual((stockRes.data as any) || [])
    setSubtipos((subtiposRes.data as any) || [])
    setMovimientos((movRes.data as any) || [])
    setItems((itemsRes.data as any) || [])
    setCargando(false)
  }

  // fecha_utc es DATE — nunca usar new Date() sobre este valor
  function formatFecha(fecha: string) {
    return fecha.split('-').reverse().join('/')
  }

  const rubroPorId = useMemo(() => new Map(rubros.map(r => [r.id, r.nombre])), [rubros])
  const marcaPorId = useMemo(() => new Map(marcas.map(m => [m.id, m.nombre])), [marcas])
  const stockPorArticulo = useMemo(() => new Map(stockActual.map(s => [s.articulo_id, s.stock_actual])), [stockActual])
  const subtipoPorId = useMemo(() => new Map(subtipos.map(s => [s.id, s.nombre])), [subtipos])
  const movimientoPorId = useMemo(() => new Map(movimientos.map(m => [m.id, m])), [movimientos])

  // Marca depende del Rubro elegido: solo lista marcas con al menos un
  // artículo en ese rubro (mismo patrón ya usado en Artículos).
  const marcasDisponibles = useMemo(() => {
    if (!filtroRubro) return marcas
    const idsMarcaEnRubro = new Set(
      articulos.filter(a => a.rubro_id === Number(filtroRubro) && a.marca_id).map(a => a.marca_id)
    )
    return marcas.filter(m => idsMarcaEnRubro.has(m.id))
  }, [filtroRubro, marcas, articulos])

  // Si la marca elegida deja de tener sentido al cambiar de rubro, se resetea
  useEffect(() => {
    if (filtroMarca && !marcasDisponibles.some(m => m.id === Number(filtroMarca))) {
      setFiltroMarca('')
    }
  }, [marcasDisponibles, filtroMarca])

  // Mismo signo que el trigger fn_aplicar_item_stock: Egreso resta, todo lo demás suma
  function signo(tipoMovimientoId: number) {
    return tipoMovimientoId === 2 ? -1 : 1
  }

  function motivoDe(m: MovimientoHeader) {
    if (m.subtipo_movimiento_stock_id) return subtipoPorId.get(m.subtipo_movimiento_stock_id) ?? '—'
    if (m.origen_tipo === 'orden_compra') return 'Compra'
    if (m.origen_tipo) return m.origen_tipo.charAt(0).toUpperCase() + m.origen_tipo.slice(1)
    return '—'
  }

  // Arma, por artículo, la línea de tiempo completa (todo el historial, sin
  // recortar por fecha) para que el Stock Calculado corrido sea siempre
  // correcto. El filtro de fecha solo decide qué filas se MUESTRAN después.
  const movimientosPorArticulo = useMemo(() => {
    const mapa = new Map<number, MovimientoArticulo[]>()

    const itemsConHeader = items
      .map(it => {
        const header = movimientoPorId.get(it.movimiento_stock_id)
        if (!header) return null
        return { it, header }
      })
      .filter((x): x is { it: MovimientoItem; header: MovimientoHeader } => x !== null)
      .sort((a, b) => {
        const f = a.header.fecha_utc.localeCompare(b.header.fecha_utc)
        if (f !== 0) return f
        return a.header.creado_en.localeCompare(b.header.creado_en)
      })

    const corridoPorArticulo = new Map<number, number>()

    for (const { it, header } of itemsConHeader) {
      const sig = signo(header.tipo_movimiento_stock_id)
      const anterior = corridoPorArticulo.get(it.articulo_id) ?? 0
      const nuevoCorrido = anterior + sig * it.cantidad
      corridoPorArticulo.set(it.articulo_id, nuevoCorrido)

      const fila: MovimientoArticulo = {
        fecha_utc: header.fecha_utc,
        creado_en: header.creado_en,
        tipo_movimiento_stock_id: header.tipo_movimiento_stock_id,
        motivo: motivoDe(header),
        detalle: header.observaciones ?? '—',
        cantidadConSigno: sig * it.cantidad,
        stockCalculado: nuevoCorrido,
      }

      const lista = mapa.get(it.articulo_id) ?? []
      lista.push(fila)
      mapa.set(it.articulo_id, lista)
    }

    return mapa
  }, [items, movimientoPorId, subtipoPorId])

  const filasArticulos = useMemo(() => {
    return articulos
      .map(a => {
        const movs = movimientosPorArticulo.get(a.id) ?? []
        const movsEnRango = movs.filter(m =>
          (!fechaDesde || m.fecha_utc >= fechaDesde) &&
          (!fechaHasta || m.fecha_utc <= fechaHasta)
        )
        const ingreso = movsEnRango.filter(m => m.cantidadConSigno > 0).reduce((s, m) => s + m.cantidadConSigno, 0)
        const egreso = movsEnRango.filter(m => m.cantidadConSigno < 0).reduce((s, m) => s + Math.abs(m.cantidadConSigno), 0)
        const stockCalculado = movs.length > 0 ? movs[movs.length - 1].stockCalculado : 0
        const stockReal = stockPorArticulo.get(a.id) ?? 0
        const diferencia = Math.abs(stockCalculado - stockReal) > 0.001

        return { articulo: a, movsEnRango, ingreso, egreso, stockCalculado, stockReal, diferencia }
      })
      .filter(f => {
        const matchRubro = !filtroRubro || f.articulo.rubro_id === Number(filtroRubro)
        const matchMarca = !filtroMarca || f.articulo.marca_id === Number(filtroMarca)
        const matchNombre = !filtroNombre || f.articulo.nombre.toLowerCase().includes(filtroNombre.toLowerCase())
        const matchDiferencia = !soloConDiferencia || f.diferencia
        return matchRubro && matchMarca && matchNombre && matchDiferencia
      })
      .sort((a, b) => a.articulo.nombre.localeCompare(b.articulo.nombre))
  }, [articulos, movimientosPorArticulo, stockPorArticulo, filtroRubro, filtroMarca, filtroNombre, fechaDesde, fechaHasta, soloConDiferencia])

  const totales = useMemo(() => ({
    ingreso: filasArticulos.reduce((s, f) => s + f.ingreso, 0),
    egreso: filasArticulos.reduce((s, f) => s + f.egreso, 0),
    stock: filasArticulos.reduce((s, f) => s + f.stockReal, 0),
  }), [filasArticulos])

  function toggleExpandir(id: number) {
    setExpandidos(prev => {
      const nuevo = new Set(prev)
      nuevo.has(id) ? nuevo.delete(id) : nuevo.add(id)
      return nuevo
    })
  }

  function limpiarFiltros() {
    setFiltroRubro('')
    setFiltroMarca('')
    setFiltroNombre('')
    setFechaDesde('')
    setFechaHasta('')
    setSoloConDiferencia(false)
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-[#3c3c3b]">Historial de Artículos</h1>

      {/* Filtros */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 grid grid-cols-2 md:grid-cols-5 gap-4 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Rubro</label>
          <select value={filtroRubro} onChange={e => setFiltroRubro(e.target.value)}
            className="w-full h-8 px-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-[#00a19a]">
            <option value="">Todos</option>
            {rubros.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Marca</label>
          <select value={filtroMarca} onChange={e => setFiltroMarca(e.target.value)}
            className="w-full h-8 px-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-[#00a19a]">
            <option value="">Todas</option>
            {marcasDisponibles.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs text-gray-500 mb-1">Nombre de artículo</label>
          <input type="text" value={filtroNombre} onChange={e => setFiltroNombre(e.target.value)}
            placeholder="Buscar por nombre..."
            className="w-full h-8 px-3 border border-gray-300 rounded text-sm focus:outline-none focus:border-[#00a19a]" />
        </div>
        <button onClick={limpiarFiltros}
          className="h-8 px-3 border border-gray-300 rounded text-sm text-gray-500 hover:bg-gray-50">
          Limpiar filtros
        </button>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Mov. desde</label>
          <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)}
            min={FECHA_MIN} max={fechaMax()}
            onBlur={e => {
              if (fechaFueraDeRango(e.target.value)) { setFechaDesde(''); setErrFechaDesde(true) }
              else setErrFechaDesde(false)
            }}
            className={`w-full h-8 px-2 border rounded text-sm focus:outline-none focus:border-[#00a19a] ${errFechaDesde && !fechaDesde ? 'border-red-500' : 'border-gray-300'}`} />
          {errFechaDesde && !fechaDesde && (
            <p className="mt-1 text-xs text-red-600">Fecha fuera de rango, revisá el año</p>
          )}
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Hasta</label>
          <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)}
            min={FECHA_MIN} max={fechaMax()}
            onBlur={e => {
              if (fechaFueraDeRango(e.target.value)) { setFechaHasta(''); setErrFechaHasta(true) }
              else setErrFechaHasta(false)
            }}
            className={`w-full h-8 px-2 border rounded text-sm focus:outline-none focus:border-[#00a19a] ${errFechaHasta && !fechaHasta ? 'border-red-500' : 'border-gray-300'}`} />
          {errFechaHasta && !fechaHasta && (
            <p className="mt-1 text-xs text-red-600">Fecha fuera de rango, revisá el año</p>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 whitespace-nowrap pb-1.5">
          <input type="checkbox" checked={soloConDiferencia}
            onChange={e => setSoloConDiferencia(e.target.checked)}
            className="w-4 h-4 accent-[#00a19a]" />
          Solo con diferencia
        </label>
      </div>

      {/* Totales */}
      <div className="flex gap-6 text-sm text-gray-600 px-1">
        <span>Total Ingreso: <span className="font-semibold text-[#00a19a]">{totales.ingreso}</span></span>
        <span>Total Egreso: <span className="font-semibold text-red-500">{totales.egreso}</span></span>
        <span>Total Stock: <span className="font-semibold text-[#3c3c3b]">{totales.stock}</span></span>
      </div>

      {/* Listado */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {cargando ? (
          <div className="p-8 text-center text-gray-400 text-sm">Cargando...</div>
        ) : filasArticulos.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">Sin artículos que coincidan con los filtros</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left">Artículo</th>
                <th className="px-4 py-3 text-left">Rubro</th>
                <th className="px-4 py-3 text-left">Marca</th>
                <th className="px-4 py-3 text-right">Ingreso</th>
                <th className="px-4 py-3 text-right">Egreso</th>
                <th className="px-4 py-3 text-right">Stock Calculado</th>
                <th className="px-4 py-3 text-right">Stock</th>
              </tr>
            </thead>
            <tbody>
              {filasArticulos.map(f => {
                const expandido = expandidos.has(f.articulo.id)
                return (
                  <React.Fragment key={f.articulo.id}>
                    <tr
                      className={`border-t border-gray-100 hover:bg-gray-50 cursor-pointer ${f.diferencia ? 'bg-orange-50' : ''}`}
                      onClick={() => toggleExpandir(f.articulo.id)}
                    >
                      <td className="px-4 py-3 text-[#3c3c3b]">
                        <span className="text-gray-400 mr-1">{expandido ? '▲' : '▼'}</span>
                        {f.articulo.nombre}
                        {f.articulo.codigo_interno && (
                          <span className="text-gray-400 text-xs ml-1">({f.articulo.codigo_interno})</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{f.articulo.rubro_id ? rubroPorId.get(f.articulo.rubro_id) : '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{f.articulo.marca_id ? marcaPorId.get(f.articulo.marca_id) : '—'}</td>
                      <td className="px-4 py-3 text-right text-[#00a19a] font-medium">{f.ingreso}</td>
                      <td className="px-4 py-3 text-right text-red-500 font-medium">{f.egreso}</td>
                      <td className={`px-4 py-3 text-right font-medium ${f.diferencia ? 'text-orange-600' : 'text-gray-500'}`}>
                        {f.stockCalculado}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-[#3c3c3b]">{f.stockReal}</td>
                    </tr>

                    {expandido && (
                      <tr>
                        <td colSpan={7} className="p-0">
                          {f.movsEnRango.length === 0 ? (
                            <div className="px-8 py-3 text-xs text-gray-400 bg-gray-50">
                              Sin movimientos en el rango de fechas seleccionado.
                            </div>
                          ) : (
                            <table className="w-full text-xs bg-blue-50/40">
                              <thead className="text-gray-500 uppercase border-y border-blue-100">
                                <tr>
                                  <th className="px-4 py-2 text-left pl-10">Fecha</th>
                                  <th className="px-4 py-2 text-left">Tipo</th>
                                  <th className="px-4 py-2 text-left">Motivo</th>
                                  <th className="px-4 py-2 text-left">Detalle</th>
                                  <th className="px-4 py-2 text-right">Cantidad</th>
                                  <th className="px-4 py-2 text-right">Stock Calculado</th>
                                </tr>
                              </thead>
                              <tbody>
                                {f.movsEnRango.map((m, idx) => (
                                  <tr key={idx} className="border-t border-blue-100">
                                    <td className="px-4 py-2 pl-10 text-gray-600 whitespace-nowrap">{formatFecha(m.fecha_utc)}</td>
                                    <td className={m.tipo_movimiento_stock_id === 2 ? 'px-4 py-2 text-red-500' : 'px-4 py-2 text-[#00a19a]'}>
                                      {m.tipo_movimiento_stock_id === 1 ? 'Ingreso' : m.tipo_movimiento_stock_id === 2 ? 'Egreso' : 'Transferencia'}
                                    </td>
                                    <td className="px-4 py-2 text-gray-600">{m.motivo}</td>
                                    <td className="px-4 py-2 text-gray-500">{m.detalle}</td>
                                    <td className={`px-4 py-2 text-right font-medium ${m.cantidadConSigno < 0 ? 'text-red-500' : 'text-[#00a19a]'}`}>
                                      {m.cantidadConSigno > 0 ? '+' : ''}{m.cantidadConSigno}
                                    </td>
                                    <td className="px-4 py-2 text-right text-gray-600">{m.stockCalculado}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="text-xs text-gray-400 text-right">
        Mostrando {filasArticulos.length} artículo{filasArticulos.length !== 1 ? 's' : ''}
      </div>
    </div>
  )
}
