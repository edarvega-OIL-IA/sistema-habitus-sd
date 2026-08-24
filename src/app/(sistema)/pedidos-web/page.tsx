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
  marca: string | null
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
  cliente_id: number | null
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
  cancelado: { texto: 'Cancelado', clase: 'bg-gray-100 text-gray-500 border-gray-200' },
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
  const [mediosPago, setMediosPago] = useState<{ id: number; nombre: string }[]>([])
  const [marcasRespaldo, setMarcasRespaldo] = useState<Map<number, string>>(new Map())
  const [cancelandoId, setCancelandoId] = useState<number | null>(null)
  const [hayDevolucion, setHayDevolucion] = useState(false)
  const [montoDevuelto, setMontoDevuelto] = useState('')
  const [medioDevolucion, setMedioDevolucion] = useState<number | null>(null)

  useEffect(() => { cargarPedidos(); cargarMediosPago() }, [])

  async function cargarMediosPago() {
    const supabase = createClient()
    const { data } = await supabase.from('medios_pago').select('id, nombre').eq('activo', true).order('id')
    setMediosPago(data || [])
  }

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

    // Respaldo para pedidos de antes del fix del checkout (22/08/2026):
    // esos ítems nunca guardaron la marca en el momento de la compra —
    // se busca en vivo contra el catálogo actual solo para esos artículos
    // puntuales, sin tocar el dato histórico del pedido.
    const idsSinMarca = [...new Set(
      pedidosData.flatMap(p => p.items)
        .filter(it => it.marca === undefined || it.marca === null)
        .map(it => it.articulo_id)
    )]
    if (idsSinMarca.length > 0) {
      const { data: articulosData } = await supabase
        .from('articulos')
        .select('id, marca_id, marcas(nombre)')
        .in('id', idsSinMarca)
      const mapa = new Map<number, string>()
      ;(articulosData || []).forEach((a: any) => {
        if (a.marcas?.nombre) mapa.set(a.id, a.marcas.nombre)
      })
      setMarcasRespaldo(mapa)
    }

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
    return p.estado === 'pendiente_pago' || p.estado === 'pendiente_retiro' || (p.estado === 'confirmado' && !p.entregado_en)
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

      // Reclamo atómico — solo para pedidos todavía esperando el pago de
      // Mercado Pago (el cliente decidió pagar en persona en cambio). Va
      // DESPUÉS del chequeo de caja abierta a propósito: si reclamáramos
      // primero y la caja resultara cerrada, el pedido quedaría con el
      // estado ya cambiado pero sin borrador — colgado a mitad de camino.
      // Si el reclamo no se logra (0 filas), es porque el webhook de MP
      // ganó la carrera justo en simultáneo y ya está procesando el pago
      // real — frenamos acá para no generar una venta duplicada (mismo
      // mecanismo que ya usa webhook-mp/route.ts para el problema inverso).
      if (pedido.estado === 'pendiente_pago') {
        const { data: reclamado, error: reclamoError } = await supabase
          .from('pedidos_web')
          .update({ estado: 'pendiente_retiro' })
          .eq('id', pedido.id)
          .eq('estado', 'pendiente_pago')
          .select('id')
          .maybeSingle()

        if (reclamoError) throw new Error(reclamoError.message)
        if (!reclamado) {
          setError('Este pedido se acaba de pagar por Mercado Pago justo ahora — actualizá la pantalla, ya se está procesando solo.')
          setProcesando(null)
          return
        }
      }

      const itemsCarrito = pedido.items.map(it => {
        const marca = it.marca ?? marcasRespaldo.get(it.articulo_id) ?? null
        const partes = [it.nombre_base, it.sabor, marca].filter(Boolean)
        return {
          articulo_id: it.articulo_id,
          nombre: partes.join(' - '),
          precio_unitario: it.precio_unitario,
          cantidad: it.cantidad,
          descuento_pct: 0,
        }
      })

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
          cliente_id: pedido.cliente_id, // null es válido — el POS cae a Consumidor Final
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

  // Caso simple: pedido sin venta asociada — no hay stock ni plata que revertir.
  async function cancelarPedidoSimple(pedido: PedidoWeb) {
    setError(null)
    setProcesando(pedido.id)
    const supabase = createClient()
    const { error } = await supabase
      .from('pedidos_web')
      .update({ estado: 'cancelado' })
      .eq('id', pedido.id)
    setProcesando(null)
    if (error) { setError('Error al cancelar el pedido: ' + error.message); return }
    cargarPedidos()
  }

  // Caso intermedio: pedido con venta ya creada pero sin fiscalizar todavía.
  // Revierte stock (mismo patrón que "Anular" en Registro de Ventas — movimiento
  // de Ingreso compensatorio vía movimiento_stock_items, nunca UPDATE directo),
  // anula la venta, cancela el pedido, y si hubo devolución real de dinero
  // genera el movimiento financiero de Egreso correspondiente.
  async function cancelarYAnularVenta(pedido: PedidoWeb) {
    if (!pedido.venta_id) return
    setError(null)

    // Validar ANTES de tocar nada — si quedó tildado "hubo devolución" sin
    // completar monto/medio, cortamos acá. Nunca seguir de largo en silencio
    // (bug real 12/08/2026: quedó tildado el checkbox sin monto cargado y
    // la cancelación se confirmó igual, sin devolución registrada ni aviso).
    if (hayDevolucion) {
      const montoNum = Number(montoDevuelto)
      if (!montoDevuelto || montoNum <= 0) {
        setError('Tildaste que hubo devolución de dinero — cargá el monto antes de confirmar.')
        return
      }
      if (!medioDevolucion) {
        setError('Elegí el medio de pago de la devolución antes de confirmar.')
        return
      }
    }

    setProcesando(pedido.id)
    const supabase = createClient()
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')

      const { data: items } = await supabase
        .from('venta_items')
        .select('articulo_id, cantidad')
        .eq('venta_id', pedido.venta_id)

      if (items && items.length > 0) {
        const { data: movStock, error: movStockError } = await supabase
          .from('movimientos_stock')
          .insert({
            sucursal_id: pedido.sucursal_id,
            tipo_movimiento_stock_id: 1, // Ingreso (reversión)
            estado_movimiento_stock_id: 2, // Confirmado
            origen_tipo: 'venta',
            origen_id: pedido.venta_id,
            observaciones: `Reversión por cancelación de pedido web #${pedido.id}`,
            fecha_utc: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }),
          })
          .select('id')
          .single()

        if (movStockError) throw new Error('Error al revertir stock: ' + movStockError.message)

        const { error: stockItemsError } = await supabase
          .from('movimiento_stock_items')
          .insert(items.map(it => ({ movimiento_stock_id: movStock.id, articulo_id: it.articulo_id, cantidad: it.cantidad })))

        if (stockItemsError) throw new Error('Error al revertir stock: ' + stockItemsError.message)
      }

      const { error: ventaError } = await supabase
        .from('ventas')
        .update({ estado_venta_id: 3 }) // Anulada
        .eq('id', pedido.venta_id)
      if (ventaError) throw new Error('Error al anular la venta: ' + ventaError.message)

      const { error: pedidoError } = await supabase
        .from('pedidos_web')
        .update({ estado: 'cancelado' })
        .eq('id', pedido.id)
      if (pedidoError) throw new Error('Error al cancelar el pedido: ' + pedidoError.message)

      if (hayDevolucion) {
        const fechaHoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
        const { error: movError } = await supabase.from('movimientos').insert({
          sucursal_id: pedido.sucursal_id,
          tipo: 'Egreso',
          categoria_gasto_id: 14, // Devoluciones
          concepto_gasto_id: 45, // Devolución a cliente
          medio_pago_id: medioDevolucion,
          monto: Number(montoDevuelto),
          fecha_utc: fechaHoy,
          mes_contable: fechaHoy.slice(0, 7) + '-01',
          origen_tipo: 'venta',
          origen_id: pedido.venta_id,
          usuario_id: user.id,
        })
        if (movError) throw new Error('La venta se anuló pero falló el registro de la devolución: ' + movError.message)
      }

      setCancelandoId(null)
      setHayDevolucion(false)
      setMontoDevuelto('')
      setMedioDevolucion(null)
      cargarPedidos()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setProcesando(null)
    }
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
              const chipFacturacion = !p.venta_id ? null : facturada
                ? <span className="px-2 py-0.5 rounded-full text-[11px] bg-green-100 text-green-700">Fiscalizada</span>
                : <span className="px-2 py-0.5 rounded-full text-[11px] bg-gray-100 text-gray-500">Sin fiscalizar</span>

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
                    <span className="flex-1 text-xs text-gray-400 truncate">
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
                    <span className="w-32 flex justify-start shrink-0">{chipFacturacion}</span>
                    <span className="w-28 text-right font-bold text-[#3c3c3b] text-sm shrink-0">{fmt(p.total)}</span>
                    <span className="w-16 flex justify-end shrink-0" onClick={e => e.stopPropagation()}>
                      {facturada && p.venta_id && (
                        <button
                          onClick={() => descargarPDF(p.venta_id!)}
                          className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded hover:bg-gray-200 border border-gray-300 transition-colors"
                          title="Descargar PDF de la factura"
                        >
                          PDF
                        </button>
                      )}
                    </span>
                    <span className="flex justify-end gap-2 min-w-[140px]" onClick={e => e.stopPropagation()}>
                      {(p.estado === 'pendiente_retiro' || p.estado === 'pendiente_pago') && (
                        <button
                          onClick={() => cobrarEnCaja(p)}
                          disabled={procesando === p.id}
                          title={p.estado === 'pendiente_pago' ? 'El cliente eligió Mercado Pago pero no pagó — usar solo si va a pagar en persona' : undefined}
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
                          {p.items.map((it, i) => {
                            const marca = it.marca ?? marcasRespaldo.get(it.articulo_id) ?? null
                            return (
                              <tr key={i} className="border-b border-gray-100 last:border-0">
                                <td className="py-2 text-gray-700">
                                  {it.nombre_base}{it.sabor ? ` - ${it.sabor}` : ''}{marca ? ` - ${marca}` : ''}
                                </td>
                                <td className="py-2 text-center text-gray-500">{it.cantidad}</td>
                                <td className="py-2 text-right text-gray-500">{fmt(it.precio_unitario)}</td>
                                <td className="py-2 text-right font-medium text-gray-700">{fmt(it.subtotal)}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>

                      {/* Venta / Facturación */}
                      {p.venta_id ? (
                        <div className="flex items-center gap-2 flex-wrap border-t border-gray-200 pt-3">
                          <span className="text-xs text-gray-500">Venta #{numerosVenta.get(p.venta_id) ?? p.venta_id}</span>
                          {facturada && comprobante ? (
                            <>
                              <span className="text-[11px] text-gray-400">
                                Fiscalizada — {String(comprobante.punto_venta_id).padStart(4, '0')}-{String(comprobante.numero).padStart(8, '0')}
                              </span>
                              <button
                                type="button"
                                onClick={() => descargarPDF(p.venta_id!)}
                                className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded hover:bg-gray-200 border border-gray-300 transition-colors inline-flex items-center gap-1"
                              >
                                <FileText className="w-3 h-3" /> PDF
                              </button>
                            </>
                          ) : (
                            <span className="text-[11px] text-gray-400">Sin fiscalizar todavía</span>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 border-t border-gray-200 pt-3">Todavía no generó una venta.</p>
                      )}

                      {/* Cancelar — 3 casos según si hay venta y si está fiscalizada */}
                      {p.estado !== 'cancelado' && (
                        <div className="border-t border-gray-200 pt-3 mt-3">
                          {!p.venta_id ? (
                            // Caso simple: sin venta, nada que revertir
                            <button
                              type="button"
                              onClick={() => cancelarPedidoSimple(p)}
                              disabled={procesando === p.id}
                              className="text-xs text-red-600 hover:text-red-700 underline disabled:opacity-50"
                            >
                              {procesando === p.id ? 'Cancelando...' : 'Cancelar pedido'}
                            </button>
                          ) : facturada ? (
                            // Caso delicado: ya fiscalizada, requiere Nota de Crédito (no desarrollado)
                            <p className="text-xs text-gray-400">
                              Ya está fiscalizada — cancelarla requiere una Nota de Crédito (pendiente de desarrollar).
                            </p>
                          ) : cancelandoId === p.id ? (
                            // Caso intermedio: formulario de confirmación + devolución opcional
                            <div className="bg-red-50 border border-red-200 rounded p-3 space-y-2 max-w-md">
                              <p className="text-xs text-red-700 font-medium">
                                Esto va a anular la venta #{numerosVenta.get(p.venta_id) ?? p.venta_id} y revertir el stock.
                              </p>
                              <label className="flex items-center gap-2 text-xs text-gray-600">
                                <input
                                  type="checkbox"
                                  checked={hayDevolucion}
                                  onChange={e => setHayDevolucion(e.target.checked)}
                                />
                                Hubo devolución de dinero al cliente
                              </label>
                              {hayDevolucion && (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    placeholder="Monto devuelto"
                                    value={montoDevuelto}
                                    onChange={e => setMontoDevuelto(e.target.value)}
                                    className="w-32 border border-gray-300 rounded px-2 py-1 text-xs"
                                  />
                                  <select
                                    value={medioDevolucion ?? ''}
                                    onChange={e => setMedioDevolucion(e.target.value ? Number(e.target.value) : null)}
                                    className="border border-gray-300 rounded px-2 py-1 text-xs"
                                  >
                                    <option value="">Medio de pago</option>
                                    {mediosPago.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                                  </select>
                                </div>
                              )}
                              <div className="flex gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={() => cancelarYAnularVenta(p)}
                                  disabled={procesando === p.id}
                                  className="text-xs bg-red-600 text-white px-3 py-1.5 rounded hover:bg-red-700 disabled:opacity-50"
                                >
                                  {procesando === p.id ? 'Procesando...' : 'Confirmar cancelación'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setCancelandoId(null); setHayDevolucion(false); setMontoDevuelto(''); setMedioDevolucion(null) }}
                                  className="text-xs text-gray-500 hover:text-gray-700 px-2"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setCancelandoId(p.id)}
                              className="text-xs text-red-600 hover:text-red-700 underline"
                            >
                              Cancelar y anular venta
                            </button>
                          )}
                        </div>
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
