'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, Trash2, Search, Save, AlertTriangle } from 'lucide-react'

interface Props {
  ventaId: number
  numeroVenta: number
  descuentoPctGeneral: number
  onClose: () => void
  onSaved: () => void
}

interface ItemEditable {
  articulo_id: number
  articulo_nombre: string
  cantidad: number
  precio_unitario: number
  descuento_pct: number
  subtotal: number
}

interface ArticuloBusqueda {
  id: number
  nombre: string
  codigo_interno: string | null
  codigo_barra: string | null
  rubro_nombre: string | null
  marca_nombre: string | null
  precio_local: number | null
}

const MEDIOS_PAGO = [
  { id: 1, nombre: 'Efectivo' },
  { id: 2, nombre: 'Débito' },
  { id: 3, nombre: 'Crédito' },
  { id: 4, nombre: 'Transferencia' },
  { id: 5, nombre: 'QR Mercado Pago' },
]
const MEDIOS_CON_EMISOR = ['Débito', 'Crédito']

interface EmisorPago {
  id: number
  nombre: string
}

// Quita acentos/mayúsculas para búsqueda tokenizada (mismo criterio que
// Artículos y Compras)
function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function parsearMonto(v: string): number {
  const raw = (v || '').trim()
  if (!raw) return 0
  const negativo = raw.startsWith('-')
  const s = negativo ? raw.slice(1) : raw
  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  const lastSep = Math.max(lastComma, lastDot)
  let n: number
  if (lastSep === -1) {
    n = parseFloat(s.replace(/[^\d]/g, ''))
  } else {
    const despues = s.slice(lastSep + 1).replace(/[^\d]/g, '')
    if (despues.length === 1 || despues.length === 2) {
      const entero = s.slice(0, lastSep).replace(/[.,]/g, '')
      n = parseFloat((entero || '0') + '.' + despues)
    } else {
      n = parseFloat(s.replace(/[.,]/g, ''))
    }
  }
  if (isNaN(n)) return 0
  return negativo ? -n : n
}
function fmtInput(n: number): string {
  if (!n) return ''
  return n.toLocaleString('es-AR', { maximumFractionDigits: 2 })
}
const fmt = (n: number) => '$' + n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function EditarItemsVentaModal({ ventaId, numeroVenta, descuentoPctGeneral, onClose, onSaved }: Props) {
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [itemsOriginales, setItemsOriginales] = useState<ItemEditable[]>([])
  const [items, setItems] = useState<ItemEditable[]>([])
  const [totalPagado, setTotalPagado] = useState(0)

  const [catalogo, setCatalogo] = useState<ArticuloBusqueda[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState<ArticuloBusqueda[]>([])
  const [indiceSeleccionado, setIndiceSeleccionado] = useState(-1)
  const busquedaRef = useRef<HTMLInputElement>(null)

  // Buffer de texto en edición para precios (evita que se pierda la coma/punto)
  const [precioTexto, setPrecioTexto] = useState<Record<number, string>>({})

  // Paso de confirmación tras guardar, si el nuevo total difiere de lo cobrado
  const [pasoDiferencia, setPasoDiferencia] = useState<{
    diferencia: number; medioPagoId: number; emisorPagoId: number; referencia: string
  } | null>(null)
  const [emisores, setEmisores] = useState<EmisorPago[]>([])

  useEffect(() => { cargarDatos() }, [])

  useEffect(() => {
    const termino = busqueda.trim()
    if (!termino) { setResultados([]); setIndiceSeleccionado(-1); return }
    const tokens = normalizar(termino).split(/\s+/).filter(Boolean)
    const filtrados = catalogo.filter(a => {
      const haystack = normalizar([a.nombre, a.codigo_interno, a.codigo_barra, a.rubro_nombre, a.marca_nombre].filter(Boolean).join(' '))
      return tokens.every(t => haystack.includes(t))
    })
    setResultados(filtrados.slice(0, 10))
    setIndiceSeleccionado(-1)
  }, [busqueda, catalogo])

  async function cargarDatos() {
    setCargando(true)
    const supabase = createClient()
    const [itemsRes, pagosRes, catalogoRes, emisoresRes] = await Promise.all([
      supabase.from('venta_items')
        .select('articulo_id, cantidad, precio_unitario, descuento_pct, subtotal, articulos(nombre)')
        .eq('venta_id', ventaId),
      supabase.from('venta_pagos').select('monto').eq('venta_id', ventaId),
      supabase.from('articulos')
        .select('id, nombre, codigo_interno, codigo_barra, precio_local, rubros(nombre), marcas(nombre)')
        .eq('activo', true).order('nombre'),
      supabase.from('emisores_pago').select('id, nombre').eq('activo', true).order('nombre'),
    ])
    setEmisores(emisoresRes.data || [])

    const itemsCargados: ItemEditable[] = (itemsRes.data || []).map((it: any) => ({
      articulo_id: it.articulo_id,
      articulo_nombre: it.articulos?.nombre || '(artículo eliminado)',
      cantidad: it.cantidad,
      precio_unitario: it.precio_unitario,
      descuento_pct: it.descuento_pct || 0,
      subtotal: it.subtotal,
    }))
    setItemsOriginales(itemsCargados)
    setItems(itemsCargados)
    setTotalPagado((pagosRes.data || []).reduce((s, p: any) => s + p.monto, 0))
    setCatalogo((catalogoRes.data || []).map((a: any) => ({
      ...a,
      rubro_nombre: a.rubros?.nombre || null,
      marca_nombre: a.marcas?.nombre || null,
    })))
    setCargando(false)
  }

  function agregarArticulo(art: ArticuloBusqueda) {
    if (items.find(i => i.articulo_id === art.id)) { setBusqueda(''); setResultados([]); return }
    const precio = art.precio_local || 0
    setItems(prev => [...prev, {
      articulo_id: art.id,
      articulo_nombre: art.nombre,
      cantidad: 1,
      precio_unitario: precio,
      descuento_pct: 0,
      subtotal: precio,
    }])
    setBusqueda(''); setResultados([])
  }

  function actualizarItem(index: number, campo: 'cantidad' | 'precio_unitario' | 'descuento_pct', valor: number) {
    setItems(prev => {
      const next = [...prev]
      next[index] = { ...next[index], [campo]: valor }
      const it = next[index]
      next[index].subtotal = it.cantidad * it.precio_unitario * (1 - it.descuento_pct / 100)
      return next
    })
  }

  function eliminarItem(index: number) {
    setItems(prev => prev.filter((_, i) => i !== index))
    setPrecioTexto(prev => {
      const next: Record<number, string> = {}
      Object.entries(prev).forEach(([k, v]) => {
        const i = Number(k)
        if (i < index) next[i] = v
        else if (i > index) next[i - 1] = v
      })
      return next
    })
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (resultados.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setIndiceSeleccionado(i => Math.min(i + 1, resultados.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIndiceSeleccionado(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' && indiceSeleccionado >= 0) { e.preventDefault(); agregarArticulo(resultados[indiceSeleccionado]) }
  }

  const subtotalArticulos = items.reduce((s, i) => s + i.subtotal, 0)
  const nuevoTotal = subtotalArticulos * (1 - descuentoPctGeneral / 100)
  const diferenciaVsOriginal = nuevoTotal - itemsOriginales.reduce((s, i) => s + i.subtotal, 0) * (1 - descuentoPctGeneral / 100)

  // Calcula, por artículo, cuánto hay que sumar/restar de stock (delta entre
  // el carrito original y el editado). Positivo = salió más mercadería
  // (Egreso); negativo = hay que reponer (Ingreso).
  function calcularDeltas(): Record<number, number> {
    const deltas: Record<number, number> = {}
    itemsOriginales.forEach(it => { deltas[it.articulo_id] = (deltas[it.articulo_id] || 0) - it.cantidad })
    items.forEach(it => { deltas[it.articulo_id] = (deltas[it.articulo_id] || 0) + it.cantidad })
    return deltas
  }

  async function guardar() {
    if (items.length === 0) { setErrorMsg('La venta debe tener al menos un artículo'); return }
    if (items.some(i => i.cantidad <= 0)) { setErrorMsg('Todas las cantidades deben ser mayores a 0'); return }
    if (items.some(i => i.precio_unitario <= 0)) { setErrorMsg('Todos los precios deben ser mayores a 0'); return }

    setGuardando(true)
    setErrorMsg(null)
    const supabase = createClient()
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuario no autenticado')

      // 1) Snapshot del carrito original antes de tocar nada
      if (itemsOriginales.length > 0) {
        const { error: histError } = await supabase.from('venta_items_historial').insert(
          itemsOriginales.map(it => ({
            venta_id: ventaId,
            articulo_id: it.articulo_id,
            cantidad: it.cantidad,
            precio_unitario: it.precio_unitario,
            descuento_pct: it.descuento_pct,
            subtotal: it.subtotal,
            editado_por_usuario_id: user.id,
          }))
        )
        if (histError) throw new Error('Error al guardar el historial: ' + histError.message)
      }

      // 2) Movimientos de stock por la diferencia neta (no se revierte todo,
      // solo el delta entre lo que había y lo que queda)
      const deltas = calcularDeltas()
      const positivos = Object.entries(deltas).filter(([, d]) => d > 0)
      const negativos = Object.entries(deltas).filter(([, d]) => d < 0)
      const fechaHoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })

      if (positivos.length > 0) {
        const { data: movEgreso, error: movEgresoError } = await supabase
          .from('movimientos_stock')
          .insert({
            sucursal_id: 1, tipo_movimiento_stock_id: 2, estado_movimiento_stock_id: 2,
            origen_tipo: 'venta', origen_id: ventaId,
            observaciones: `Ajuste por edición de venta #${numeroVenta}`,
            fecha_utc: fechaHoy,
          })
          .select('id').single()
        if (movEgresoError) throw new Error('Error al descontar stock: ' + movEgresoError.message)
        const { error: itemsEgresoError } = await supabase.from('movimiento_stock_items').insert(
          positivos.map(([articuloId, cant]) => ({
            movimiento_stock_id: movEgreso.id, articulo_id: Number(articuloId), cantidad: cant,
          }))
        )
        if (itemsEgresoError) throw new Error('Error al descontar stock (items): ' + itemsEgresoError.message)
      }

      if (negativos.length > 0) {
        const { data: movIngreso, error: movIngresoError } = await supabase
          .from('movimientos_stock')
          .insert({
            sucursal_id: 1, tipo_movimiento_stock_id: 1, estado_movimiento_stock_id: 2,
            origen_tipo: 'venta', origen_id: ventaId,
            observaciones: `Ajuste por edición de venta #${numeroVenta}`,
            fecha_utc: fechaHoy,
          })
          .select('id').single()
        if (movIngresoError) throw new Error('Error al reponer stock: ' + movIngresoError.message)
        const { error: itemsIngresoError } = await supabase.from('movimiento_stock_items').insert(
          negativos.map(([articuloId, cant]) => ({
            movimiento_stock_id: movIngreso.id, articulo_id: Number(articuloId), cantidad: Math.abs(cant),
          }))
        )
        if (itemsIngresoError) throw new Error('Error al reponer stock (items): ' + itemsIngresoError.message)
      }

      // 3) Reemplazar venta_items
      const { error: deleteError } = await supabase.from('venta_items').delete().eq('venta_id', ventaId)
      if (deleteError) throw new Error('Error al reemplazar los artículos: ' + deleteError.message)

      const { error: insertError } = await supabase.from('venta_items').insert(
        items.map(it => ({
          venta_id: ventaId,
          articulo_id: it.articulo_id,
          cantidad: it.cantidad,
          precio_unitario: it.precio_unitario,
          descuento_pct: it.descuento_pct,
          subtotal: it.subtotal,
        }))
      )
      if (insertError) throw new Error('Error al guardar los artículos nuevos: ' + insertError.message)

      // 4) Recalcular total de la venta
      const { error: ventaError } = await supabase
        .from('ventas')
        .update({ subtotal: subtotalArticulos, total: nuevoTotal })
        .eq('id', ventaId)
      if (ventaError) throw new Error('Error al actualizar el total: ' + ventaError.message)

      // 5) Si el nuevo total difiere de lo ya cobrado, preguntar qué hacer
      const diferenciaPago = Math.round((nuevoTotal - totalPagado) * 100) / 100
      if (Math.abs(diferenciaPago) >= 1) {
        setPasoDiferencia({ diferencia: diferenciaPago, medioPagoId: 1, emisorPagoId: 0, referencia: '' })
        setGuardando(false)
        return
      }

      onSaved()
    } catch (e: any) {
      setErrorMsg(e.message)
      setGuardando(false)
    }
  }

  // resolucion: 'cobrar' | 'devolver' -> movimiento real de plata (venta_pagos + movimientos)
  //             'ajuste'              -> sin movimiento real, se resuelve como descuento/recargo
  //                                       en ventas.ajuste_edicion_monto/tipo
  async function registrarDiferenciaPago(resolucion: 'cobrar' | 'devolver' | 'ajuste') {
    if (!pasoDiferencia) return

    if (resolucion !== 'ajuste') {
      const medioNombre = MEDIOS_PAGO.find(m => m.id === pasoDiferencia.medioPagoId)?.nombre ?? ''
      const requiereEmisor = MEDIOS_CON_EMISOR.includes(medioNombre)
      if (requiereEmisor && !pasoDiferencia.emisorPagoId) {
        setErrorMsg('Seleccioná el emisor (Visa, Master, etc.)')
        return
      }
    }

    setGuardando(true)
    setErrorMsg(null)
    const supabase = createClient()
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuario no autenticado')

      if (resolucion === 'cobrar' || resolucion === 'devolver') {
        const { error } = await supabase.from('venta_pagos').insert({
          venta_id: ventaId,
          medio_pago_id: pasoDiferencia.medioPagoId,
          emisor_pago_id: pasoDiferencia.emisorPagoId || null,
          monto: pasoDiferencia.diferencia, // negativo si es devolución
          referencia: pasoDiferencia.referencia.trim() || 'Ajuste por edición de venta',
        })
        if (error) throw new Error('Error al registrar el ajuste de pago: ' + error.message)

        // El ledger financiero (movimientos) es lo que alimenta Caja y
        // Dashboard — sin este insert, "Esperado en caja" queda desalineado
        // de lo que realmente entró o salió.
        const fechaHoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })

        // TODO — verificar contra producción: categoria_gasto_id/concepto_gasto_id
        // correctos para "Egreso por devolución a cliente". Por ahora reutiliza
        // los mismos que Ingreso (10/35) — INCORRECTO para el caso Egreso,
        // corregir antes de usar esta rama en un caso real de devolución.
        const { error: movError } = await supabase.from('movimientos').insert({
          sucursal_id: 1,
          tipo: resolucion === 'devolver' ? 'Egreso' : 'Ingreso',
          categoria_gasto_id: 10, concepto_gasto_id: 35, // Venta local — revisar para el caso Egreso
          monto: Math.abs(pasoDiferencia.diferencia), medio_pago_id: pasoDiferencia.medioPagoId,
          fecha_utc: fechaHoy, mes_contable: fechaHoy.slice(0, 7) + '-01',
          origen_tipo: 'venta', origen_id: ventaId,
          observaciones: `Ajuste por edición de venta #${numeroVenta}${resolucion === 'devolver' ? ' (devolución)' : ''}`,
          usuario_id: user.id,
        })
        if (movError) throw new Error('Error al registrar el movimiento de la diferencia: ' + movError.message)
      } else {
        // Ajuste contable puro: no entra/sale plata real. El total de la
        // venta se corrige para que vuelva a coincidir con lo YA cobrado —
        // queda registrado como descuento (si no se cobró de más) o recargo
        // (si no se devolvió el excedente), sin tocar descuento_pct/recargo_pct
        // (esos reflejan solo la venta original, este es un concepto aparte).
        const tipoAjuste: 'descuento' | 'recargo' = pasoDiferencia.diferencia > 0 ? 'descuento' : 'recargo'
        const { data: ventaActual, error: ventaFetchError } = await supabase
          .from('ventas').select('total').eq('id', ventaId).single()
        if (ventaFetchError) throw new Error('Error al leer la venta: ' + ventaFetchError.message)

        const nuevoTotalConAjuste = ventaActual.total - pasoDiferencia.diferencia
        const { error: ajusteError } = await supabase
          .from('ventas')
          .update({
            ajuste_edicion_monto: -pasoDiferencia.diferencia, // negativo=descuento, positivo=recargo
            ajuste_edicion_tipo: tipoAjuste,
            total: nuevoTotalConAjuste,
          })
          .eq('id', ventaId)
        if (ajusteError) throw new Error('Error al registrar el ajuste: ' + ajusteError.message)
      }
      onSaved()
    } catch (e: any) {
      setErrorMsg(e.message)
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white">
          <h2 className="text-lg font-semibold text-[#3c3c3b]">Editar ítems — Venta #{numeroVenta}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        {cargando ? (
          <div className="p-8 text-center text-gray-400 text-sm">Cargando...</div>
        ) : pasoDiferencia ? (
          <div className="p-6 space-y-4">
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">
                  El nuevo total {pasoDiferencia.diferencia > 0 ? 'es mayor' : 'es menor'} a lo ya cobrado
                </p>
                <p className="text-xs text-amber-700 mt-1">
                  Diferencia: <span className="font-semibold">{fmt(Math.abs(pasoDiferencia.diferencia))}</span>
                  {pasoDiferencia.diferencia > 0 ? ' a favor del local (falta cobrar)' : ' a favor del cliente (se cobró de más)'}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Medio de pago (solo si {pasoDiferencia.diferencia > 0 ? 'se cobra' : 'se devuelve'} ahora)
              </label>
              <select value={pasoDiferencia.medioPagoId}
                onChange={e => setPasoDiferencia(prev => prev ? { ...prev, medioPagoId: Number(e.target.value), emisorPagoId: 0 } : prev)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]">
                {MEDIOS_PAGO.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
              </select>
            </div>

            {MEDIOS_CON_EMISOR.includes(MEDIOS_PAGO.find(m => m.id === pasoDiferencia.medioPagoId)?.nombre ?? '') && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Emisor</label>
                <select value={pasoDiferencia.emisorPagoId}
                  onChange={e => setPasoDiferencia(prev => prev ? { ...prev, emisorPagoId: Number(e.target.value) } : prev)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]">
                  <option value={0}>Seleccionar emisor...</option>
                  {emisores.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nro. de operación (opcional)</label>
              <input type="text" value={pasoDiferencia.referencia}
                onChange={e => setPasoDiferencia(prev => prev ? { ...prev, referencia: e.target.value } : prev)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]" />
            </div>

            {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}

            <div className="space-y-2 pt-2 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                {pasoDiferencia.diferencia > 0
                  ? 'Si no se le cobra al cliente, la diferencia se registra como descuento (no mueve plata real).'
                  : 'Si no se le devuelve al cliente, la diferencia se registra como recargo (no mueve plata real).'}
              </p>
              <div className="flex gap-2 justify-end">
                <button onClick={() => registrarDiferenciaPago('ajuste')} disabled={guardando}
                  className="px-4 py-2 border border-gray-300 rounded text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                  {guardando ? 'Guardando...' : (pasoDiferencia.diferencia > 0 ? 'No cobrar — registrar como descuento' : 'No devolver — registrar como recargo')}
                </button>
                <button onClick={() => registrarDiferenciaPago(pasoDiferencia.diferencia > 0 ? 'cobrar' : 'devolver')} disabled={guardando}
                  className="px-4 py-2 bg-[#00a19a] text-white rounded text-sm hover:bg-[#008f89] disabled:opacity-50">
                  {guardando ? 'Guardando...' : (pasoDiferencia.diferencia > 0 ? 'Cobrar diferencia ahora' : 'Devolver ahora')}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-4">
            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{errorMsg}</div>
            )}

            <div className="relative">
              <label className="block text-xs font-medium text-gray-600 mb-1">Agregar artículo</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input ref={busquedaRef} type="text" value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Nombre, código, rubro o marca..."
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]" />
              </div>
              {resultados.length > 0 && (
                <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                  {resultados.map((art, i) => (
                    <button key={art.id} onClick={() => agregarArticulo(art)}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${i === indiceSeleccionado ? 'bg-gray-100' : ''}`}>
                      {art.nombre}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs text-gray-500 font-semibold">Artículo</th>
                    <th className="text-center px-3 py-2 text-xs text-gray-500 font-semibold w-20">Cant.</th>
                    <th className="text-right px-3 py-2 text-xs text-gray-500 font-semibold w-28">Precio unit.</th>
                    <th className="text-right px-3 py-2 text-xs text-gray-500 font-semibold w-28">Subtotal</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((item, index) => (
                    <tr key={index}>
                      <td className="px-3 py-2 text-[#3c3c3b]">{item.articulo_nombre}</td>
                      <td className="px-3 py-2">
                        <input type="number" min="1" step="1" value={item.cantidad}
                          onFocus={e => e.target.select()}
                          onChange={e => actualizarItem(index, 'cantidad', parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-center text-sm focus:outline-none focus:ring-1 focus:ring-[#00a19a]" />
                      </td>
                      <td className="px-3 py-2">
                        <input type="text" inputMode="decimal"
                          value={precioTexto[index] !== undefined ? precioTexto[index] : fmtInput(item.precio_unitario)}
                          onFocus={e => e.target.select()}
                          onChange={e => {
                            const raw = e.target.value
                            setPrecioTexto(prev => ({ ...prev, [index]: raw }))
                            actualizarItem(index, 'precio_unitario', parsearMonto(raw))
                          }}
                          onBlur={() => setPrecioTexto(prev => { const next = { ...prev }; delete next[index]; return next })}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-right text-sm focus:outline-none focus:ring-1 focus:ring-[#00a19a]" />
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-[#3c3c3b]">{fmt(item.subtotal)}</td>
                      <td className="px-3 py-2 text-center">
                        <button onClick={() => eliminarItem(index)} className="text-red-400 hover:text-red-600">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-400 text-sm">Sin artículos — buscá uno arriba para agregar</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end">
              <div className="min-w-64 space-y-1">
                {descuentoPctGeneral > 0 && (
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Descuento general</span><span>{descuentoPctGeneral}%</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Nuevo total</span>
                  <span className="font-bold text-[#3c3c3b]">{fmt(nuevoTotal)}</span>
                </div>
                {Math.abs(diferenciaVsOriginal) >= 1 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Diferencia vs. original</span>
                    <span className={diferenciaVsOriginal > 0 ? 'text-red-500' : 'text-green-600'}>
                      {diferenciaVsOriginal > 0 ? '+' : ''}{fmt(diferenciaVsOriginal)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2 border-t border-gray-200">
              <button onClick={onClose} disabled={guardando}
                className="px-4 py-2 border border-gray-300 rounded text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                Cancelar
              </button>
              <button onClick={guardar} disabled={guardando}
                className="px-4 py-2 bg-[#00a19a] text-white rounded text-sm hover:bg-[#008f89] disabled:opacity-50 flex items-center gap-2">
                <Save className="w-4 h-4" />
                {guardando ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
