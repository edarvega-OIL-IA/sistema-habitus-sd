'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ItemCarrito } from './CarritoItems'

interface MedioPago {
  id: number
  nombre: string
  fiscaliza_por_defecto: boolean
}

interface EmisorPago {
  id: number
  nombre: string
  fiscaliza: boolean
}

interface PagoRegistrado {
  medio_pago_id: number
  nombre_medio: string
  emisor_pago_id: number | null
  nombre_emisor: string | null
  monto: number
  referencia: string | null
  fiscaliza: boolean
}

interface PanelPagosProps {
  items: ItemCarrito[]
  descuento_pct: number
  onDescuentoChange: (v: number) => void
  onVentaConfirmada: (ventaId: number) => void
}

const MEDIOS_CON_EMISOR = ['Débito', 'Crédito']

export default function PanelPagos({
  items,
  descuento_pct,
  onDescuentoChange,
  onVentaConfirmada,
}: PanelPagosProps) {
  const [mediosPago, setMediosPago] = useState<MedioPago[]>([])
  const [emisores, setEmisores] = useState<EmisorPago[]>([])
  const [pagos, setPagos] = useState<PagoRegistrado[]>([])
  const [medioSeleccionado, setMedioSeleccionado] = useState<number>(0)
  const [emisorSeleccionado, setEmisorSeleccionado] = useState<number>(0)
  const [montoPago, setMontoPago] = useState<string>('')
  const [referencia, setReferencia] = useState<string>('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [modoDescuento, setModoDescuento] = useState<'pct' | 'monto'>('pct')
  const [descuentoValor, setDescuentoValor] = useState<string>('')
  const [editandoIndex, setEditandoIndex] = useState<number | null>(null)
  const medioRef = useRef<HTMLSelectElement>(null)
  const btnFiscalizarRef = useRef<HTMLButtonElement>(null)
  const btnGuardarRef = useRef<HTMLButtonElement>(null)

  const subtotal = items.reduce((sum, item) =>
    sum + item.precio_unitario * item.cantidad * (1 - item.descuento_pct / 100), 0)

  // Calcular descuento en $ según modo
  const descuentoMonto = modoDescuento === 'pct'
    ? subtotal * (descuento_pct / 100)
    : parseFloat(descuentoValor) || 0
  const total = subtotal - descuentoMonto

  const totalPagado = pagos.reduce((sum, p) => sum + p.monto, 0)
  const pendiente = total - totalPagado
  const vuelto = pendiente < 0 ? Math.abs(pendiente) : 0
  const tieneEfectivo = pagos.some(p => p.nombre_medio === 'Efectivo')
  const debeFiscalizar = pagos.some(p => p.fiscaliza)
  const puedeConfirmar = items.length > 0 && pagos.length > 0 && pendiente <= 1 && (tieneEfectivo || vuelto <= 1)

  const medioNombreSeleccionado = mediosPago.find(m => m.id === medioSeleccionado)?.nombre ?? ''
  const requiereEmisor = MEDIOS_CON_EMISOR.includes(medioNombreSeleccionado)

  // Foco automático en botón correcto cuando pendiente llega a 0
  useEffect(() => {
    if (pagos.length === 0 || pendiente > 1) return
    setTimeout(() => {
      if (debeFiscalizar) btnFiscalizarRef.current?.focus()
      else btnGuardarRef.current?.focus()
    }, 50)
  }, [pagos, pendiente, debeFiscalizar])

  useEffect(() => {
    cargarDatos()
    function handleKey(e: KeyboardEvent) {
      if (e.ctrlKey && e.key === 'f') { e.preventDefault(); procesarVenta(true) }
      if (e.ctrlKey && e.key === 'g') { e.preventDefault(); procesarVenta(false) }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [pagos, items, total])

  async function cargarDatos() {
    const supabase = createClient()
    const [mediosRes, emisoresRes] = await Promise.all([
      supabase.from('medios_pago').select('id, nombre, fiscaliza_por_defecto').eq('activo', true).order('id'),
      supabase.from('emisores_pago').select('id, nombre, fiscaliza').eq('activo', true).order('nombre'),
    ])
    const medios = mediosRes.data || []
    setMediosPago(medios)
    setEmisores(emisoresRes.data || [])
    if (medios.length > 0) setMedioSeleccionado(medios[0].id)
  }

  function toggleModoDescuento() {
    if (modoDescuento === 'pct') {
      // Convertir % actual a $ para no perder referencia
      setDescuentoValor(descuentoMonto > 0 ? String(Math.round(descuentoMonto)) : '')
      setModoDescuento('monto')
      onDescuentoChange(0)
    } else {
      // Convertir $ actual a % 
      const pct = subtotal > 0 ? (parseFloat(descuentoValor) || 0) / subtotal * 100 : 0
      onDescuentoChange(Math.round(pct * 100) / 100)
      setDescuentoValor('')
      setModoDescuento('pct')
    }
  }

  function handleDescuentoChange(valor: string) {
    if (modoDescuento === 'pct') {
      onDescuentoChange(parseFloat(valor) || 0)
    } else {
      setDescuentoValor(valor)
    }
  }

  function agregarPago() {
    const monto = parseFloat(montoPago)
    if (!monto || monto <= 0) return
    const medio = mediosPago.find(m => m.id === medioSeleccionado)
    if (!medio) return
    if (requiereEmisor && !emisorSeleccionado) {
      setError('Seleccioná el emisor (Visa, Master, etc.)')
      return
    }
    const emisor = emisores.find(e => e.id === emisorSeleccionado)
    const fiscaliza = requiereEmisor && emisor ? emisor.fiscaliza : medio.fiscaliza_por_defecto
    const pagoActualizado: PagoRegistrado = {
      medio_pago_id: medio.id,
      nombre_medio: medio.nombre,
      emisor_pago_id: emisorSeleccionado || null,
      nombre_emisor: emisor?.nombre || null,
      monto,
      referencia: referencia || null,
      fiscaliza,
    }
    if (editandoIndex !== null) {
      // Modo edición: reemplaza el pago existente en su lugar, no agrega uno nuevo
      setPagos(prev => prev.map((p, i) => (i === editandoIndex ? pagoActualizado : p)))
      setEditandoIndex(null)
    } else {
      setPagos(prev => [...prev, pagoActualizado])
    }
    setMontoPago('')
    setReferencia('')
    setEmisorSeleccionado(0)
    setError(null)
    setTimeout(() => medioRef.current?.focus(), 50)
  }

  function iniciarEdicion(index: number) {
    const pago = pagos[index]
    setMedioSeleccionado(pago.medio_pago_id)
    setEmisorSeleccionado(pago.emisor_pago_id || 0)
    setMontoPago(String(pago.monto))
    setReferencia(pago.referencia || '')
    setEditandoIndex(index)
    setError(null)
    setTimeout(() => medioRef.current?.focus(), 50)
  }

  function cancelarEdicion() {
    setEditandoIndex(null)
    setMontoPago('')
    setReferencia('')
    setEmisorSeleccionado(0)
    setError(null)
  }

  function eliminarPago(index: number) {
    setPagos(prev => prev.filter((_, i) => i !== index))
    if (editandoIndex === index) cancelarEdicion()
  }

  async function procesarVenta(fiscalizar: boolean) {
    if (items.length === 0) { setError('Agregá al menos un producto'); return }
    if (pagos.length === 0) { setError('Agregá al menos un pago'); return }
    if (pendiente > 1) { setError('El monto pagado no cubre el total'); return }
    if (!tieneEfectivo && vuelto > 1) { setError('El monto debe coincidir con el total'); return }

    // Calcular descuento_pct final para enviar al backend
    const descuento_pct_final = modoDescuento === 'pct'
      ? descuento_pct
      : subtotal > 0 ? (parseFloat(descuentoValor) || 0) / subtotal * 100 : 0

    setGuardando(true)
    setError(null)
    try {
      const res = await fetch('/api/ventas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map(i => ({
            articulo_id: i.articulo_id,
            cantidad: i.cantidad,
            precio_unitario: i.precio_unitario,
            descuento_pct: i.descuento_pct,
          })),
          pagos: pagos.map(p => ({
            medio_pago_id: p.medio_pago_id,
            emisor_pago_id: p.emisor_pago_id,
            monto: p.monto,
            referencia: p.referencia,
          })),
          descuento_pct: descuento_pct_final,
          fiscalizar,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPagos([])
      setEditandoIndex(null)
      onDescuentoChange(0)
      setDescuentoValor('')
      setModoDescuento('pct')
      onVentaConfirmada(data.venta_id)
      alert(data.mensaje + ` — Venta #${data.numero_venta}`)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  const btnBase = "flex-1 h-11 rounded-lg text-sm focus:outline-none flex items-center justify-center gap-2 transition-colors"
  const btnVerde = btnBase + " bg-[#00a19a] border border-[#00a19a] text-white"
  const btnBlanco = btnBase + " bg-white border border-gray-300 text-gray-600 hover:bg-gray-50"
  const btnDis = btnBase + " bg-white border border-gray-300 text-gray-300 opacity-50 cursor-not-allowed"

  return (
    <div className="w-[440px] flex flex-col bg-gray-50 border-l border-gray-200">

      {/* Resumen */}
      <div className="p-4 border-b border-gray-200 bg-white space-y-1">

        <div className="flex justify-between items-baseline">
          <span className="text-sm text-gray-500">Subtotal ({items.length} items)</span>
          <span className="text-sm text-gray-500">${subtotal.toLocaleString('es-AR', { minimumFractionDigits: 0 })}</span>
        </div>

        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Descuento</span>
            <div className="flex items-center border border-gray-300 rounded overflow-hidden">
              <input
                type="text"
                inputMode="numeric"
                value={modoDescuento === 'pct' ? (descuento_pct || '') : descuentoValor}
                onChange={e => handleDescuentoChange(e.target.value.replace(/[^0-9,.]/g, ''))}
                className="w-16 h-6 text-center text-sm focus:outline-none px-1"
                placeholder="0"
              />
              <button
                onClick={toggleModoDescuento}
                className="h-6 px-2 bg-gray-100 border-l border-gray-300 text-xs font-medium text-gray-600 hover:bg-[#00a19a] hover:text-white transition-colors min-w-[24px]"
                title="Cambiar entre % y $"
              >
                {modoDescuento === 'pct' ? '%' : '$'}
              </button>
            </div>
          </div>
          <span className="text-sm text-red-500">
            {descuentoMonto > 0 ? `−${Math.round(descuentoMonto).toLocaleString('es-AR')}` : '—'}
          </span>
        </div>

        <div className="border-t border-gray-200 pt-1">
          <div className="flex justify-between items-baseline">
            <span className="text-sm font-medium text-[#3c3c3b]">Total</span>
            <span className="text-2xl font-semibold text-[#00a19a]">
              ${Math.max(0, total).toLocaleString('es-AR', { minimumFractionDigits: 0 })}
            </span>
          </div>
          {pagos.length > 0 && (
            vuelto > 0 ? (
              <div className="flex justify-between items-baseline pt-1">
                <span className="text-sm font-medium text-green-600">Vuelto</span>
                <span className="text-2xl font-bold text-green-600">
                  ${vuelto.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                </span>
              </div>
            ) : pendiente > 1 ? (
              <div className="flex justify-between items-baseline pt-1">
                <span className="text-sm font-medium text-red-600">Restan pagar</span>
                <span className="text-2xl font-bold text-red-600">
                  ${pendiente.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                </span>
              </div>
            ) : (
              <div className="flex justify-between items-baseline pt-1">
                <span className="text-sm text-gray-500">Pendiente</span>
                <span className="text-base font-semibold text-[#00a19a]">$0</span>
              </div>
            )
          )}
        </div>
      </div>

      {/* Pagos */}
      <div className="flex-1 p-4 overflow-y-auto">
        <div className="text-xs text-gray-500 font-medium mb-2 tracking-wide">PAGOS</div>

        {debeFiscalizar && (
          <div className="bg-[#e8f7f6] border border-[#00a19a] rounded-lg px-3 py-2 mb-3 text-xs text-[#00796b]">
            Este pago incluye medio que fiscaliza — se sugiere <strong>Ctrl+F</strong>
          </div>
        )}

        {pagos.map((pago, i) => (
          <div
            key={i}
            className={`border rounded-lg p-3 mb-2 ${
              editandoIndex === i
                ? 'bg-white border-[#00a19a] ring-1 ring-[#00a19a]'
                : 'bg-[#f0faf9] border-[#00a19a]/30'
            }`}
          >
            <div className="flex justify-between items-center">
              <span className="text-sm text-[#3c3c3b] flex items-center gap-1.5">
                <span className="text-[#00a19a]">✓</span>
                {pago.nombre_medio}
                {pago.nombre_emisor && <span className="text-gray-400"> · {pago.nombre_emisor}</span>}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-[#3c3c3b]">
                  ${pago.monto.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                </span>
                <button onClick={() => iniciarEdicion(i)} className="text-gray-300 hover:text-[#00a19a]" title="Editar pago">✎</button>
                <button onClick={() => eliminarPago(i)} className="text-gray-300 hover:text-red-500" title="Eliminar pago">✕</button>
              </div>
            </div>
            {pago.referencia && (
              <div className="text-xs text-gray-400 mt-1">Op. {pago.referencia}</div>
            )}
          </div>
        ))}

        {/* Agregar / editar pago */}
        {pagos.length > 0 && editandoIndex === null && (
          <div className="text-xs text-gray-400 font-medium mt-4 mb-1.5 tracking-wide">AGREGAR OTRO PAGO</div>
        )}
        <div className={`bg-gray-100 border rounded-lg p-3 ${pagos.length > 0 ? 'mt-1' : 'mt-2'} ${editandoIndex !== null ? 'border-[#00a19a] bg-white ring-1 ring-[#00a19a]' : 'border-gray-200'}`}>
          {editandoIndex !== null && (
            <div className="text-xs text-[#00a19a] font-medium mb-2">Editando pago #{editandoIndex + 1}</div>
          )}
          <select
            ref={medioRef}
            value={medioSeleccionado}
            onChange={e => { setMedioSeleccionado(parseInt(e.target.value)); setEmisorSeleccionado(0) }}
            className="w-full h-8 border border-gray-300 rounded text-sm mb-2 px-2 focus:outline-none focus:border-[#00a19a]"
          >
            {mediosPago.map(m => (
              <option key={m.id} value={m.id}>{m.nombre}</option>
            ))}
          </select>

          {requiereEmisor && (
            <select
              value={emisorSeleccionado}
              onChange={e => setEmisorSeleccionado(parseInt(e.target.value))}
              className="w-full h-8 border border-gray-300 rounded text-sm mb-2 px-2 focus:outline-none focus:border-[#00a19a]"
            >
              <option value={0}>Seleccionar emisor...</option>
              {emisores.map(e => (
                <option key={e.id} value={e.id}>{e.nombre}</option>
              ))}
            </select>
          )}

          <div className="flex gap-2 mb-2">
            <input
              type="text"
              inputMode="numeric"
              value={montoPago}
              onChange={e => setMontoPago(e.target.value.replace(/[^0-9,.]/g, ''))}
              onKeyDown={e => e.key === 'Enter' && agregarPago()}
              placeholder="$0"
              className="flex-1 min-w-0 h-8 border border-gray-300 rounded text-sm px-2 focus:outline-none focus:border-[#00a19a]"
            />
            <button
              onClick={agregarPago}
              className="h-8 px-3 bg-gray-100 border border-gray-300 rounded text-sm hover:bg-gray-200 whitespace-nowrap shrink-0"
            >
              {editandoIndex !== null ? 'Guardar' : '+ Agregar'}
            </button>
          </div>

          {editandoIndex !== null && (
            <button
              onClick={cancelarEdicion}
              className="text-xs text-gray-400 hover:text-gray-600 mb-2 block"
            >
              Cancelar edición
            </button>
          )}

          <input
            type="text"
            value={referencia}
            onChange={e => setReferencia(e.target.value)}
            placeholder="Nro. de operación (opcional)"
            className="w-full h-8 border border-gray-300 rounded text-sm px-2 focus:outline-none focus:border-[#00a19a]"
          />
        </div>
      </div>

      {/* Acciones */}
      <div className="p-4 border-t border-gray-200">
        {error && <p className="text-red-500 text-xs mb-2">{error}</p>}
        <div className="flex gap-2">
          <button
            ref={btnFiscalizarRef}
            onClick={() => procesarVenta(true)}
            disabled={guardando || !puedeConfirmar}
            className={!puedeConfirmar || guardando ? btnDis : (debeFiscalizar ? btnVerde : btnBlanco)}
          >
            Fiscalizar <kbd className={`text-xs px-1.5 py-0.5 rounded ${!puedeConfirmar || guardando ? 'bg-gray-100' : debeFiscalizar ? 'bg-white/25' : 'bg-gray-100'}`}>Ctrl+F</kbd>
          </button>
          <button
            ref={btnGuardarRef}
            onClick={() => procesarVenta(false)}
            disabled={guardando || !puedeConfirmar}
            className={!puedeConfirmar || guardando ? btnDis : (!debeFiscalizar ? btnVerde : btnBlanco)}
          >
            Guardar <kbd className={`text-xs px-1.5 py-0.5 rounded ${!puedeConfirmar || guardando ? 'bg-gray-100' : !debeFiscalizar ? 'bg-white/25' : 'bg-gray-100'}`}>Ctrl+G</kbd>
          </button>
        </div>
      </div>
    </div>
  )
}
