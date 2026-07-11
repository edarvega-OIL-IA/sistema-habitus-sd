'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Plus, Filter, CheckCircle2, FileText, XCircle, ChevronDown, ChevronRight } from 'lucide-react'

interface ItemOrden {
  id: number
  articulo_id: number | null
  cantidad_facturada: number
  cantidad_recibida: number
  precio_unitario_sin_iva: number
  flete_prorrateado: number
  costo_final_unitario: number
  subtotal: number
  es_ajuste_redondeo: boolean
  articulos: { nombre: string } | null
}

interface OrdenCompra {
  id: number
  fecha_orden: string
  total: number
  subtotal: number
  flete_monto: number
  flete_transportista_id: number | null
  tiene_comprobante: boolean
  numero_factura_proveedor: string | null
  numero_remito_proveedor: string | null
  fecha_factura: string | null
  numero_pedido_externo: string | null
  observaciones: string | null
  proveedor_id: number | null
  estado_orden_compra_id: number | null
  proveedores: { nombre_comercial: string } | null
  estados_orden_compra: { nombre: string } | null
  orden_compra_items: ItemOrden[]
}

interface Proveedor { id: number; nombre_comercial: string }
interface EstadoOrden { id: number; nombre: string }

export default function ComprasPage() {
  const [ordenes, setOrdenes] = useState<OrdenCompra[]>([])
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [estados, setEstados] = useState<EstadoOrden[]>([])
  const [transportistas, setTransportistas] = useState<{id: number; nombre: string}[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandida, setExpandida] = useState<number | null>(null)
  const [notif, setNotif] = useState<{ tipo: 'error' | 'ok'; msg: string } | null>(null)
  const [anulando, setAnulando] = useState<number | null>(null)
  const [confirmandoAnular, setConfirmandoAnular] = useState<number | null>(null)

  // Filtros
  const [estadoFiltro, setEstadoFiltro] = useState('todos')
  const [proveedorFiltro, setProveedorFiltro] = useState('todos')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')

  // Modal comprobante
  const [editandoComprobante, setEditandoComprobante] = useState<number | null>(null)
  const [nroFactura, setNroFactura] = useState('')
  const [nroRemito, setNroRemito] = useState('')
  const [fechaFactura, setFechaFactura] = useState('')
  const [guardandoComp, setGuardandoComp] = useState(false)

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    const supabase = createClient()
    try {
      const [ordenesRes, provRes, estRes, transRes] = await Promise.all([
        supabase.from('ordenes_compra').select(`
          id, fecha_orden, total, subtotal, flete_monto, flete_transportista_id,
          tiene_comprobante, numero_factura_proveedor, numero_remito_proveedor,
          fecha_factura, numero_pedido_externo, observaciones,
          proveedor_id, estado_orden_compra_id,
          proveedores ( nombre_comercial ),
          estados_orden_compra ( nombre ),
          orden_compra_items (
            id, articulo_id, cantidad_facturada, cantidad_recibida,
            precio_unitario_sin_iva, flete_prorrateado, costo_final_unitario, subtotal,
            es_ajuste_redondeo,
            articulos ( nombre )
          )
        `).order('id', { ascending: false }),
        supabase.from('proveedores').select('id, nombre_comercial').eq('activo', true).order('nombre_comercial'),
        supabase.from('estados_orden_compra').select('id, nombre').order('id'),
        supabase.from('transportistas').select('id, nombre').eq('activo', true),
      ])
      if (ordenesRes.error) throw ordenesRes.error
      setOrdenes(ordenesRes.data as any || [])
      setProveedores(provRes.data || [])
      setEstados(estRes.data || [])
      setTransportistas(transRes.data || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function anularOrden(orden: OrdenCompra) {
    setAnulando(orden.id)
    const supabase = createClient()
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')
      const { data: usuarioData } = await supabase
        .from('usuarios').select('id, sucursal_id').eq('id', user.id).single()
      if (!usuarioData) throw new Error('Usuario no encontrado')
      const sucursalId = usuarioData.sucursal_id

      // Solo revertir si estaba Confirmada
      if (orden.estado_orden_compra_id === 2) {
        // 1. Revertir stock
        for (const it of orden.orden_compra_items) {
          const { data: stockEx } = await supabase
            .from('articulo_stock').select('id, stock_actual')
            .eq('articulo_id', it.articulo_id).eq('sucursal_id', sucursalId).maybeSingle()
          if (stockEx) {
            await supabase.from('articulo_stock')
              .update({ stock_actual: Math.max(0, stockEx.stock_actual - it.cantidad_recibida) })
              .eq('id', stockEx.id)
          }
        }

        // 2. Revertir costos — buscar historico anterior a esta orden por cada artículo
        for (const it of orden.orden_compra_items) {
          const { data: histPrevio } = await supabase
            .from('historico_precios')
            .select('costo_sin_iva')
            .eq('articulo_id', it.articulo_id)
            .eq('tipo', 'costo')
            .neq('origen_id', orden.id)
            .order('creado_en', { ascending: false })
            .limit(1)
            .maybeSingle()

          if (histPrevio) {
            await supabase.from('articulos')
              .update({ costo_sin_iva: histPrevio.costo_sin_iva })
              .eq('id', it.articulo_id)
          }
        }

        // 3. Anular movimientos (marcar anulado=true)
        await supabase.from('movimientos')
          .update({ anulado: true })
          .eq('origen_tipo', 'orden_compra')
          .eq('origen_id', orden.id)
      }

      // 4. Cambiar estado a Anulada
      await supabase.from('ordenes_compra')
        .update({ estado_orden_compra_id: 3 })
        .eq('id', orden.id)

      setConfirmandoAnular(null)
      setNotif({ tipo: 'ok', msg: `Orden #${orden.id} anulada correctamente.` })
      await cargarDatos()
    } catch (e: any) {
      setNotif({ tipo: 'error', msg: 'Error al anular: ' + e.message })
    } finally {
      setAnulando(null)
    }
  }

  async function guardarComprobante(ordenId: number) {
    setGuardandoComp(true)
    const supabase = createClient()
    try {
      await supabase.from('ordenes_compra').update({
        tiene_comprobante: true,
        numero_factura_proveedor: nroFactura || null,
        numero_remito_proveedor: nroRemito || null,
        fecha_factura: fechaFactura || null,
      }).eq('id', ordenId)
      setEditandoComprobante(null)
      setNotif({ tipo: 'ok', msg: 'Comprobante guardado.' })
      await cargarDatos()
    } catch (e: any) {
      setNotif({ tipo: 'error', msg: 'Error: ' + e.message })
    } finally {
      setGuardandoComp(false)
    }
  }

  function abrirComprobante(orden: OrdenCompra) {
    setNroFactura(orden.numero_factura_proveedor || '')
    setNroRemito(orden.numero_remito_proveedor || '')
    setFechaFactura(orden.fecha_factura || '')
    setEditandoComprobante(orden.id)
  }

  const ordenesFiltradas = ordenes.filter(o => {
    if (estadoFiltro !== 'todos' && o.estados_orden_compra?.nombre !== estadoFiltro) return false
    if (proveedorFiltro !== 'todos' && o.proveedor_id?.toString() !== proveedorFiltro) return false
    if (fechaDesde && o.fecha_orden < fechaDesde) return false
    if (fechaHasta && o.fecha_orden > fechaHasta) return false
    return true
  })

  const fmt = (n: number) => '$' + n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  if (loading) return <p className="text-sm text-gray-500">Cargando órdenes de compra...</p>
  if (error) return <p className="text-red-500 text-sm">Error: {error}</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-[#3c3c3b]">Órdenes de compra</h1>
        <Link href="/compras/nueva"
          className="bg-[#00a19a] text-white px-4 py-2 rounded text-sm hover:bg-[#008f89] flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nueva orden de compra
        </Link>
      </div>

      {/* Notificación */}
      {notif && (
        <div className={`rounded-lg border px-4 py-3 flex items-center justify-between gap-3 mb-4 ${
          notif.tipo === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'
        }`}>
          <p className="text-sm font-medium">{notif.msg}</p>
          <button onClick={() => setNotif(null)} className="opacity-50 hover:opacity-100 text-lg leading-none">✕</button>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-700">Filtros</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Estado</label>
            <select value={estadoFiltro} onChange={e => setEstadoFiltro(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]">
              <option value="todos">Todos</option>
              {estados.map(e => <option key={e.id} value={e.nombre}>{e.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Proveedor</label>
            <select value={proveedorFiltro} onChange={e => setProveedorFiltro(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]">
              <option value="todos">Todos los proveedores</option>
              {proveedores.map(p => <option key={p.id} value={p.id.toString()}>{p.nombre_comercial}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Desde</label>
            <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Hasta</label>
            <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]" />
          </div>
        </div>
        <p className="mt-3 text-xs text-gray-500">
          {ordenesFiltradas.length} {ordenesFiltradas.length === 1 ? 'orden' : 'órdenes'}
        </p>
      </div>

      {/* Listado */}
      {ordenesFiltradas.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-500">
            {ordenes.length === 0 ? 'No hay órdenes de compra registradas todavía.' : 'No se encontraron órdenes con los filtros aplicados.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="divide-y divide-gray-100">
            {ordenesFiltradas.map(orden => {
              const abierta = expandida === orden.id
              const estadoNombre = orden.estados_orden_compra?.nombre || ''
              const esAnulada = orden.estado_orden_compra_id === 3
              const esConfirmada = orden.estado_orden_compra_id === 2

              return (
                <div key={orden.id}>
                  {/* Fila principal */}
                  <div
                    onClick={() => setExpandida(abierta ? null : orden.id)}
                    className="flex items-center px-4 py-3 hover:bg-gray-50 cursor-pointer gap-3"
                  >
                    <span className="text-gray-300 w-5">
                      {abierta ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </span>
                    <span className="w-24 text-xs text-gray-500">
                      {orden.fecha_orden?.split('-').reverse().join('/')}
                    </span>
                    <span className="flex-1 font-medium text-[#3c3c3b] text-sm">
                      {orden.proveedores?.nombre_comercial || '—'}
                      {orden.numero_pedido_externo && (
                        <span className="ml-2 text-xs text-gray-400">Pedido #{orden.numero_pedido_externo}</span>
                      )}
                    </span>
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                      estadoNombre === 'Confirmada' ? 'bg-green-100 text-green-800' :
                      estadoNombre === 'Anulada' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {estadoNombre === 'Confirmada' && <CheckCircle2 className="w-3 h-3" />}
                      {estadoNombre === 'Anulada' && <XCircle className="w-3 h-3" />}
                      {estadoNombre === 'Borrador' && <FileText className="w-3 h-3" />}
                      {estadoNombre}
                    </span>
                    <span className="w-28 text-right text-xs text-gray-500">{fmt(orden.subtotal)}</span>
                    <span className="w-24 text-right text-xs text-gray-500">{fmt(orden.flete_monto || 0)}</span>
                    <span className="w-32 text-right font-bold text-[#3c3c3b] text-sm">{fmt(orden.total)}</span>
                    <span className="w-24 text-center">
                      {orden.tiene_comprobante
                        ? <span className="text-xs text-gray-500">{orden.numero_factura_proveedor || 'Con comprobante'}</span>
                        : esConfirmada
                          ? <button
                              onClick={e => { e.stopPropagation(); abrirComprobante(orden) }}
                              className="text-xs text-[#00a19a] hover:underline">
                              + Agregar
                            </button>
                          : <span className="text-gray-300 text-xs">—</span>
                      }
                    </span>
                    <span className="w-52 flex justify-end items-center gap-1">
                      {!esAnulada && (
                        <Link href={`/compras/${orden.id}`}
                          onClick={e => e.stopPropagation()}
                          className="text-xs text-gray-400 hover:text-[#00a19a] px-2 py-1 rounded hover:bg-[#00a19a]/10 transition-colors">
                          Editar
                        </Link>
                      )}
                      {!esAnulada && (
                        <Link href={`/articulos/precios?oc=${orden.id}`}
                          onClick={e => e.stopPropagation()}
                          className="text-xs text-gray-400 hover:text-[#00a19a] px-2 py-1 rounded hover:bg-[#00a19a]/10 transition-colors">
                          Precios
                        </Link>
                      )}
                      {!esAnulada && (
                        confirmandoAnular === orden.id ? (
                          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => anularOrden(orden)}
                              disabled={anulando === orden.id}
                              className="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 disabled:opacity-50">
                              {anulando === orden.id ? '...' : 'Confirmar'}
                            </button>
                            <button
                              onClick={() => setConfirmandoAnular(null)}
                              className="text-xs text-gray-400 hover:text-gray-600 px-1">✕</button>
                          </div>
                        ) : (
                          <button
                            onClick={e => { e.stopPropagation(); setConfirmandoAnular(orden.id) }}
                            className="text-xs text-gray-400 hover:text-red-500 transition-colors px-2 py-1 rounded hover:bg-red-50">
                            Anular
                          </button>
                        )
                      )}
                    </span>
                  </div>

                  {/* Detalle expandido */}
                  {abierta && (
                    <div className="bg-gray-50 border-t border-[#00a19a]/10 px-8 py-4">
                      {/* Items */}
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Artículos</p>
                      <table className="w-full text-xs mb-4">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="text-left pb-2 text-gray-400 font-semibold">Artículo</th>
                            <th className="text-center pb-2 text-gray-400 font-semibold w-20">Cant. Fact.</th>
                            <th className="text-center pb-2 text-gray-400 font-semibold w-20">Cant. Recib.</th>
                            <th className="text-right pb-2 text-gray-400 font-semibold w-32">P. Unit. s/IVA</th>
                            <th className="text-right pb-2 text-gray-400 font-semibold w-28">Flete prorrateado</th>
                            <th className="text-right pb-2 text-gray-400 font-semibold w-32">Costo final unit.</th>
                            <th className="text-right pb-2 text-gray-400 font-semibold w-28">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {orden.orden_compra_items.map(it => (
                            it.es_ajuste_redondeo ? (
                              <tr key={it.id} className="border-b border-gray-100 last:border-0 bg-amber-50">
                                <td className="py-2 text-amber-700 italic" colSpan={5}>Ajuste por redondeo</td>
                                <td className="py-2 text-right font-medium text-amber-700 italic"></td>
                                <td className="py-2 text-right font-medium text-amber-700 italic">{fmt(it.subtotal)}</td>
                              </tr>
                            ) : (
                              <tr key={it.id} className="border-b border-gray-100 last:border-0">
                                <td className="py-2 text-gray-700">{it.articulos?.nombre || '—'}</td>
                                <td className="py-2 text-center text-gray-500">{it.cantidad_facturada}</td>
                                <td className="py-2 text-center text-gray-500">{it.cantidad_recibida}</td>
                                <td className="py-2 text-right text-gray-500">{fmt(it.precio_unitario_sin_iva)}</td>
                                <td className="py-2 text-right text-gray-500">{fmt(it.flete_prorrateado || 0)}</td>
                                <td className="py-2 text-right font-medium text-[#3c3c3b]">{fmt(it.costo_final_unitario || 0)}</td>
                                <td className="py-2 text-right font-medium text-[#3c3c3b]">{fmt(it.subtotal)}</td>
                              </tr>
                            )
                          ))}
                        </tbody>
                      </table>

                      {/* Resumen flete + totales */}
                      <div className="flex justify-between items-start">
                        <div className="text-xs text-gray-500 space-y-1">
                          {orden.numero_pedido_externo && <p>Pedido externo: {orden.numero_pedido_externo}</p>}
                          {orden.flete_transportista_id && <p>Transportista: {transportistas.find(t => t.id === orden.flete_transportista_id)?.nombre}</p>}
                      {orden.numero_factura_proveedor && <p>Factura: {orden.numero_factura_proveedor}</p>}
                          {orden.numero_remito_proveedor && <p>Remito: {orden.numero_remito_proveedor}</p>}
                          {orden.fecha_factura && <p>Fecha factura: {orden.fecha_factura.split('-').reverse().join('/')}</p>}
                          {orden.observaciones && <p>Obs: {orden.observaciones}</p>}
                        </div>
                        <div className="text-xs space-y-1 min-w-48 text-right">
                          <div className="flex justify-between gap-8">
                            <span className="text-gray-500">Subtotal artículos:</span>
                            <span className="font-medium text-[#3c3c3b]">{fmt(orden.subtotal)}</span>
                          </div>
                          <div className="flex justify-between gap-8">
                            <span className="text-gray-500">Flete:</span>
                            <span className="font-medium text-[#3c3c3b]">{fmt(orden.flete_monto || 0)}</span>
                          </div>
                          <div className="flex justify-between gap-8 border-t border-gray-200 pt-1">
                            <span className="font-semibold text-gray-700">Total:</span>
                            <span className="font-bold text-[#00a19a]">{fmt(orden.total)}</span>
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

      {/* Modal agregar comprobante */}
      {editandoComprobante !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg border border-gray-200 p-6 w-full max-w-md shadow-xl">
            <h3 className="text-sm font-semibold text-[#3c3c3b] mb-4">Agregar comprobante</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nro. Factura</label>
                <input type="text" value={nroFactura} onChange={e => setNroFactura(e.target.value)}
                  placeholder="0001-00001234"
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nro. Remito</label>
                <input type="text" value={nroRemito} onChange={e => setNroRemito(e.target.value)}
                  placeholder="Opcional"
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Fecha factura</label>
                <input type="date" value={fechaFactura} onChange={e => setFechaFactura(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setEditandoComprobante(null)}
                className="px-4 py-2 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={() => guardarComprobante(editandoComprobante)}
                disabled={guardandoComp}
                className="px-4 py-2 bg-[#00a19a] text-white rounded text-sm hover:bg-[#008f89] disabled:opacity-50">
                {guardandoComp ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
