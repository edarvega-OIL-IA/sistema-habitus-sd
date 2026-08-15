'use client'

import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import BuscadorProductos from '@/components/ventas/BuscadorProductos'
import CarritoItems, { ItemCarrito } from '@/components/ventas/CarritoItems'
import PanelPagos from '@/components/ventas/PanelPagos'
import { Bookmark, XCircle, FileStack, Globe } from 'lucide-react'

interface BorradorVenta {
  id: number
  etiqueta: string | null
  items: ItemCarrito[]
  descuento_pct: number
  creado_en: string
  pedido_web_id: number | null
  cliente_id: number | null
}

interface ClienteSelector {
  id: number
  nombre: string
  tiene_cuenta_corriente: boolean
}

const CLIENTE_ID_CONSUMIDOR_FINAL = 1

export default function VentasPage() {
  const [items, setItems] = useState<ItemCarrito[]>([])
  const [descuento_pct, setDescuento_pct] = useState(0)
  const [notaInterna, setNotaInterna] = useState('')
  const [cajaAbierta, setCajaAbierta] = useState<boolean | null>(null)
  const [cierreId, setCierreId] = useState<number | null>(null)
  const [ventasRecientes, setVentasRecientes] = useState<any[]>([])
  const [usuarioId, setUsuarioId] = useState<string | null>(null)
  const [borradores, setBorradores] = useState<BorradorVenta[]>([])
  const [borradorActivoId, setBorradorActivoId] = useState<number | null>(null)
  // Cliente de la venta actual — arranca en Consumidor Final. Solo aparecen
  // acá Consumidor Final + clientes con cuenta corriente habilitada (no es
  // un buscador de los 73 clientes, es un selector chico para el caso
  // puntual de venta a crédito).
  const [clientesSelector, setClientesSelector] = useState<ClienteSelector[]>([])
  const [clienteId, setClienteId] = useState<number>(CLIENTE_ID_CONSUMIDOR_FINAL)
  // Si el carrito vino de un pedido de la vitrina web (a pagar en el
  // local), guardamos su id acá — al confirmar la venta, se actualiza
  // pedidos_web para cerrar el círculo automáticamente (ver ventaConfirmada).
  const [pedidoWebId, setPedidoWebId] = useState<number | null>(null)
  const [mostrarBorradores, setMostrarBorradores] = useState(false)
  const [guardandoBorrador, setGuardandoBorrador] = useState(false)
  const router = useRouter()

  useEffect(() => {
    async function verificarCaja() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setUsuarioId(user.id)

      const { data } = await supabase
        .from('cierres_turno')
        .select('id')
        .eq('sucursal_id', 1)
        .eq('estado_cierre_turno_id', 1)
        .maybeSingle()
      setCajaAbierta(!!data)
      if (data) {
        setCierreId(data.id)
        cargarVentasRecientes(data.id)
        cargarBorradores(data.id)
        cargarBorradorDesdeQuery()
        cargarClientesSelector()
      }
    }
    verificarCaja()
  }, [])

  async function cargarClientesSelector() {
    const supabase = createClient()
    const { data } = await supabase
      .from('clientes')
      .select('id, nombre, tiene_cuenta_corriente')
      .eq('activo', true)
      .or(`id.eq.${CLIENTE_ID_CONSUMIDOR_FINAL},tiene_cuenta_corriente.eq.true`)
      .order('nombre')
    setClientesSelector(data || [])
  }

  // Auto-carga el borrador si se llegó desde /pedidos-web con
  // ?borrador=<id> — sin useSearchParams para no forzar un Suspense
  // boundary acá (mismo criterio que ArticuloForm.tsx).
  async function cargarBorradorDesdeQuery() {
    const params = new URLSearchParams(window.location.search)
    const borradorParam = params.get('borrador')
    if (!borradorParam) return
    const supabase = createClient()
    const { data } = await supabase
      .from('ventas_borrador')
      .select('id, items, descuento_pct, pedido_web_id, cliente_id')
      .eq('id', Number(borradorParam))
      .maybeSingle()
    if (!data) return
    setItems(data.items)
    setDescuento_pct(data.descuento_pct)
    setBorradorActivoId(data.id)
    setPedidoWebId(data.pedido_web_id || null)
    setClienteId(data.cliente_id || CLIENTE_ID_CONSUMIDOR_FINAL)
  }

  async function cargarBorradores(cierreId: number) {
    const supabase = createClient()
    const { data } = await supabase
      .from('ventas_borrador')
      .select('id, etiqueta, items, descuento_pct, creado_en, pedido_web_id, cliente_id')
      .eq('cierre_turno_id', cierreId)
      .order('creado_en', { ascending: true })
    setBorradores(data || [])
  }

  async function cargarVentasRecientes(cierreId: number) {
    const supabase = createClient()
    const { data } = await supabase
      .from('ventas')
      .select(`
        id, numero_venta, total, creado_en,
        venta_pagos ( medio_pago_id, monto, medios_pago(nombre) )
      `)
      .eq('cierre_turno_id', cierreId)
      .neq('estado_venta_id', 3)
      .order('id', { ascending: false })
      .limit(10)
    setVentasRecientes(data || [])
  }

  const agregarItem = useCallback((articulo: any, cantidad: number) => {
    setItems(prev => {
      const existente = prev.findIndex(i => i.articulo_id === articulo.id)
      if (existente >= 0) {
        // Si ya existe, suma la cantidad
        const nuevo = [...prev]
        nuevo[existente] = {
          ...nuevo[existente],
          cantidad: nuevo[existente].cantidad + cantidad,
        }
        return nuevo
      }
      return [...prev, {
        articulo_id: articulo.id,
        nombre: articulo.nombre,
        precio_unitario: articulo.precio_local,
        cantidad,
        descuento_pct: 0,
      }]
    })
  }, [])

  const actualizarItem = useCallback((index: number, cantidad: number, descuento_pct: number) => {
    setItems(prev => {
      const nuevo = [...prev]
      nuevo[index] = { ...nuevo[index], cantidad, descuento_pct }
      return nuevo
    })
  }, [])

  const eliminarItem = useCallback((index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index))
  }, [])

  const ventaConfirmada = useCallback(async (ventaId: number) => {
    const supabase = createClient()
    // La venta ya se confirmó de verdad — recién ahora se borra el borrador
    // del que vino (si vino de uno). Si se cancela en cambio, el borrador
    // queda intacto en la lista.
    if (borradorActivoId) {
      await supabase.from('ventas_borrador').delete().eq('id', borradorActivoId)
      setBorradorActivoId(null)
    }
    // Si el carrito venía de un pedido de la vitrina web (retiro + pago en
    // el local), cerramos el círculo acá: queda marcado como confirmado y
    // enlazado a la venta real recién creada.
    // Si el carrito venía de un pedido de la vitrina web (retiro + pago en
    // el local), cerramos el círculo acá: queda marcado como confirmado,
    // enlazado a la venta real, y ENTREGADO — en este camino pagar y
    // retirar son el mismo momento, a diferencia del pago por Mercado
    // Pago (donde el retiro puede pasar horas después y se marca a mano
    // desde /pedidos-web).
    if (pedidoWebId) {
      await supabase.from('pedidos_web').update({
        estado: 'confirmado',
        venta_id: ventaId,
        entregado_en: new Date().toISOString(),
      }).eq('id', pedidoWebId)
      setPedidoWebId(null)
    }
    setItems([])
    setDescuento_pct(0)
    setNotaInterna('')
    setClienteId(CLIENTE_ID_CONSUMIDOR_FINAL)
    if (cierreId) {
      cargarVentasRecientes(cierreId)
      cargarBorradores(cierreId)
    }
  }, [cierreId, borradorActivoId, pedidoWebId])

  async function guardarBorrador() {
    if (items.length === 0 || !cierreId || !usuarioId) return
    const etiqueta = window.prompt('Nota para identificar este borrador (opcional, ej. "busca efectivo en el auto"):', '') || null
    setGuardandoBorrador(true)
    const supabase = createClient()
    const { error } = await supabase.from('ventas_borrador').insert({
      sucursal_id: 1,
      cierre_turno_id: cierreId,
      usuario_id: usuarioId,
      etiqueta,
      items,
      descuento_pct,
      pedido_web_id: pedidoWebId,
      cliente_id: clienteId,
    })
    if (!error && borradorActivoId) {
      // Si este carrito ya venía de un borrador, ese queda reemplazado por
      // la versión nueva — se borra el viejo para no duplicar.
      await supabase.from('ventas_borrador').delete().eq('id', borradorActivoId)
    }
    setGuardandoBorrador(false)
    if (error) { alert('Error al guardar el borrador: ' + error.message); return }
    setItems([])
    setDescuento_pct(0)
    setNotaInterna('')
    setBorradorActivoId(null)
    setPedidoWebId(null)
    setClienteId(CLIENTE_ID_CONSUMIDOR_FINAL)
    cargarBorradores(cierreId)
  }

  function restaurarBorrador(borrador: BorradorVenta) {
    // Si ya hay algo cargado en el carrito, confirmar antes de pisarlo.
    // No se borra nada acá — el borrador elegido recién se borra cuando la
    // venta se confirma de verdad (ver ventaConfirmada).
    if (items.length > 0 && !window.confirm('Hay una venta en curso en el carrito — se va a reemplazar por este borrador. ¿Continuar?')) {
      return
    }
    setItems(borrador.items)
    setDescuento_pct(borrador.descuento_pct)
    setBorradorActivoId(borrador.id)
    setPedidoWebId(borrador.pedido_web_id || null)
    setClienteId(borrador.cliente_id || CLIENTE_ID_CONSUMIDOR_FINAL)
    setMostrarBorradores(false)
  }

  async function eliminarBorrador(id: number) {
    if (!window.confirm('¿Eliminar este borrador? No se puede deshacer.')) return
    const supabase = createClient()
    const { error } = await supabase.from('ventas_borrador').delete().eq('id', id)
    if (error) { alert('Error al eliminar: ' + error.message); return }
    if (id === borradorActivoId) {
      setBorradorActivoId(null)
      setPedidoWebId(null)
    }
    if (cierreId) cargarBorradores(cierreId)
  }

  if (cajaAbierta === null) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-48px)]">
        <p className="text-sm text-gray-400">Verificando caja...</p>
      </div>
    )
  }

  if (!cajaAbierta) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-48px)]">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🔒</span>
          </div>
          <h2 className="text-lg font-semibold text-[#3c3c3b] mb-2">Caja cerrada</h2>
          <p className="text-sm text-gray-500 mb-6">
            Para registrar ventas es necesario abrir la caja primero.
          </p>
          <button
            onClick={() => router.push('/cierre-turno')}
            className="bg-[#00a19a] text-white px-6 py-2.5 rounded font-medium text-sm hover:bg-[#008f89] transition-colors"
          >
            Ir a Caja
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-48px)] -m-6 overflow-hidden">
      {/* Panel izquierdo — buscador + carrito */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Aviso de pedido web — solo cuando el carrito viene de uno */}
        {pedidoWebId && (
          <div className="px-4 py-2 bg-[#e8f7f6] border-b border-[#00a19a]/30 flex items-center gap-2 text-xs text-[#00796b]">
            <Globe className="w-3.5 h-3.5" />
            Cobrando pedido web #{pedidoWebId} — al confirmar, el pedido queda marcado como resuelto automáticamente.
          </div>
        )}

        {/* Buscador siempre arriba, con las acciones del carrito al lado */}
        <div className="p-4 border-b border-gray-200 bg-white flex items-center gap-3">
          {clientesSelector.length > 1 && (
            <select
              value={clienteId}
              onChange={e => setClienteId(Number(e.target.value))}
              title="Cliente de esta venta"
              className={`shrink-0 h-9 max-w-[180px] border rounded text-sm px-2 focus:outline-none focus:border-[#00a19a] ${
                clienteId !== CLIENTE_ID_CONSUMIDOR_FINAL ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-gray-300'
              }`}
            >
              {clientesSelector.map(c => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          )}
          <div className="flex-1">
            <BuscadorProductos onAgregarItem={agregarItem} />
          </div>
          {items.length > 0 && (
            <>
              <button
                onClick={guardarBorrador}
                disabled={guardandoBorrador}
                title="Guardar borrador"
                className="shrink-0 p-2 rounded border border-[#00a19a]/40 bg-[#00a19a]/10 text-[#00a19a] hover:bg-[#00a19a]/20 hover:border-[#00a19a] disabled:opacity-50 transition-colors"
              >
                <Bookmark className="w-5 h-5" />
              </button>
              <button
                onClick={() => { setItems([]); setBorradorActivoId(null); setPedidoWebId(null); setNotaInterna(''); setClienteId(CLIENTE_ID_CONSUMIDOR_FINAL) }}
                title="Cancelar venta (Ctrl+X)"
                className="shrink-0 p-2 rounded border border-red-300 bg-red-50 text-red-600 hover:bg-red-100 hover:border-red-400 transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </>
          )}
          <button
            onClick={() => setMostrarBorradores(true)}
            title="Ventas en borrador"
            className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded text-sm font-medium border transition-colors ${
              borradores.length > 0
                ? 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100'
                : 'bg-white border-gray-300 text-gray-400 hover:bg-gray-50'
            }`}
          >
            <FileStack className="w-4 h-4" />
            {borradores.length > 0 && borradores.length}
          </button>
        </div>

        {/* Lista de items o ventas recientes */}
        {items.length > 0 ? (
          <CarritoItems
            items={items}
            onActualizar={actualizarItem}
            onEliminar={eliminarItem}
          />
        ) : (
          <div className="flex-1 overflow-y-auto">
            {ventasRecientes.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-gray-400">Escaneá un producto para comenzar</p>
              </div>
            ) : (
              <div className="p-4">
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-3">Ventas del turno</p>
                <div className="space-y-2">
                  {ventasRecientes.map(v => {
                    const medios = (v.venta_pagos || []).map((p: any) => p.medios_pago?.nombre).filter(Boolean)
                    const mediosUnicos = [...new Set(medios)].join(' + ')
                    return (
                      <div key={v.id} className="bg-white rounded-lg border border-gray-200 px-4 py-3 flex items-center justify-between">
                        <div>
                          <span className="text-sm font-medium text-[#3c3c3b]">#{v.numero_venta}</span>
                          <span className="text-xs text-gray-400 ml-3">
                            {new Date(v.creado_en).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' })}
                          </span>
                          {mediosUnicos && (
                            <span className="text-xs text-gray-400 ml-3">{mediosUnicos}</span>
                          )}
                        </div>
                        <span className="text-sm font-bold text-[#3c3c3b]">
                          ${v.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Pie del carrito — nota interna + info, solo con items */}
        {items.length > 0 && (
          <div className="p-3 border-t border-gray-200 bg-white">
            <input
              type="text"
              value={notaInterna}
              onChange={e => setNotaInterna(e.target.value)}
              placeholder="Nota interna para esta venta (opcional, no va en la factura)"
              className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 mb-2 focus:outline-none focus:border-[#00a19a] placeholder:text-gray-400"
            />
            <div className="text-xs text-gray-400 flex justify-between items-center">
              <span>{items.length} líneas · {items.reduce((s, i) => s + i.cantidad, 0)} unidades</span>
              {guardandoBorrador && <span className="text-[#00a19a]">Guardando borrador...</span>}
            </div>
          </div>
        )}
      </div>

      {/* Panel derecho — pagos */}
      <PanelPagos
        items={items}
        descuento_pct={descuento_pct}
        onDescuentoChange={setDescuento_pct}
        onVentaConfirmada={ventaConfirmada}
        notaInterna={notaInterna}
        clienteId={clienteId}
        clienteTieneCtaCte={clientesSelector.find(c => c.id === clienteId)?.tiene_cuenta_corriente ?? false}
      />

      {mostrarBorradores && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg border border-gray-200 w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-base font-semibold text-[#3c3c3b]">Ventas en borrador — este turno</h2>
              <button onClick={() => setMostrarBorradores(false)} className="text-gray-400 hover:text-gray-600 text-sm">Cerrar</button>
            </div>
            <div className="overflow-y-auto flex-1">
              {borradores.length === 0 ? (
                <p className="p-6 text-sm text-gray-400 text-center">No hay borradores guardados en este turno.</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {borradores.map(b => {
                    const total = b.items.reduce((s, i) => s + i.precio_unitario * i.cantidad * (1 - (i.descuento_pct || 0) / 100), 0)
                      * (1 - (b.descuento_pct || 0) / 100)
                    const preview = b.items.map(i => `${i.cantidad > 1 ? i.cantidad + '× ' : ''}${i.nombre}`).join(', ')
                    const previewCorta = preview.length > 60 ? preview.slice(0, 60) + '…' : preview
                    return (
                      <div key={b.id} className="p-4 flex items-center justify-between gap-3 hover:bg-gray-50">
                        <button onClick={() => restaurarBorrador(b)} className="flex-1 text-left min-w-0">
                          <p className="text-sm font-medium text-[#3c3c3b] truncate">{previewCorta}</p>
                          {b.pedido_web_id && (
                            <p className="text-xs text-[#00a19a] mt-0.5 flex items-center gap-1"><Globe className="w-3 h-3" /> Pedido web #{b.pedido_web_id}</p>
                          )}
                          {b.etiqueta && (
                            <p className="text-xs text-amber-700 mt-0.5 truncate">📝 {b.etiqueta}</p>
                          )}
                          <p className="text-xs text-gray-400 mt-0.5">
                            {new Date(b.creado_en).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' })}
                            {' · '}{b.items.length} {b.items.length === 1 ? 'ítem' : 'ítems'}
                            {' · '}${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                          </p>
                        </button>
                        <button
                          onClick={() => eliminarBorrador(b.id)}
                          className="text-xs text-red-400 hover:text-red-600 shrink-0"
                        >
                          Eliminar
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
