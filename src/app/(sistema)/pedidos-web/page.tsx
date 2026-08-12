// Ruta destino: C:\Users\Usuario\Documents\sistema-habitus-sd\src\app\(sistema)\pedidos-web\page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Globe, Package, CheckCircle2, ShoppingCart, AlertTriangle, MessageCircle, FileText, ChevronDown, ChevronRight } from 'lucide-react'

interface ItemPedido {
  articulo_id: number
  nombre_base: string
  sabor: string | null
  rubro_nombre: string | null
  cantidad: number
  precio_unitario: number
  subtotal: number
}

// Mismo valor que en fiscalizar.ts / pantalla de Fiscalización
const ESTADO_FISCAL_CAE_RECIBIDO = 3

interface Comprobante {
  venta_id: number
  numero: number
  punto_venta_id: number
  estado_fiscal_id: number
}

interface PedidoWeb {
  id: number
  sucursal_id: number
  estado: string
  medio_elegido: string
  cliente_nombre: string
  cliente_telefono: string
  cliente_email: string | null
  observaciones: string | null
  items: ItemPedido[]
  total: number
  venta_id: number | null
  entregado_en: string | null
  creado_en: string
}

// Estado de PAGO — separado del estado de ENTREGA (entregado_en, aparte).
const ETIQUETAS_ESTADO: Record<string, { texto: string; clase: string }> = {
  pendiente_pago: { texto: 'Esperando pago', clase: 'bg-amber-50 text-amber-700 border-amber-200' },
  pendiente_retiro: { texto: 'A cobrar en el local', clase: 'bg-blue-50 text-blue-700 border-blue-200' },
  confirmado: { texto: 'Pagado', clase: 'bg-green-50 text-green-700 border-green-200' },
  pago_rechazado: { texto: 'Pago rechazado', clase: 'bg-red-50 text-red-700 border-red-200' },
  pago_sin_stock: { texto: 'Pagado sin stock — revisar', clase: 'bg-red-50 text-red-700 border-red-200 font-medium' },
}

function fmtFecha(iso: string): string {
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires',
  })
}

function fmtFechaCorta(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', timeZone: 'America/Argentina/Buenos_Aires',
  })
}

function fmtHora(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-AR', {
    hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires',
  })
}

const fmt = (n: number) => '$' + n.toLocaleString('es-AR', { minimumFractionDigits: 2 })

function linkWhatsApp(telefono: string): string {
  const soloDigitos = telefono.replace(/\D/g, '')
  const numero = soloDigitos.startsWith('54') ? soloDigitos : `549${soloDigitos}`
  return `https://wa.me/${numero}`
}

export default function PedidosWebPage() {
  const router = useRouter()
  const [cargando, setCargando] = useState(true)
  const [pedidos, setPedidos] = useState<PedidoWeb[]>([])
  const [numerosVenta, setNumerosVenta] = useState<Map<number, number>>(new Map())
  const [comprobantesPorVenta, setComprobantesPorVenta] = useState<Map<number, Comprobante>>(new Map())
  const [filtro, setFiltro] = useState<'pendientes' | 'todos'>('pendientes')
  const [expandido, setExpandido] = useState<number | null>(null)
  const [procesando, setProcesando] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { cargarPedidos() }, [])

  async function cargarPedidos() {
    setCargando(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('pedidos_web')
      .select('*')
      .order('creado_en', { ascending: false })
      .limit(100)
    if (error) setError(error.message)
    const pedidosData = data || []
    setPedidos(pedidosData)

    const ventaIds = pedidosData.map(p => p.venta_id).filter((id): id is number => !!id)
    if (ventaIds.length > 0) {
      const { data: ventasData } = await supabase.from('ventas').select('id, numero_venta').in('id', ventaIds)
      setNumerosVenta(new Map((ventasData || []).map(v => [v.id, v.numero_venta])))

      const { data: comprobantesData } = await supabase
        .from('comprobantes')
        .select('venta_id, numero, punto_venta_id, estado_fiscal_id')
        .in('venta_id', ventaIds)
      setComprobantesPorVenta(new Map((comprobantesData || []).map(c => [c.venta_id, c])))
    }
    setCargando(false)
  }

  const pedidosVisibles = pedidos.filter(p => {
    if (filtro === 'todos') return true
    // "Pendientes" = necesita alguna acción de caja: a cobrar, o ya pagado
    // pero todavía no retirado físicamente.
    return p.estado === 'pendiente_retiro' || (p.estado === 'confirmado' && !p.entregado_en)
  })

  async function cobrarEnCaja(pedido: PedidoWeb) {
    setError(null)
    setProcesando(pedido.id)
    const supabase = createClient()
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')

      const { data: cierreActivo } = await supabase
        .from('cierres_turno')
        .select('id')
        .eq('sucursal_id', pedido.sucursal_id)
        .eq('estado_cierre_turno_id', 1)
        .maybeSingle()

      if (!cierreActivo) {
        setError('Abrí la caja primero para poder cobrar este pedido.')
        setProcesando(null)
        return
      }

      const itemsCarrito = pedido.items.map(it => ({
        articulo_id: it.articulo_id,
        nombre: it.sabor ? `${it.nombre_base} - ${it.sabor}` : it.nombre_base,
        precio_unitario: it.precio_unitario,
        cantidad: it.cantidad,
        descuento_pct: 0,
      }))

      const { data: borrador, error: borradorError } = await supabase
        .from('ventas_borrador')
        .insert({
          sucursal_id: pedido.sucursal_id,
          cierre_turno_id: cierreActivo.id,
          usuario_id: user.id,
          etiqueta: `Pedido web #${pedido.id} — ${pedido.cliente_nombre}`,
          items: itemsCarrito,
          descuento_pct: 0,
          pedido_web_id: pedido.id,
        })
        .select('id')
        .single()

      if (borradorError) throw new Error(borradorError.message)

      router.push(`/ventas?borrador=${borrador.id}`)
    } catch (err: any) {
      setError('Error al preparar el cobro: ' + err.message)
      setProcesando(null)
    }
  }

  async function marcarRetirado(pedido: PedidoWeb) {
    setError(null)
    setProcesando(pedido.id)
    const supabase = createClient()
    const { error } = await supabase
      .from('pedidos_web')
      .update({ entregado_en: new Date().toISOString() })
      .eq('id', pedido.id)
    setProcesando(null)
    if (error) { setError('Error al marcar como retirado: ' + error.message); return }
    cargarPedidos()
  }

  async function descargarPDF(ventaId: number) {
    try {
      const res = await fetch('/api/comprobantes/regenerar-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ venta_id: ventaId }),
      })
      const data = await res.json()
      if (data.ok && data.pdf_url) {
        window.open(data.pdf_url, '_blank')
      } else {
        alert('Error al obtener el PDF: ' + (data.mensaje || 'Desconocido'))
      }
    } catch (err: any) {
      alert('Error al descargar PDF: ' + err.message)
    }
  }

  if (cargando) {
    return <p className="text-sm text-gray-400">Cargando pedidos...</p>
  }

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-[#3c3c3b] flex items-center gap-2">
          <Globe className="w-5 h-5 text-[#00a19a]" /> Pedidos Web
        </h1>
        <p className="text-sm text-gray-500 mt-1">Pedidos hechos desde la vitrina online (habitussd.com).</p>
      </div>

      {error && (
        <div className="rounded-lg border px-4 py-3 flex items-center justify-between gap-3 mb-4 bg-red-50 border-red-200 text-red-700">
          <p className="text-sm font-medium">{error}</p>
          <button onClick={() => setError(null)} className="opacity-50 hover:opacity-100 text-lg leading-none">✕</button>
        </div>
      )}

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setFiltro('pendientes')}
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
            filtro === 'pendientes' ? 'bg-[#00a19a] border-[#00a19a] text-white' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
          }`}
        >
          Pendientes de acción
        </button>
        <button
          onClick={() => setFiltro('todos')}
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
            filtro === 'todos' ? 'bg-[#00a19a] border-[#00a19a] text-white' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
          }`}
        >
          Todos ({pedidos.length})
        </button>
      </div>

      {pedidosVisibles.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-sm text-gray-400">
          {filtro === 'pendientes' ? 'No hay pedidos pendientes de acción.' : 'Todavía no hay pedidos web.'}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <span className="text-xs text-gray-500">{pedidosVisibles.length} {pedidosVisibles.length === 1 ? 'pedido' : 'pedidos'}</span>
          </div>
          <div className="divide-y divide-gray-100">
            {pedidosVisibles.map(p => {
              const abierto = expandido === p.id
              const etiqueta = ETIQUETAS_ESTADO[p.estado] || { texto: p.estado, clase: 'bg-gray-50 text-gray-600 border-gray-200' }
              const comprobante = p.venta_id ? comprobantesPorVenta.get(p.venta_id) : undefined
              const facturada = comprobante?.estado_fiscal_id === ESTADO_FISCAL_CAE_RECIBIDO

              return (
                <div key={p.id}>
                  <div
                    onClick={() => setExpandido(abierto ? null : p.id)}
                    className="w-full flex items-center px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer flex-wrap gap-y-1"
                  >
                    <span className="w-6 text-gray-300 shrink-0">
                      {abierto ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </span>
                    <span className="w-16 font-medium text-[#3c3c3b] text-sm shrink-0">#{p.id}</span>
                    <span className="w-24 text-xs text-gray-400 shrink-0">
                      {fmtFechaCorta(p.creado_en)} {fmtHora(p.creado_en)}
                    </span>
                    <span className="w-40 text-sm text-[#3c3c3b] truncate shrink-0">{p.cliente_nombre}</span>
                    <span className="w-32 text-xs text-gray-400 shrink-0">
                      {p.medio_elegido === 'mercado_pago' ? 'Mercado Pago' : 'Retiro + efectivo'}
                    </span>
                    <span className="w-36 shrink-0">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full border ${etiqueta.clase}`}>{etiqueta.texto}</span>
                    </span>
                    <span className="w-32 shrink-0">
                      {p.entregado_en ? (
                        <span className="text-[11px] text-gray-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-[#00a19a]" /> Retirado {fmtFecha(p.entregado_en)}
                        </span>
                      ) : (
                        <span className="text-[11px] text-gray-400">Sin retirar</span>
                      )}
                    </span>
                    <span className="flex-1 min-w-[100px] text-right font-bold text-[#3c3c3b] text-sm">{fmt(p.total)}</span>
                    <span className="w-40 flex justify-end gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                      {p.estado === 'pendiente_retiro' && (
                        <button
                          onClick={() => cobrarEnCaja(p)}
                          disabled={procesando === p.id}
                          className="text-xs bg-[#00a19a] text-white px-3 py-1.5 rounded hover:bg-[#008f89] disabled:opacity-50 flex items-center gap-1.5"
                        >
                          <ShoppingCart className="w-3.5 h-3.5" />
                          {procesando === p.id ? 'Preparando...' : 'Cobrar en caja'}
                        </button>
                      )}
                      {p.estado === 'confirmado' && !p.entregado_en && (
                        <button
                          onClick={() => marcarRetirado(p)}
                          disabled={procesando === p.id}
                          className="text-xs border border-gray-300 text-gray-600 px-3 py-1.5 rounded hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1.5"
                        >
                          <Package className="w-3.5 h-3.5" />
                          {procesando === p.id ? '...' : 'Marcar retirado'}
                        </button>
                      )}
                      {p.estado === 'pago_sin_stock' && (
                        <p className="text-[11px] text-red-600 flex items-center gap-1 justify-end">
                          <AlertTriangle className="w-3 h-3" /> Reembolsar MP
                        </p>
                      )}
                    </span>
                  </div>

                  {abierto && (
                    <div className="bg-gray-50 border-t-2 border-[#00a19a]/10 px-6 py-4 pl-11">
                      {/* Cliente + WhatsApp */}
                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        <span className="text-sm text-[#3c3c3b]">{p.cliente_nombre} · {p.cliente_telefono}</span>
                        <a
                          href={linkWhatsApp(p.cliente_telefono)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-medium bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full hover:bg-green-100 transition-colors shrink-0"
                        >
                          <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                        </a>
                        {p.cliente_email && <span className="text-xs text-gray-400">· {p.cliente_email}</span>}
                      </div>

                      {p.observaciones && (
                        <p className="text-xs text-[#3c3c3b] mb-3 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 inline-block">
                          📝 {p.observaciones}
                        </p>
                      )}

                      {/* Ítems del pedido — mismo estilo de tabla que Registro de Ventas */}
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
                          {p.items.map((it, i) => (
                            <tr key={i} className="border-b border-gray-100 last:border-0">
                              <td className="py-2 text-gray-700">{it.nombre_base}{it.sabor ? ` - ${it.sabor}` : ''}</td>
                              <td className="py-2 text-center text-gray-500">{it.cantidad}</td>
                              <td className="py-2 text-right text-gray-500">{fmt(it.precio_unitario)}</td>
                              <td className="py-2 text-right font-medium text-gray-700">{fmt(it.subtotal)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {/* Venta / Facturación */}
                      {p.venta_id ? (
                        <div className="flex items-center gap-2 flex-wrap border-t border-gray-200 pt-3">
                          <span className="text-xs text-gray-500">Venta #{numerosVenta.get(p.venta_id) ?? p.venta_id}</span>
                          {facturada && comprobante ? (
                            <>
                              <span className="text-[11px] text-gray-400">
                                Facturada — {String(comprobante.punto_venta_id).padStart(4, '0')}-{String(comprobante.numero).padStart(8, '0')}
                              </span>
                              <button
                                type="button"
                                onClick={() => descargarPDF(p.venta_id!)}
                                className="inline-flex items-center gap-1 text-[11px] text-gray-600 hover:text-[#00a19a] underline"
                              >
                                <FileText className="w-3 h-3" /> PDF
                              </button>
                            </>
                          ) : (
                            <span className="text-[11px] text-gray-400">No facturada todavía</span>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 border-t border-gray-200 pt-3">Todavía no generó una venta.</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
