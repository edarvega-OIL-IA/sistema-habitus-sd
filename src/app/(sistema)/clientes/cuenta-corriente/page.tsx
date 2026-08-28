'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ChevronDown, ChevronRight, Plus, X } from 'lucide-react'
import { FECHA_MIN, fechaMax, fechaFueraDeRango } from '@/lib/fechaLimites'

interface Cliente {
  id: number
  nombre: string
  plazo_dias_cta_cte: number | null
}

interface MedioPago {
  id: number
  nombre: string
}

interface MovimientoCtaCte {
  id: string
  tipo: 'Cargo' | 'Cobro'
  fecha: string
  monto: number
  detalle: string
}

const NOMBRE_MEDIO_CTA_CTE = 'Cuenta Corriente'
const NOMBRE_CONCEPTO_COBRO = 'Cobro Cuenta Corriente'

export default function CuentaCorrienteClientesPage() {
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [movimientosPorCliente, setMovimientosPorCliente] = useState<Map<number, MovimientoCtaCte[]>>(new Map())
  const [mediosPago, setMediosPago] = useState<MedioPago[]>([])
  const [usuarioId, setUsuarioId] = useState<string | null>(null)

  const [clientesAbiertos, setClientesAbiertos] = useState<Set<number>>(new Set())
  const [soloConSaldo, setSoloConSaldo] = useState(true)

  const [modalClienteId, setModalClienteId] = useState<number | null>(null)
  const [montoCobro, setMontoCobro] = useState('')
  const [fechaCobro, setFechaCobro] = useState('')
  const [errFechaCobro, setErrFechaCobro] = useState(false)
  const [medioCobroId, setMedioCobroId] = useState<number>(0)
  const [observacionesCobro, setObservacionesCobro] = useState('')
  const [guardandoCobro, setGuardandoCobro] = useState(false)
  const [errorModal, setErrorModal] = useState<string | null>(null)

  useEffect(() => { cargar() }, [])

  function partirEnLotes<T>(arr: T[], tam: number): T[][] {
    const out: T[][] = []
    for (let i = 0; i < arr.length; i += tam) out.push(arr.slice(i, i + tam))
    return out
  }

  async function cargar() {
    setLoading(true)
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      setUsuarioId(user?.id ?? null)

      // Medios de pago: el de Cuenta Corriente (para identificar cargos) +
      // el resto (para elegir con qué se cobra realmente en el modal).
      const { data: mediosData, error: mediosError } = await supabase
        .from('medios_pago')
        .select('id, nombre')
        .eq('activo', true)
        .order('nombre')

      if (mediosError) throw mediosError
      setMediosPago(mediosData || [])

      const medioCtaCte = (mediosData || []).find(m => m.nombre === NOMBRE_MEDIO_CTA_CTE)
      if (!medioCtaCte) {
        setError(`No existe el medio de pago "${NOMBRE_MEDIO_CTA_CTE}" — creá el medio primero.`)
        setLoading(false)
        return
      }

      // Clientes con cuenta corriente habilitada
      const { data: clientesData, error: clientesError } = await supabase
        .from('clientes')
        .select('id, nombre, plazo_dias_cta_cte')
        .eq('tiene_cuenta_corriente', true)
        .eq('activo', true)
        .order('nombre')

      if (clientesError) throw clientesError
      setClientes(clientesData || [])

      const clienteIds = (clientesData || []).map(c => c.id)
      if (clienteIds.length === 0) { setLoading(false); return }

      // Ventas de esos clientes (excluye Anuladas)
      const { data: ventasData, error: ventasError } = await supabase
        .from('ventas')
        .select('id, cliente_id, numero_venta, fecha_utc')
        .in('cliente_id', clienteIds)
        .neq('estado_venta_id', 3)

      if (ventasError) throw ventasError

      const ventaInfoMap = new Map<number, { clienteId: number; numeroVenta: number; fecha: string }>()
      ;(ventasData || []).forEach(v => ventaInfoMap.set(v.id, { clienteId: v.cliente_id, numeroVenta: v.numero_venta, fecha: v.fecha_utc }))
      const ventaIds = (ventasData || []).map(v => v.id)

      // Cargos = venta_pagos con medio Cuenta Corriente, para esas ventas
      const movMap = new Map<number, MovimientoCtaCte[]>()

      if (ventaIds.length > 0) {
        for (const lote of partirEnLotes(ventaIds, 500)) {
          const { data: pagosData, error: pagosError } = await supabase
            .from('venta_pagos')
            .select('venta_id, monto')
            .eq('medio_pago_id', medioCtaCte.id)
            .in('venta_id', lote)

          if (pagosError) throw pagosError

          ;(pagosData || []).forEach(p => {
            const info = ventaInfoMap.get(p.venta_id)
            if (!info) return
            const prev = movMap.get(info.clienteId) || []
            prev.push({
              id: `cargo-${p.venta_id}`,
              tipo: 'Cargo',
              fecha: info.fecha,
              monto: p.monto,
              detalle: `Venta #${info.numeroVenta}`,
            })
            movMap.set(info.clienteId, prev)
          })
        }
      }

      // Cobros ya registrados
      const { data: cobrosData, error: cobrosError } = await supabase
        .from('cliente_cobros')
        .select('id, cliente_id, monto, fecha_cobro, observaciones')
        .in('cliente_id', clienteIds)
        .eq('anulado', false)

      if (cobrosError) throw cobrosError

      ;(cobrosData || []).forEach(c => {
        const prev = movMap.get(c.cliente_id) || []
        prev.push({
          id: `cobro-${c.id}`,
          tipo: 'Cobro',
          fecha: c.fecha_cobro,
          monto: c.monto,
          detalle: c.observaciones || 'Cobro registrado',
        })
        movMap.set(c.cliente_id, prev)
      })

      // Orden cronológico dentro de cada cliente
      movMap.forEach(lista => lista.sort((a, b) => a.fecha.localeCompare(b.fecha)))

      setMovimientosPorCliente(movMap)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : JSON.stringify(err))
    } finally {
      setLoading(false)
    }
  }

  function saldoDe(clienteId: number): number {
    const movs = movimientosPorCliente.get(clienteId) || []
    return movs.reduce((s, m) => s + (m.tipo === 'Cargo' ? m.monto : -m.monto), 0)
  }

  const clientesFiltrados = useMemo(() => {
    return clientes.filter(c => !soloConSaldo || saldoDe(c.id) > 1)
  }, [clientes, soloConSaldo, movimientosPorCliente])

  const totalPendiente = clientesFiltrados.reduce((s, c) => s + saldoDe(c.id), 0)

  function toggleCliente(id: number) {
    setClientesAbiertos(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function abrirModalCobro(clienteId: number) {
    setModalClienteId(clienteId)
    setMontoCobro('')
    setFechaCobro(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }))
    setMedioCobroId(mediosPago.find(m => m.nombre === 'Efectivo')?.id || 0)
    setObservacionesCobro('')
    setErrorModal(null)
  }

  function cerrarModal() {
    setModalClienteId(null)
  }

  function parsearMonto(v: string): number {
    const limpio = v.replace(/\./g, '').replace(',', '.')
    return parseFloat(limpio) || 0
  }

  async function registrarCobro() {
    if (!modalClienteId || !usuarioId) return
    const monto = parsearMonto(montoCobro)
    if (monto <= 0) { setErrorModal('Ingresá un monto válido'); return }
    if (!medioCobroId) { setErrorModal('Elegí el medio de pago con el que se cobró'); return }
    if (!fechaCobro) { setErrorModal('Elegí la fecha del cobro'); return }

    setGuardandoCobro(true)
    setErrorModal(null)
    try {
      // Concepto "Cobro Cuenta Corriente" bajo categoría Ventas
      const { data: conceptoData, error: conceptoError } = await supabase
        .from('conceptos_gasto')
        .select('id, categoria_gasto_id')
        .eq('nombre', NOMBRE_CONCEPTO_COBRO)
        .maybeSingle()

      if (conceptoError) throw conceptoError
      if (!conceptoData) throw new Error(`Falta crear el concepto de gasto "${NOMBRE_CONCEPTO_COBRO}" bajo la categoría Ventas`)

      // 1) Movimiento financiero real (Ingreso)
      const { data: movimiento, error: movError } = await supabase
        .from('movimientos')
        .insert({
          tipo: 'Ingreso',
          categoria_gasto_id: conceptoData.categoria_gasto_id,
          concepto_gasto_id: conceptoData.id,
          medio_pago_id: medioCobroId,
          monto,
          fecha_utc: fechaCobro,
          mes_contable: fechaCobro.slice(0, 7) + '-01',
          sucursal_id: 1,
          usuario_id: usuarioId,
          observaciones: observacionesCobro || null,
        })
        .select('id')
        .single()

      if (movError) throw movError

      // 2) Cobro de cta cte, enlazado al movimiento real recién creado
      const { error: cobroError } = await supabase
        .from('cliente_cobros')
        .insert({
          cliente_id: modalClienteId,
          monto,
          fecha_cobro: fechaCobro,
          medio_pago_id: medioCobroId,
          movimiento_id: movimiento.id,
          observaciones: observacionesCobro || null,
          usuario_id: usuarioId,
        })

      if (cobroError) throw cobroError

      cerrarModal()
      await cargar()
    } catch (err: unknown) {
      setErrorModal(err instanceof Error ? err.message : JSON.stringify(err))
    } finally {
      setGuardandoCobro(false)
    }
  }

  const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-AR')
  const fmtFecha = (f: string) => f.slice(0, 10).split('-').reverse().join('/')

  const clienteModal = clientes.find(c => c.id === modalClienteId)
  const saldoModal = modalClienteId ? saldoDe(modalClienteId) : 0

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-sm text-gray-400">Cargando cuenta corriente...</p>
    </div>
  )

  if (error) return (
    <div className="mx-auto max-w-xl mt-8 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
      {error}
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-semibold text-[#3c3c3b]">Clientes — Cuenta Corriente</h1>
        {clientesFiltrados.length > 0 && (
          <span className="text-sm text-gray-500">
            Total pendiente de cobro: <span className="font-semibold text-red-600">{fmt(totalPendiente)}</span>
          </span>
        )}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer w-fit">
          <input
            type="checkbox"
            checked={soloConSaldo}
            onChange={e => setSoloConSaldo(e.target.checked)}
            className="rounded border-gray-300 text-[#00a19a] focus:ring-[#00a19a]"
          />
          Solo clientes con saldo pendiente
        </label>
      </div>

      {clientes.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-sm text-gray-400">
          Todavía no hay clientes con cuenta corriente habilitada. Activala desde Clientes → Editar.
        </div>
      ) : clientesFiltrados.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-sm text-gray-400">
          Ningún cliente con cuenta corriente tiene saldo pendiente ahora mismo.
        </div>
      ) : (
        <div className="space-y-3">
          {clientesFiltrados
            .slice()
            .sort((a, b) => saldoDe(b.id) - saldoDe(a.id))
            .map(cliente => {
              const abierto = clientesAbiertos.has(cliente.id)
              const saldo = saldoDe(cliente.id)
              const movs = movimientosPorCliente.get(cliente.id) || []
              let saldoCorrido = 0

              return (
                <div key={cliente.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <button
                    onClick={() => toggleCliente(cliente.id)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {abierto ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                      <span className="text-sm font-semibold text-[#3c3c3b]">{cliente.nombre}</span>
                      {cliente.plazo_dias_cta_cte && (
                        <span className="text-xs text-gray-400">({cliente.plazo_dias_cta_cte} días)</span>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`text-sm font-semibold ${saldo > 1 ? 'text-red-600' : 'text-[#00a19a]'}`}>
                        {fmt(saldo)}
                      </span>
                      <span
                        onClick={e => { e.stopPropagation(); abrirModalCobro(cliente.id) }}
                        className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded border border-[#00a19a] text-[#00a19a] hover:bg-[#00a19a]/10 transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Registrar cobro
                      </span>
                    </div>
                  </button>

                  {abierto && (
                    <table className="w-full text-sm border-t border-gray-100">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Fecha</th>
                          <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Detalle</th>
                          <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Cargo</th>
                          <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Cobro</th>
                          <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Saldo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {movs.length === 0 ? (
                          <tr><td colSpan={5} className="px-4 py-4 text-center text-xs text-gray-400">Sin movimientos todavía.</td></tr>
                        ) : movs.map(m => {
                          saldoCorrido += m.tipo === 'Cargo' ? m.monto : -m.monto
                          return (
                            <tr key={m.id} className="border-b border-gray-50 last:border-0">
                              <td className="px-4 py-2 text-gray-500">{fmtFecha(m.fecha)}</td>
                              <td className="px-4 py-2 text-[#3c3c3b]">{m.detalle}</td>
                              <td className="px-4 py-2 text-right text-red-600">{m.tipo === 'Cargo' ? fmt(m.monto) : '—'}</td>
                              <td className="px-4 py-2 text-right text-[#00a19a]">{m.tipo === 'Cobro' ? fmt(m.monto) : '—'}</td>
                              <td className="px-4 py-2 text-right font-medium text-[#3c3c3b]">{fmt(saldoCorrido)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              )
            })}
        </div>
      )}

      {/* Modal registrar cobro */}
      {modalClienteId && clienteModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg border border-gray-200 w-full max-w-md">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-base font-semibold text-[#3c3c3b]">Registrar cobro — {clienteModal.nombre}</h2>
              <button onClick={cerrarModal} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-xs text-gray-500">
                Saldo pendiente actual: <span className="font-semibold text-red-600">{fmt(saldoModal)}</span>
              </p>

              {errorModal && <p className="text-xs text-red-600">{errorModal}</p>}

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Monto</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={montoCobro}
                  onChange={e => setMontoCobro(e.target.value.replace(/[^0-9,.]/g, ''))}
                  placeholder={`Hasta ${fmt(saldoModal)} (total) o menos (parcial)`}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Fecha</label>
                <input
                  type="date"
                  value={fechaCobro}
                  onChange={e => setFechaCobro(e.target.value)}
                  min={FECHA_MIN} max={fechaMax()}
                  onBlur={e => {
                    if (fechaFueraDeRango(e.target.value)) { setFechaCobro(''); setErrFechaCobro(true) }
                    else setErrFechaCobro(false)
                  }}
                  className={`w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a] ${errFechaCobro && !fechaCobro ? 'border-red-500' : 'border-gray-300'}`}
                />
                {errFechaCobro && !fechaCobro && (
                  <p className="mt-1 text-xs text-red-600">Fecha fuera de rango, revisá el año</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Medio de pago recibido</label>
                <select
                  value={medioCobroId}
                  onChange={e => setMedioCobroId(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]"
                >
                  <option value={0}>Seleccionar...</option>
                  {mediosPago.filter(m => m.nombre !== NOMBRE_MEDIO_CTA_CTE).map(m => (
                    <option key={m.id} value={m.id}>{m.nombre}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Observaciones (opcional)</label>
                <input
                  type="text"
                  value={observacionesCobro}
                  onChange={e => setObservacionesCobro(e.target.value)}
                  placeholder="ej. Transferencia recibida, comprobante N°..."
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]"
                />
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex items-center gap-3">
              <button
                onClick={registrarCobro}
                disabled={guardandoCobro}
                className="flex-1 bg-[#00a19a] text-white px-4 py-2 rounded text-sm hover:bg-[#008f89] transition-colors disabled:opacity-50"
              >
                {guardandoCobro ? 'Guardando...' : 'Confirmar cobro'}
              </button>
              <button
                onClick={cerrarModal}
                className="px-4 py-2 border border-gray-300 rounded text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
