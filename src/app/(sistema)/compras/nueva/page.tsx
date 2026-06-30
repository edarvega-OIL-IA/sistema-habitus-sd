'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Save, X, FileCheck, Search, Trash2 } from 'lucide-react'

interface Proveedor { id: number; nombre_comercial: string }
interface Transportista { id: number; nombre: string }
interface TasaIva { id: number; porcentaje: number }
interface Articulo {
  id: number; nombre: string
  codigo_interno: string | null; codigo_barra: string | null
  rubro_nombre: string | null; marca_nombre: string | null
  costo_sin_iva: number | null; tasa_iva_id: number | null
  precio_local: number | null; precio_web: number | null
  precio_mayorista: number | null; precio_oferta_web: number | null
}
interface ItemOrden {
  articulo_id: number; articulo_nombre: string
  tasa_iva_id: number | null
  precio_local: number | null; precio_web: number | null
  precio_mayorista: number | null; precio_oferta_web: number | null
  cant_facturada: number; cant_recibida: number
  precio_unitario: number; descuento_pct: number; subtotal: number
}

const MEDIOS_PAGO = [
  { id: 1, nombre: 'Efectivo' },
  { id: 2, nombre: 'Débito' },
  { id: 3, nombre: 'Crédito' },
  { id: 4, nombre: 'Transferencia' },
]

export default function ComprasNuevaPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [notif, setNotif] = useState<{ tipo: 'error' | 'ok'; msg: string } | null>(null)
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [transportistas, setTransportistas] = useState<Transportista[]>([])
  const [tasasIva, setTasasIva] = useState<TasaIva[]>([])
  const [articulos, setArticulos] = useState<Articulo[]>([])
  const [items, setItems] = useState<ItemOrden[]>([])

  // Form
  const [tieneComprobante, setTieneComprobante] = useState(false)
  const [nroFactura, setNroFactura] = useState('')
  const [nroRemito, setNroRemito] = useState('')
  const [fechaFactura, setFechaFactura] = useState('')
  const [proveedorId, setProveedorId] = useState<number | ''>('')
  const [fechaOrden, setFechaOrden] = useState(
    new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
  )
  const [nroPedidoExterno, setNroPedidoExterno] = useState('')
  const [medioPagoId, setMedioPagoId] = useState<number>(1)
  const [fleteMonto, setFleteMonto] = useState<number>(0)
  const [fleteFecha, setFleteFecha] = useState('')
  const [fleteTransportistaId, setFleteTransportistaId] = useState<number | ''>('')
  const [fleteMedioPagoId, setFleteMedioPagoId] = useState<number>(1)
  const [distribuirFlete, setDistribuirFlete] = useState(true)
  const [observaciones, setObservaciones] = useState('')

  // Buscador
  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState<Articulo[]>([])
  const [indiceSeleccionado, setIndiceSeleccionado] = useState(-1)
  const busquedaRef = useRef<HTMLInputElement>(null)
  const cantRef = useRef<HTMLInputElement>(null)

  useEffect(() => { cargarDatos() }, [])

  useEffect(() => {
    const termino = busqueda.trim()
    if (!termino) { setResultados([]); setIndiceSeleccionado(-1); return }
    const tokens = termino.toLowerCase().split(/\s+/)
    const filtrados = articulos.filter(a => {
      const haystack = [a.nombre, a.codigo_interno, a.codigo_barra, a.rubro_nombre, a.marca_nombre]
        .filter(Boolean).join(' ').toLowerCase()
      return tokens.every(t => haystack.includes(t))
    })
    setResultados(filtrados.slice(0, 12))
    setIndiceSeleccionado(-1)
  }, [busqueda, articulos])

  async function cargarDatos() {
    const supabase = createClient()
    const [provRes, transRes, artRes, tasasRes] = await Promise.all([
      supabase.from('proveedores').select('id, nombre_comercial').eq('activo', true).order('nombre_comercial'),
      supabase.from('transportistas').select('id, nombre').eq('activo', true).order('nombre'),
      supabase.from('articulos').select(`
        id, nombre, codigo_interno, codigo_barra, costo_sin_iva, tasa_iva_id,
        precio_local, precio_web, precio_mayorista, precio_oferta_web,
        rubros ( nombre ), marcas ( nombre )
      `).eq('activo', true).order('nombre'),
      supabase.from('tasas_iva').select('id, porcentaje'),
    ])
    setProveedores(provRes.data || [])
    setTransportistas(transRes.data || [])
    setTasasIva(tasasRes.data || [])
    setArticulos((artRes.data || []).map((a: any) => ({
      ...a,
      rubro_nombre: a.rubros?.nombre || null,
      marca_nombre: a.marcas?.nombre || null,
    })))
  }

  function getDivisorIva(tasaIvaId: number | null): number {
    const tasa = tasasIva.find(t => t.id === tasaIvaId)
    return tasa ? 1 + tasa.porcentaje / 100 : 1.21
  }

  function agregarArticulo(art: Articulo) {
    if (items.find(i => i.articulo_id === art.id)) {
      setBusqueda(''); setResultados([]); return
    }
    const divisor = getDivisorIva(art.tasa_iva_id)
    const precio = art.costo_sin_iva ? Math.round(art.costo_sin_iva * divisor * 100) / 100 : 0
    setItems(prev => [...prev, {
      articulo_id: art.id,
      articulo_nombre: art.nombre,
      tasa_iva_id: art.tasa_iva_id,
      precio_local: art.precio_local,
      precio_web: art.precio_web,
      precio_mayorista: art.precio_mayorista,
      precio_oferta_web: art.precio_oferta_web,
      cant_facturada: 1, cant_recibida: 1,
      precio_unitario: precio, descuento_pct: 0,
      subtotal: precio,
    }])
    setBusqueda(''); setResultados([])
    setTimeout(() => cantRef.current?.focus(), 50)
  }

  function actualizarItem(index: number, campo: keyof ItemOrden, valor: any) {
    setItems(prev => {
      const next = [...prev]
      next[index] = { ...next[index], [campo]: valor }
      if (campo === 'cant_facturada') next[index].cant_recibida = valor
      const it = next[index]
      const precioConDesc = it.precio_unitario * (1 - it.descuento_pct / 100)
      next[index].subtotal = it.cant_facturada * precioConDesc
      return next
    })
  }

  function eliminarItem(index: number) {
    setItems(prev => prev.filter((_, i) => i !== index))
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!resultados.length) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setIndiceSeleccionado(i => Math.min(i + 1, resultados.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setIndiceSeleccionado(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter' && indiceSeleccionado >= 0) { e.preventDefault(); agregarArticulo(resultados[indiceSeleccionado]) }
    if (e.key === 'Escape') { setResultados([]); setBusqueda('') }
  }

  function mostrarError(msg: string) {
    setNotif({ tipo: 'error', msg })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const subtotalArticulos = items.reduce((s, i) => s + i.subtotal, 0)
  const totalGeneral = subtotalArticulos + fleteMonto

  function costoConFlete(item: ItemOrden): number | null {
    if (!distribuirFlete || fleteMonto === 0 || subtotalArticulos === 0) return null
    const prop = item.subtotal / subtotalArticulos
    return (item.subtotal + fleteMonto * prop) / item.cant_recibida / getDivisorIva(item.tasa_iva_id)
  }

  function validar(): string | null {
    if (!proveedorId) return 'Seleccioná un proveedor'
    if (!fechaOrden) return 'La fecha es requerida'
    if (items.length === 0) return 'Agregá al menos un artículo'
    if (fleteMonto > 0 && !fleteTransportistaId) return 'Si hay flete, especificá el transportista'
    if (fleteMonto > 0 && !fleteFecha) return 'Si hay flete, especificá la fecha en que se pagó'
    return null
  }

  async function guardar(confirmar: boolean) {
    const err = validar()
    if (err) { mostrarError(err); return }
    if (confirmar && !confirm('¿Confirmar la orden? Se actualizará el stock y los costos de los artículos.')) return

    setLoading(true)
    setNotif(null)
    const supabase = createClient()

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')
      const { data: usuarioData } = await supabase
        .from('usuarios').select('id, sucursal_id').eq('id', user.id).single()
      if (!usuarioData) throw new Error('Usuario no encontrado')
      const sucursalId = usuarioData.sucursal_id

      // Calcular flete prorrateado
      const itemsConFlete = items.map(item => {
        const prop = subtotalArticulos > 0 ? item.subtotal / subtotalArticulos : 0
        const fleteItem = distribuirFlete ? fleteMonto * prop : 0
        const divisorIva = getDivisorIva(item.tasa_iva_id)
        const costoFinal = item.cant_recibida > 0
          ? (item.subtotal + fleteItem) / item.cant_recibida / divisorIva
          : item.precio_unitario / divisorIva
        return { ...item, flete_prorrateado: fleteItem, costo_final_unitario: costoFinal }
      })

      // Crear orden
      const { data: orden, error: ordenError } = await supabase
        .from('ordenes_compra')
        .insert({
          proveedor_id: proveedorId,
          fecha_orden: fechaOrden,
          tipo_orden_compra_id: tieneComprobante ? 2 : 1,
          estado_orden_compra_id: confirmar ? 2 : 1,
          tiene_comprobante: tieneComprobante,
          numero_factura_proveedor: tieneComprobante ? nroFactura || null : null,
          numero_remito_proveedor: tieneComprobante ? nroRemito || null : null,
          fecha_factura: tieneComprobante ? fechaFactura || null : null,
          numero_pedido_externo: nroPedidoExterno || null,
          flete_monto: fleteMonto,
          flete_fecha: fleteMonto > 0 ? fleteFecha || null : null,
          flete_medio_pago_id: fleteMonto > 0 ? fleteMedioPagoId : null,
          flete_transportista_id: fleteMonto > 0 && fleteTransportistaId ? fleteTransportistaId : null,
          sucursal_id: sucursalId,
          subtotal: subtotalArticulos,
          total: totalGeneral,
          observaciones: observaciones || null,
          usuario_id: usuarioData.id,
        })
        .select('id')
        .single()

      if (ordenError) throw new Error('Error al crear orden: ' + ordenError.message)
      const ordenId = orden.id

      // Insertar items
      await supabase.from('orden_compra_items').insert(
        itemsConFlete.map(it => ({
          orden_compra_id: ordenId,
          articulo_id: it.articulo_id,
          cantidad_facturada: it.cant_facturada,
          cantidad_recibida: it.cant_recibida,
          precio_unitario_sin_iva: it.precio_unitario / getDivisorIva(it.tasa_iva_id),
          flete_prorrateado: it.flete_prorrateado,
          costo_final_unitario: it.costo_final_unitario,
          subtotal: it.subtotal,
        }))
      )

      // Movimiento de MERCADERÍA — se genera siempre que el monto sea > 0,
      // sea Borrador o Confirmada (es una orden recién creada, nunca hay uno previo que actualizar)
      if (subtotalArticulos > 0) {
        const { error: movError } = await supabase.from('movimientos').insert({
          sucursal_id: sucursalId, tipo: 'Egreso',
          categoria_gasto_id: 1, concepto_gasto_id: 33,
          monto: subtotalArticulos, medio_pago_id: medioPagoId,
          fecha_utc: fechaOrden, mes_contable: fechaOrden.substring(0, 7) + '-01',
          origen_tipo: 'orden_compra', origen_id: ordenId, origen_subtipo: 'mercaderia',
          usuario_id: usuarioData.id,
          observaciones: `Compra a proveedor - Orden #${ordenId}`,
        })
        if (movError) console.error('Error al generar movimiento de mercadería:', movError.message)
      }

      // Movimiento de FLETE — solo si ya está pagado (monto > 0)
      if (fleteMonto > 0) {
        const transNombre = transportistas.find(t => t.id === fleteTransportistaId)?.nombre || ''
        const { error: movFleteError } = await supabase.from('movimientos').insert({
          sucursal_id: sucursalId, tipo: 'Egreso',
          categoria_gasto_id: 1, concepto_gasto_id: 44,
          monto: fleteMonto, medio_pago_id: fleteMedioPagoId,
          fecha_utc: fleteFecha || fechaOrden, mes_contable: (fleteFecha || fechaOrden).substring(0, 7) + '-01',
          origen_tipo: 'orden_compra', origen_id: ordenId, origen_subtipo: 'flete',
          usuario_id: usuarioData.id,
          observaciones: `Flete Orden #${ordenId}${transNombre ? ' - ' + transNombre : ''}`,
        })
        if (movFleteError) console.error('Error al generar movimiento de flete:', movFleteError.message)
      }

      // Stock + costo + histórico — SOLO si la orden se crea directamente Confirmada
      if (confirmar) {
        for (const it of itemsConFlete) {
          const { data: stockEx } = await supabase
            .from('articulo_stock').select('id, stock_actual')
            .eq('articulo_id', it.articulo_id).eq('sucursal_id', sucursalId).maybeSingle()
          if (stockEx) {
            await supabase.from('articulo_stock')
              .update({ stock_actual: stockEx.stock_actual + it.cant_recibida }).eq('id', stockEx.id)
          } else {
            await supabase.from('articulo_stock').insert({
              articulo_id: it.articulo_id, sucursal_id: sucursalId,
              stock_actual: it.cant_recibida, stock_min: 0, stock_max: null,
            })
          }

          const costoSinIva = it.costo_final_unitario
          const artPrevio = articulos.find(a => a.id === it.articulo_id)

          await supabase.from('historico_precios').insert({
            articulo_id: it.articulo_id, fecha: fechaOrden, tipo: 'costo',
            costo_sin_iva: costoSinIva,
            precio_local: artPrevio?.precio_local, precio_web: artPrevio?.precio_web,
            precio_mayorista: artPrevio?.precio_mayorista, precio_oferta_web: artPrevio?.precio_oferta_web,
            tasa_iva_id: it.tasa_iva_id, origen_id: ordenId, usuario_id: usuarioData.id,
          })

          // Una orden recién creada y confirmada siempre es la compra más reciente
          // (no puede haber otra orden posterior para el mismo artículo todavía)
          await supabase.from('articulos').update({ costo_sin_iva: costoSinIva }).eq('id', it.articulo_id)
        }
      }

      router.push('/compras')
      router.refresh()
    } catch (e: any) {
      mostrarError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function parsearMonto(v: string): number {
    return parseFloat(v.replace(/\./g, '').replace(',', '.')) || 0
  }
  function fmtInput(n: number): string {
    if (!n) return ''
    return n.toLocaleString('es-AR', { maximumFractionDigits: 2 })
  }
  const fmt = (n: number) => '$' + n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[#3c3c3b]">Nueva orden de compra</h1>
        <div className="flex gap-2">
          <button type="button" onClick={() => router.push('/compras')}
            className="px-4 py-2 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
            <X className="w-4 h-4" /> Cancelar
          </button>
          <button type="button" onClick={() => guardar(false)} disabled={loading}
            className="px-4 py-2 border border-[#00a19a] text-[#00a19a] rounded text-sm hover:bg-[#00a19a] hover:text-white flex items-center gap-2 disabled:opacity-50">
            <Save className="w-4 h-4" /> Guardar borrador
          </button>
          <button type="button" onClick={() => guardar(true)} disabled={loading}
            className="px-4 py-2 bg-[#00a19a] text-white rounded text-sm hover:bg-[#008f89] flex items-center gap-2 disabled:opacity-50">
            <FileCheck className="w-4 h-4" />
            {loading ? 'Procesando...' : 'Confirmar orden'}
          </button>
        </div>
      </div>

      {/* Notificación */}
      {notif && (
        <div className={`rounded-lg border px-4 py-3 flex items-center justify-between gap-3 ${
          notif.tipo === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'
        }`}>
          <p className="text-sm font-medium">{notif.msg}</p>
          <button onClick={() => setNotif(null)} className="opacity-50 hover:opacity-100 text-lg leading-none">✕</button>
        </div>
      )}

      {/* Comprobante */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-3">
          <input type="checkbox" id="tiene_comprobante" checked={tieneComprobante}
            onChange={e => setTieneComprobante(e.target.checked)}
            className="w-4 h-4 text-[#00a19a] border-gray-300 rounded focus:ring-[#00a19a]" />
          <label htmlFor="tiene_comprobante" className="text-sm font-semibold text-gray-700">
            Tiene comprobante (factura / remito)
          </label>
        </div>
        {tieneComprobante && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-200">
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
        )}
      </div>

      {/* Datos generales */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Datos de la orden</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Proveedor <span className="text-red-500">*</span></label>
            <select value={proveedorId} onChange={e => setProveedorId(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]">
              <option value="">Seleccionar proveedor</option>
              {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre_comercial}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Fecha (pedido / pago mercadería) <span className="text-red-500">*</span>
            </label>
            <input type="date" value={fechaOrden} onChange={e => setFechaOrden(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nro. Pedido externo</label>
            <input type="text" value={nroPedidoExterno} onChange={e => setNroPedidoExterno(e.target.value)}
              placeholder="Opcional"
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Medio de pago (mercadería)</label>
            <select value={medioPagoId} onChange={e => setMedioPagoId(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]">
              {MEDIOS_PAGO.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Artículos */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Artículos</h2>
        <div className="mb-4 relative">
          <label className="block text-xs font-medium text-gray-600 mb-1">Buscar artículo</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input ref={busquedaRef} type="text" value={busqueda}
              onChange={e => setBusqueda(e.target.value)} onKeyDown={handleKeyDown}
              placeholder="Nombre, código, rubro o marca — ej: 'creat ena'"
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]" />
          </div>
          {resultados.length > 0 && (
            <div className="absolute z-10 w-full mt-1 border border-gray-200 rounded bg-white shadow-lg max-h-64 overflow-y-auto">
              {resultados.map((art, i) => (
                <button key={art.id} type="button" onClick={() => agregarArticulo(art)}
                  className={`w-full text-left px-3 py-2 border-b border-gray-100 last:border-0 text-sm ${
                    i === indiceSeleccionado ? 'bg-[#00a19a]/10' : 'hover:bg-gray-50'
                  }`}>
                  <div className="font-medium text-[#3c3c3b]">{art.nombre}</div>
                  <div className="text-xs text-gray-400">
                    {[art.rubro_nombre, art.marca_nombre, art.codigo_interno, art.codigo_barra].filter(Boolean).join(' · ')}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tabla items */}
        {items.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm border border-gray-200 rounded">
            Usá el buscador para agregar artículos
          </div>
        ) : (
          <div className="overflow-x-auto border border-gray-200 rounded">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-3 py-2 text-xs text-gray-600 font-semibold">Artículo</th>
                  <th className="text-center px-3 py-2 text-xs text-gray-600 font-semibold w-20">Cant. Fact.</th>
                  <th className="text-center px-3 py-2 text-xs text-gray-600 font-semibold w-20">Cant. Recib.</th>
                  <th className="text-right px-3 py-2 text-xs text-gray-600 font-semibold w-36">Precio Unit. (c/IVA)</th>
                  <th className="text-right px-3 py-2 text-xs text-gray-600 font-semibold w-20">Desc. %</th>
                  <th className="text-right px-3 py-2 text-xs text-gray-600 font-semibold w-32">Subtotal</th>
                  {distribuirFlete && fleteMonto > 0 && (
                    <th className="text-right px-3 py-2 text-xs text-gray-500 font-semibold w-32">Costo c/flete</th>
                  )}
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item, index) => {
                  const cf = costoConFlete(item)
                  return (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-[#3c3c3b] font-medium text-xs">{item.articulo_nombre}</td>
                      <td className="px-3 py-2">
                        <input
                          ref={index === items.length - 1 ? cantRef : undefined}
                          type="number" min="0" step="1" value={item.cant_facturada}
                          onFocus={e => e.target.select()}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); busquedaRef.current?.focus() } }}
                          onChange={e => actualizarItem(index, 'cant_facturada', parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-center text-sm focus:outline-none focus:ring-1 focus:ring-[#00a19a]" />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" min="0" step="1" value={item.cant_recibida}
                          onFocus={e => e.target.select()}
                          onChange={e => actualizarItem(index, 'cant_recibida', parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-center text-sm focus:outline-none focus:ring-1 focus:ring-[#00a19a]" />
                      </td>
                      <td className="px-3 py-2">
                        <input type="text" inputMode="numeric" value={fmtInput(item.precio_unitario)}
                          onFocus={e => e.target.select()}
                          onChange={e => actualizarItem(index, 'precio_unitario', parsearMonto(e.target.value))}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-right text-sm focus:outline-none focus:ring-1 focus:ring-[#00a19a]" />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" min="0" max="100" step="0.01" value={item.descuento_pct}
                          onFocus={e => e.target.select()}
                          onChange={e => actualizarItem(index, 'descuento_pct', parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-right text-sm focus:outline-none focus:ring-1 focus:ring-[#00a19a]" />
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-[#3c3c3b]">
                        {fmt(item.subtotal)}
                      </td>
                      {distribuirFlete && fleteMonto > 0 && (
                        <td className="px-3 py-2 text-right text-xs text-gray-500">
                          {cf !== null ? fmt(cf) : '—'}
                        </td>
                      )}
                      <td className="px-3 py-2 text-center">
                        <button type="button" onClick={() => eliminarItem(index)}
                          className="text-red-400 hover:text-red-600 p-1">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Flete */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Flete</h2>
        <p className="text-xs text-gray-400 -mt-2 mb-4">
          Cargar solo cuando el flete ya fue pagado. Si todavía no se pagó, dejar en $0.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Monto</label>
            <input type="text" inputMode="numeric"
              value={fmtInput(fleteMonto)}
              onChange={e => setFleteMonto(parsearMonto(e.target.value))}
              placeholder="0,00"
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Fecha de pago del flete</label>
            <input type="date" value={fleteFecha} onChange={e => setFleteFecha(e.target.value)}
              disabled={fleteMonto === 0}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a] disabled:bg-gray-50" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Transportista</label>
            <select value={fleteTransportistaId}
              onChange={e => setFleteTransportistaId(Number(e.target.value) || '')}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]">
              <option value="">Seleccionar</option>
              {transportistas.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Medio de pago (flete)</label>
            <select value={fleteMedioPagoId} onChange={e => setFleteMedioPagoId(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]">
              {MEDIOS_PAGO.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" id="distribuir_flete" checked={distribuirFlete}
            onChange={e => setDistribuirFlete(e.target.checked)}
            className="w-4 h-4 text-[#00a19a] border-gray-300 rounded focus:ring-[#00a19a]" />
          <label htmlFor="distribuir_flete" className="text-xs text-gray-600">
            Distribuir en costo de artículos (proporcional al subtotal de cada uno)
          </label>
        </div>
      </div>

      {/* Resumen */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Resumen</h2>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Subtotal artículos:</span>
            <span className="font-semibold text-[#3c3c3b]">{fmt(subtotalArticulos)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Flete:</span>
            <span className="font-semibold text-[#3c3c3b]">{fmt(fleteMonto)}</span>
          </div>
          <div className="flex justify-between text-lg pt-2 border-t border-gray-200">
            <span className="font-bold text-[#3c3c3b]">Total:</span>
            <span className="font-bold text-[#00a19a]">{fmt(totalGeneral)}</span>
          </div>
          <p className="text-xs text-gray-400 pt-1">
            El total refleja la factura del proveedor. El flete se registra como movimiento separado, solo si ya fue pagado.
          </p>
        </div>
      </div>

      {/* Observaciones */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <label className="block text-xs font-medium text-gray-600 mb-2">Observaciones</label>
        <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)}
          rows={3} placeholder="Información adicional (opcional)"
          className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]" />
      </div>

    </div>
  )
}
