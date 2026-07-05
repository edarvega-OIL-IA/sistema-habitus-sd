'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Filter, ChevronDown, ChevronRight, Trash2, Pencil } from 'lucide-react'
import EditarItemsVentaModal from '@/components/ventas/EditarItemsVentaModal'

interface Venta {
  id: number
  numero_venta: number
  total: number
  subtotal: number
  descuento_pct: number
  ajuste_edicion_monto: number | null
  ajuste_edicion_tipo: string | null
  fecha_utc: string
  creado_en: string
  estado_venta_id: number
  estados_venta: { nombre: string } | null
  cierre_turno_id: number | null
  cierres_turno: { turno_id: number; turnos: { nombre: string } | null } | null
  venta_items: { cantidad: number; precio_unitario: number; descuento_pct: number; subtotal: number; articulos: { nombre: string } | null }[]
  venta_pagos: { monto: number; medios_pago: { nombre: string } | null; emisores_pago: { nombre: string } | null }[]
}

export default function RegistroVentasPage() {
  const [ventas, setVentas] = useState<Venta[]>([])
  const [loading, setLoading] = useState(true)
  const [expandida, setExpandida] = useState<number | null>(null)
  const [anulando, setAnulando] = useState<number | null>(null)
  const [confirmando, setConfirmando] = useState<number | null>(null)
  const [editando, setEditando] = useState<{ id: number; numero_venta: number; descuento_pct: number } | null>(null)

  // Filtros
  const [modoPeriodo, setModoPeriodo] = useState<'dia' | 'mes' | 'anio' | 'libre' | 'todos'>('dia')
  const [fechaRef, setFechaRef] = useState<Date>(new Date())
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [medioPago, setMedioPago] = useState('todos')
  const [estadoFiltro, setEstadoFiltro] = useState('todos')
  const [turnoFiltro, setTurnoFiltro] = useState('todos')
  const [cierreActivoId, setCierreActivoId] = useState<number | null>(null)

  useEffect(() => {
    async function detectarTurno() {
      const supabase = createClient()
      const { data } = await supabase
        .from('cierres_turno')
        .select('id, turno_id')
        .eq('sucursal_id', 1)
        .eq('estado_cierre_turno_id', 1)
        .maybeSingle()
      if (data) {
        setCierreActivoId(data.id)
        if (data.turno_id) setTurnoFiltro(data.turno_id.toString())
      }
    }
    detectarTurno()
    cargarVentas()
  }, [])

  async function cargarVentas() {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('ventas')
      .select(`
        id, numero_venta, total, subtotal, descuento_pct, ajuste_edicion_monto, ajuste_edicion_tipo,
        fecha_utc, creado_en, estado_venta_id, cierre_turno_id,
        estados_venta ( nombre ),
        cierres_turno ( turno_id, turnos(nombre) ),
        venta_items ( cantidad, precio_unitario, descuento_pct, subtotal, articulos(nombre) ),
        venta_pagos ( monto, medios_pago(nombre), emisores_pago(nombre) )
      `)
      .eq('sucursal_id', 1)
      .order('id', { ascending: false })
    setVentas(data as any || [])
    setLoading(false)
  }

  async function anularVenta(ventaId: number) {
    setAnulando(ventaId)
    try {
      const supabase = createClient()

      // Revertir stock: movimiento de Ingreso compensatorio con los mismos
      // artículos/cantidades de la venta original. El trigger
      // fn_aplicar_item_stock hace el ajuste real sobre articulo_stock —
      // reemplaza el UPDATE directo anterior, que revertía el número pero
      // no dejaba rastro en movimientos_stock (rompía la trazabilidad).
      const { data: items } = await supabase
        .from('venta_items')
        .select('articulo_id, cantidad')
        .eq('venta_id', ventaId)

      if (items && items.length > 0) {
        const { data: movStock, error: movStockError } = await supabase
          .from('movimientos_stock')
          .insert({
            sucursal_id: 1,
            tipo_movimiento_stock_id: 1, // Ingreso (reversión)
            estado_movimiento_stock_id: 2, // Confirmado
            origen_tipo: 'venta',
            origen_id: ventaId,
            observaciones: `Reversión por anulación de venta #${ventaId}`,
            fecha_utc: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }),
          })
          .select('id')
          .single()

        if (movStockError) {
          console.error('Error al revertir stock de venta', ventaId, ':', movStockError.message)
        } else {
          const { error: stockItemsError } = await supabase
            .from('movimiento_stock_items')
            .insert(items.map(item => ({
              movimiento_stock_id: movStock.id,
              articulo_id: item.articulo_id,
              cantidad: item.cantidad,
            })))
          if (stockItemsError) {
            console.error('Error al revertir items de stock de venta', ventaId, ':', stockItemsError.message)
          }
        }
      }

      const { error } = await supabase
        .from('ventas')
        .update({ estado_venta_id: 3 })
        .eq('id', ventaId)

      if (error) throw error

      // Revertir el ingreso en el ledger (movimientos) generado al confirmar la venta.
      // Si la venta nunca llegó a generar movimiento (falla previa), el delete simplemente no afecta filas.
      const { error: movError } = await supabase
        .from('movimientos')
        .delete()
        .eq('origen_tipo', 'venta')
        .eq('origen_id', ventaId)

      if (movError) {
        console.error('Error al revertir movimiento de venta', ventaId, ':', movError.message)
      }

      await cargarVentas()
      setConfirmando(null)
    } catch (err: any) {
      alert('Error al anular: ' + err.message)
    } finally {
      setAnulando(null)
    }
  }

  function getDesdHasta() {
    if (modoPeriodo === 'todos' || modoPeriodo === 'libre') return { desde: fechaDesde, hasta: fechaHasta }
    const y = fechaRef.getFullYear()
    const m = fechaRef.getMonth()
    const d = fechaRef.getDate()
    if (modoPeriodo === 'dia') {
      const s = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
      return { desde: s, hasta: s }
    }
    if (modoPeriodo === 'mes') {
      const desde = `${y}-${String(m+1).padStart(2,'0')}-01`
      const ultimo = new Date(y, m+1, 0).getDate()
      const hasta = `${y}-${String(m+1).padStart(2,'0')}-${String(ultimo).padStart(2,'0')}`
      return { desde, hasta }
    }
    if (modoPeriodo === 'anio') return { desde: `${y}-01-01`, hasta: `${y}-12-31` }
    return { desde: '', hasta: '' }
  }

  function avanzar() {
    const d = new Date(fechaRef)
    if (modoPeriodo === 'dia') d.setDate(d.getDate() + 1)
    else if (modoPeriodo === 'mes') d.setMonth(d.getMonth() + 1)
    else if (modoPeriodo === 'anio') d.setFullYear(d.getFullYear() + 1)
    setFechaRef(d)
  }

  function retroceder() {
    const d = new Date(fechaRef)
    if (modoPeriodo === 'dia') d.setDate(d.getDate() - 1)
    else if (modoPeriodo === 'mes') d.setMonth(d.getMonth() - 1)
    else if (modoPeriodo === 'anio') d.setFullYear(d.getFullYear() - 1)
    setFechaRef(d)
  }

  function labelFechaRef() {
    if (modoPeriodo === 'dia') return fechaRef.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'America/Argentina/Buenos_Aires' })
    if (modoPeriodo === 'mes') return fechaRef.toLocaleDateString('es-AR', { month: 'long', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' })
    if (modoPeriodo === 'anio') return fechaRef.getFullYear().toString()
    return ''
  }

  const { desde, hasta } = getDesdHasta()

  // Filtrado en cliente — igual que Movimientos
  const ventasFiltradas = ventas.filter(v => {
    // Fecha — comparar contra fecha_utc (DATE)
    if (desde && v.fecha_utc < desde) return false
    if (hasta && v.fecha_utc > hasta) return false
    // Estado
    if (estadoFiltro !== 'todos' && v.estado_venta_id?.toString() !== estadoFiltro) return false
    // Turno
    if (turnoFiltro !== 'todos' && (v.cierres_turno as any)?.turno_id?.toString() !== turnoFiltro) return false
    // Medio de pago
    if (medioPago !== 'todos') {
      const medios = v.venta_pagos?.map(p => p.medios_pago?.nombre) || []
      if (!medios.includes(medioPago)) return false
    }
    return true
  })

  const totalVentas = ventasFiltradas
    .filter(v => v.estado_venta_id !== 3)
    .reduce((s, v) => s + v.total, 0)

  const fmt = (n: number) => '$' + n.toLocaleString('es-AR', { minimumFractionDigits: 2 })
  const fmtHora = (s: string) => new Date(s).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-[#3c3c3b]">Registro de ventas</h1>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-700">Filtros</h2>
        </div>

        {/* Período */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {(['dia', 'mes', 'anio', 'libre'] as const).map(m => (
            <div key={m} className="flex items-center">
              {m !== 'libre' && modoPeriodo === m && (
                <button onClick={retroceder} className="w-7 h-7 flex items-center justify-center rounded-l border border-r-0 border-gray-300 hover:bg-gray-100 text-gray-600 text-sm">‹</button>
              )}
              <button
                onClick={() => setModoPeriodo(m)}
                className={`px-3 py-1.5 text-sm font-medium border transition-colors ${
                  modoPeriodo === m ? 'bg-[#00a19a] text-white border-[#00a19a]' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                } ${m !== 'libre' && modoPeriodo === m ? '' : 'rounded'}`}
              >
                {modoPeriodo === m && m !== 'libre' ? labelFechaRef() : m === 'dia' ? 'Día' : m === 'mes' ? 'Mes' : m === 'anio' ? 'Año' : 'Libre'}
              </button>
              {m !== 'libre' && modoPeriodo === m && (
                <button onClick={avanzar} className="w-7 h-7 flex items-center justify-center rounded-r border border-l-0 border-gray-300 hover:bg-gray-100 text-gray-600 text-sm">›</button>
              )}
            </div>
          ))}
          <button
            onClick={() => setModoPeriodo('todos')}
            className={`px-3 py-1.5 text-sm font-medium border rounded transition-colors ${
              modoPeriodo === 'todos' ? 'bg-[#00a19a] text-white border-[#00a19a]' : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50'
            }`}
          >
            Todos
          </button>
          {modoPeriodo !== 'todos' && (
            <div className="flex items-center gap-2 ml-2">
              <input type="date" value={desde}
                onChange={e => { setModoPeriodo('libre'); setFechaDesde(e.target.value) }}
                className="px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]" />
              <span className="text-gray-400 text-sm">—</span>
              <input type="date" value={hasta}
                onChange={e => { setModoPeriodo('libre'); setFechaHasta(e.target.value) }}
                className="px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]" />
            </div>
          )}
        </div>

        {/* Filtros secundarios */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Turno</label>
            <select value={turnoFiltro} onChange={e => setTurnoFiltro(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]">
              <option value="todos">Todos</option>
              <option value="1">Mañana</option>
              <option value="2">Tarde</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Medio de pago</label>
            <select value={medioPago} onChange={e => setMedioPago(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]">
              <option value="todos">Todos</option>
              <option value="Efectivo">Efectivo</option>
              <option value="Débito">Débito</option>
              <option value="Crédito">Crédito</option>
              <option value="Transferencia">Transferencia</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Estado</label>
            <select value={estadoFiltro} onChange={e => setEstadoFiltro(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]">
              <option value="todos">Todos</option>
              <option value="1">Pendiente fiscal</option>
              <option value="2">Guardada</option>
              <option value="3">Anulada</option>
              <option value="4">Fiscalizada</option>
            </select>
          </div>
        </div>
      </div>

      {/* Totales */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <p className="text-xs text-green-600 font-medium mb-1">Total ventas</p>
            <p className="text-2xl font-bold text-green-700">{fmt(totalVentas)}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <p className="text-xs text-gray-500 font-medium mb-1">Cantidad</p>
            <p className="text-2xl font-bold text-[#3c3c3b]">{ventasFiltradas.filter(v => v.estado_venta_id !== 3).length}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <p className="text-xs text-gray-500 font-medium mb-1">Ticket promedio</p>
            <p className="text-2xl font-bold text-[#3c3c3b]">
              {ventasFiltradas.filter(v => v.estado_venta_id !== 3).length > 0
                ? fmt(totalVentas / ventasFiltradas.filter(v => v.estado_venta_id !== 3).length)
                : '$0,00'}
            </p>
          </div>
        </div>
      </div>

      {/* Listado */}
      {loading ? (
        <p className="text-sm text-gray-400 text-center py-8">Cargando ventas...</p>
      ) : ventasFiltradas.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-500">No se encontraron ventas con los filtros aplicados.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <span className="text-xs text-gray-500">{ventasFiltradas.length} {ventasFiltradas.length === 1 ? 'venta' : 'ventas'}</span>
          </div>
          <div className="divide-y divide-gray-100">
            {ventasFiltradas.map(v => {
              const abierta = expandida === v.id
              const turnoNombre = (v.cierres_turno as any)?.turnos?.nombre || '—'
              const medios = (v.venta_pagos || []).map(p => p.medios_pago?.nombre).filter(Boolean)
              const mediosUnicos = [...new Set(medios)].join(' + ')
              const estadoChip = v.estado_venta_id === 3
                ? <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700">Anulada</span>
                : v.estado_venta_id === 1
                ? <span className="px-2 py-0.5 rounded-full text-xs bg-orange-100 text-orange-700">Pend. fiscal</span>
                : v.estado_venta_id === 4
                ? <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">Fiscalizada</span>
                : <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500">Guardada</span>

              return (
                <div key={v.id}>
                  <div
                    onClick={() => setExpandida(abierta ? null : v.id)}
                    className="w-full flex items-center px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <span className="w-6 text-gray-300">
                      {abierta ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </span>
                    <span className="w-24 font-medium text-[#3c3c3b] text-sm">#{v.numero_venta}</span>
                    <span className="w-28 text-xs text-gray-400">{v.fecha_utc.split('-').reverse().join('/')}</span>
                    <span className="w-20 text-xs text-gray-400">{fmtHora(v.creado_en)}</span>
                    <span className="w-20 text-xs text-gray-400">{turnoNombre}</span>
                    <span className="flex-1 text-xs text-gray-500">
                      {mediosUnicos}
                      {v.venta_items?.length > 0 && (
                        <span className="ml-2 font-medium text-[#3c3c3b]">
                          · {v.venta_items.reduce((s: number, i: any) => s + i.cantidad, 0)} art.
                        </span>
                      )}
                    </span>
                    <span className="w-32 flex justify-start">{estadoChip}</span>
                    <span className="w-32 text-right font-bold text-[#3c3c3b] text-sm">{fmt(v.total)}</span>
                    <span className="w-16 flex justify-end gap-2">
                      {v.estado_venta_id === 2 && v.cierre_turno_id !== null && v.cierre_turno_id === cierreActivoId && (
                        <>
                          <button
                            onClick={e => { e.stopPropagation(); setEditando({ id: v.id, numero_venta: v.numero_venta, descuento_pct: v.descuento_pct }) }}
                            className="text-gray-300 hover:text-[#00a19a] transition-colors"
                            title="Editar ítems (solo Guardada, turno activo)"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          {confirmando === v.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={e => { e.stopPropagation(); anularVenta(v.id) }}
                                disabled={anulando === v.id}
                                className="text-xs bg-red-500 text-white px-2 py-0.5 rounded hover:bg-red-600 disabled:opacity-50"
                              >
                                {anulando === v.id ? '...' : 'Confirmar'}
                              </button>
                              <button
                                onClick={e => { e.stopPropagation(); setConfirmando(null) }}
                                className="text-xs text-gray-400 hover:text-gray-600 px-1"
                              >✕</button>
                            </div>
                          ) : (
                            <button
                              onClick={e => { e.stopPropagation(); setConfirmando(v.id) }}
                              className="text-gray-300 hover:text-red-500 transition-colors"
                              title="Anular venta (solo Guardada, turno activo)"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </>
                      )}
                    </span>
                  </div>

                  {abierta && (
                    <div className="bg-gray-50 border-t-2 border-[#00a19a]/10 px-6 py-4 pl-11">
                      <table className="w-full text-xs mb-4">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="text-left pb-2 text-gray-400 font-semibold uppercase tracking-wide text-[10px]">Artículo</th>
                            <th className="text-center pb-2 text-gray-400 font-semibold uppercase tracking-wide text-[10px] w-16">Cant.</th>
                            <th className="text-right pb-2 text-gray-400 font-semibold uppercase tracking-wide text-[10px] w-28">Precio unit.</th>
                            <th className="text-right pb-2 text-gray-400 font-semibold uppercase tracking-wide text-[10px] w-28">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(v.venta_items || []).map((item: any, i: number) => (
                            <tr key={i} className="border-b border-gray-100 last:border-0">
                              <td className="py-2 text-gray-700">{item.articulos?.nombre || '—'}</td>
                              <td className="py-2 text-center text-gray-500">{item.cantidad}</td>
                              <td className="py-2 text-right text-gray-500">{fmt(item.precio_unitario)}</td>
                              <td className="py-2 text-right font-medium text-gray-700">{fmt(item.subtotal)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>Subtotal artículos</span>
                        <span>{fmt(v.subtotal)}</span>
                      </div>
                      {v.descuento_pct > 0 && (
                        <p className="text-xs text-gray-400 mb-1">Descuento general: {v.descuento_pct}%</p>
                      )}
                      {v.ajuste_edicion_monto !== null && v.ajuste_edicion_monto !== 0 && (
                        <p className={`text-xs mb-3 ${v.ajuste_edicion_tipo === 'descuento' ? 'text-red-500' : 'text-amber-600'}`}>
                          {v.ajuste_edicion_tipo === 'descuento' ? 'Descuento' : 'Recargo'} por edición de venta:{' '}
                          {v.ajuste_edicion_tipo === 'descuento' ? '−' : '+'}{fmt(Math.abs(v.ajuste_edicion_monto))}
                        </p>
                      )}
                      <div className="flex justify-end border-t border-gray-200 pt-3">
                        <div className="min-w-64">
                          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Forma de cobro</p>
                          <div className="space-y-1">
                            {(v.venta_pagos || []).map((pago: any, i: number) => (
                              <div key={i} className="flex justify-between text-xs">
                                <span className="text-gray-500">
                                  {pago.medios_pago?.nombre}
                                  {pago.emisores_pago?.nombre && ` — ${pago.emisores_pago.nombre}`}
                                </span>
                                <span className="font-medium text-gray-700">{fmt(pago.monto)}</span>
                              </div>
                            ))}
                          </div>
                          <div className="flex justify-between text-sm font-bold border-t border-gray-200 pt-2 mt-2">
                            <span className="text-gray-600">Total</span>
                            <span className="text-[#3c3c3b]">{fmt(v.total)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {editando && (
        <EditarItemsVentaModal
          ventaId={editando.id}
          numeroVenta={editando.numero_venta}
          descuentoPctGeneral={editando.descuento_pct}
          onClose={() => setEditando(null)}
          onSaved={() => { setEditando(null); cargarVentas() }}
        />
      )}
    </div>
  )
}
