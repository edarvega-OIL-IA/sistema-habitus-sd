// Ruta destino: C:\Users\Usuario\Documents\sistema-habitus-sd\src\app\(sistema)\mayoristas\[id]\page.tsx
//
// Detalle de una venta mayorista: ítems, cobros, entrega y anulación.
// Toda la lógica de stock y movimientos vive en funciones SQL (entregar_venta_mayorista,
// registrar_cobro_mayorista, anular_cobro_mayorista, anular_venta_mayorista).
'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ChevronLeft } from 'lucide-react'
import { FECHA_MIN, fechaMax, fechaFueraDeRango } from '@/lib/fechaLimites'
import InputMonto from '@/components/mayoristas/InputMonto'

interface Venta {
  id: number
  cliente_id: number
  fecha_utc: string
  orden_compra_id: number | null
  total: number
  flete_monto: number
  observaciones: string | null
  anulada: boolean
  motivo_anulacion: string | null
  estado_entrega: 'Pendiente' | 'Entregada'
  fecha_entrega: string | null
  clientes: { nombre: string } | null
}
interface Item {
  id: number
  cantidad: number
  costo_unitario: number
  recargo_pct: number
  precio_unitario: number
  subtotal: number
  articulos: { nombre: string } | null
}
interface Cobro {
  id: number
  monto: number
  fecha_cobro: string
  anulado: boolean
  observaciones: string | null
  medios_pago: { nombre: string } | null
}
interface Medio { id: number; nombre: string }

const fmt = (n: number) => '$' + Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtFecha = (f: string | null) => (f ? f.slice(0, 10).split('-').reverse().join('/') : '—')
const hoyAR = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
const num = (s: string) => { const n = Number(String(s).replace(',', '.')); return Number.isFinite(n) ? n : NaN }

export default function DetalleVentaMayoristaPage() {
  const params = useParams<{ id: string }>()
  const ventaId = Number(Array.isArray(params.id) ? params.id[0] : params.id)

  const [venta, setVenta] = useState<Venta | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [cobros, setCobros] = useState<Cobro[]>([])
  const [medios, setMedios] = useState<Medio[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notif, setNotif] = useState<{ tipo: 'error' | 'ok'; msg: string } | null>(null)
  const [trabajando, setTrabajando] = useState(false)

  // Formularios
  const [cobroMonto, setCobroMonto] = useState('')
  const [cobroFecha, setCobroFecha] = useState(hoyAR())
  const [cobroMedio, setCobroMedio] = useState('')
  const [cobroObs, setCobroObs] = useState('')
  const [fechaEntrega, setFechaEntrega] = useState(hoyAR())
  const [confirmandoEntrega, setConfirmandoEntrega] = useState(false)
  const [confirmandoAnular, setConfirmandoAnular] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [anulandoCobro, setAnulandoCobro] = useState<number | null>(null)

  const cargar = useCallback(async () => {
    const supabase = createClient()
    const [v, i, c, m] = await Promise.all([
      supabase.from('ventas_mayoristas').select('*, clientes(nombre)').eq('id', ventaId).maybeSingle(),
      supabase.from('ventas_mayoristas_items')
        .select('id, cantidad, costo_unitario, recargo_pct, precio_unitario, subtotal, articulos(nombre)')
        .eq('venta_mayorista_id', ventaId).order('id'),
      supabase.from('ventas_mayoristas_cobros')
        .select('id, monto, fecha_cobro, anulado, observaciones, medios_pago(nombre)')
        .eq('venta_mayorista_id', ventaId).order('fecha_cobro').order('id'),
      supabase.from('medios_pago').select('id, nombre').eq('activo', true).order('id'),
    ])
    if (v.error) { setError(v.error.message); setLoading(false); return }
    if (!v.data) { setError('No existe la venta mayorista #' + ventaId); setLoading(false); return }
    setVenta(v.data as unknown as Venta)
    setItems((i.data || []) as unknown as Item[])
    setCobros((c.data || []) as unknown as Cobro[])
    const lista = ((m.data || []) as Medio[]).filter(x => x.nombre !== 'Cuenta Corriente')
    setMedios(lista)
    setCobroMedio(prev => prev || String(lista.find(x => x.nombre === 'Transferencia')?.id ?? lista[0]?.id ?? ''))
    setLoading(false)
  }, [ventaId])

  useEffect(() => { cargar() }, [cargar])

  const cobrado = cobros.filter(c => !c.anulado).reduce((s, c) => s + Number(c.monto), 0)
  const total = venta ? Number(venta.total) : 0
  const pendiente = Math.max(0, Math.round((total - cobrado) * 100) / 100)
  const costoTotal = items.reduce((s, it) => s + Number(it.cantidad) * Number(it.costo_unitario), 0)
  const flete = venta ? Number(venta.flete_monto || 0) : 0
  const ganancia = total - costoTotal - flete
  const cobrosActivos = cobros.filter(c => !c.anulado).length

  // Precarga el monto del cobro con lo que falta cobrar
  useEffect(() => {
    if (venta) setCobroMonto(pendiente > 0 ? String(pendiente) : '')
  }, [venta, pendiente])

  async function ejecutar(fn: () => Promise<{ error: { message: string } | null }>, okMsg: string) {
    setTrabajando(true)
    setNotif(null)
    const { error: err } = await fn()
    if (err) setNotif({ tipo: 'error', msg: err.message })
    else setNotif({ tipo: 'ok', msg: okMsg })
    await cargar()
    setTrabajando(false)
    return !err
  }

  async function registrarCobro() {
    const monto = num(cobroMonto)
    if (!(monto > 0)) { setNotif({ tipo: 'error', msg: 'El monto del cobro es inválido.' }); return }
    if (!cobroFecha || fechaFueraDeRango(cobroFecha)) { setNotif({ tipo: 'error', msg: 'La fecha del cobro está fuera de rango.' }); return }
    if (!cobroMedio) { setNotif({ tipo: 'error', msg: 'Elegí el medio de pago.' }); return }
    const supabase = createClient()
    const ok = await ejecutar(
      async () => supabase.rpc('registrar_cobro_mayorista', {
        p_venta_id: ventaId,
        p_monto: monto,
        p_fecha: cobroFecha,
        p_medio_pago_id: Number(cobroMedio),
        p_observaciones: cobroObs.trim() || null,
      }),
      'Cobro registrado.'
    )
    if (ok) setCobroObs('')
  }

  async function entregar() {
    if (!fechaEntrega || fechaFueraDeRango(fechaEntrega)) { setNotif({ tipo: 'error', msg: 'La fecha de entrega está fuera de rango.' }); return }
    const supabase = createClient()
    const ok = await ejecutar(
      async () => supabase.rpc('entregar_venta_mayorista', { p_venta_id: ventaId, p_fecha: fechaEntrega }),
      'Pedido entregado. El stock fue descontado.'
    )
    if (ok) setConfirmandoEntrega(false)
  }

  async function anularCobro(cobroId: number) {
    const supabase = createClient()
    await ejecutar(
      async () => supabase.rpc('anular_cobro_mayorista', { p_cobro_id: cobroId }),
      'Cobro anulado.'
    )
    setAnulandoCobro(null)
  }

  async function anularVenta() {
    if (!motivo.trim()) { setNotif({ tipo: 'error', msg: 'Indicá el motivo de la anulación.' }); return }
    const supabase = createClient()
    const ok = await ejecutar(
      async () => supabase.rpc('anular_venta_mayorista', { p_venta_id: ventaId, p_motivo: motivo.trim() }),
      'Venta anulada.'
    )
    if (ok) { setConfirmandoAnular(false); setMotivo('') }
  }

  if (loading) return <p className="text-sm text-gray-500">Cargando...</p>
  if (error || !venta) return (
    <div>
      <p className="text-red-500 text-sm mb-3">{error || 'No se encontró la venta.'}</p>
      <Link href="/mayoristas" className="text-sm text-[#00a19a] underline">Volver a Mayoristas</Link>
    </div>
  )

  const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]'
  const entregada = venta.estado_entrega === 'Entregada'

  return (
    <div className="max-w-5xl">
      <Link href="/mayoristas" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-[#3c3c3b] mb-3">
        <ChevronLeft className="w-4 h-4" /> Volver a Mayoristas
      </Link>

      <div className="flex items-center gap-3 flex-wrap mb-6">
        <h1 className="text-xl font-semibold text-[#3c3c3b]">Venta mayorista #{venta.id}</h1>
        {venta.anulada ? (
          <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-600">Anulada</span>
        ) : (
          <>
            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${pendiente <= 0.01 ? 'bg-green-100 text-green-700' : cobrado > 0 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-700'}`}>
              {pendiente <= 0.01 ? 'Cobrada' : cobrado > 0 ? 'Cobro parcial' : 'Sin cobrar'}
            </span>
            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${entregada ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-800'}`}>
              {entregada ? `Entregada ${fmtFecha(venta.fecha_entrega)}` : 'Pendiente de entrega'}
            </span>
          </>
        )}
      </div>

      {notif && (
        <div className={`rounded-lg border px-4 py-3 flex items-center justify-between gap-3 mb-4 ${
          notif.tipo === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'
        }`}>
          <p className="text-sm font-medium">{notif.msg}</p>
          <button onClick={() => setNotif(null)} className="opacity-50 hover:opacity-100 text-lg leading-none">✕</button>
        </div>
      )}

      {venta.anulada && venta.motivo_anulacion && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 mb-4 text-sm text-gray-600">
          Motivo de la anulación: {venta.motivo_anulacion}
        </div>
      )}

      {/* Datos y totales */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div><p className="text-xs text-gray-500">Cliente</p><p className="font-medium text-gray-800">{venta.clientes?.nombre || '—'}</p></div>
        <div><p className="text-xs text-gray-500">Fecha</p><p className="text-gray-800">{fmtFecha(venta.fecha_utc)}</p></div>
        <div>
          <p className="text-xs text-gray-500">OC de origen</p>
          {venta.orden_compra_id
            ? <Link href={`/compras/${venta.orden_compra_id}`} className="text-[#00a19a] hover:underline">OC #{venta.orden_compra_id}</Link>
            : <p className="text-gray-500">—</p>}
        </div>
        <div><p className="text-xs text-gray-500">Observaciones</p><p className="text-gray-800">{venta.observaciones || '—'}</p></div>
        <div>
          <p className="text-xs text-gray-500">Total</p>
          <p className="text-lg font-semibold text-[#3c3c3b]">{fmt(total)}</p>
          {flete > 0 && <p className="text-xs text-gray-500">incluye flete {fmt(flete)}</p>}
        </div>
        <div><p className="text-xs text-gray-500">Costo</p><p className="text-gray-800">{fmt(costoTotal)}</p></div>
        <div><p className="text-xs text-gray-500">Ganancia</p><p className="text-[#00a19a] font-medium">{fmt(ganancia)}</p></div>
        <div>
          <p className="text-xs text-gray-500">Cobrado / pendiente</p>
          <p className="text-gray-800"><span className="text-green-700">{fmt(cobrado)}</span> / <span className={pendiente > 0.01 ? 'text-red-600' : 'text-gray-500'}>{fmt(pendiente)}</span></p>
        </div>
      </div>

      {/* Ítems */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto mb-4">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-2 text-xs text-gray-600 font-semibold">Artículo</th>
              <th className="text-right px-4 py-2 text-xs text-gray-600 font-semibold">Cant.</th>
              <th className="text-right px-4 py-2 text-xs text-gray-600 font-semibold">Costo unit.</th>
              <th className="text-right px-4 py-2 text-xs text-gray-600 font-semibold">Recargo</th>
              <th className="text-right px-4 py-2 text-xs text-gray-600 font-semibold">Precio unit.</th>
              <th className="text-right px-4 py-2 text-xs text-gray-600 font-semibold">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map(it => (
              <tr key={it.id}>
                <td className="px-4 py-2 text-gray-800">{it.articulos?.nombre || '—'}</td>
                <td className="px-4 py-2 text-right">{Number(it.cantidad)}</td>
                <td className="px-4 py-2 text-right text-gray-600">{fmt(it.costo_unitario)}</td>
                <td className="px-4 py-2 text-right text-gray-600">{Number(it.recargo_pct)}%</td>
                <td className="px-4 py-2 text-right">{fmt(it.precio_unitario)}</td>
                <td className="px-4 py-2 text-right font-medium">{fmt(it.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cobros */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Cobros</h2>
        {cobros.length === 0 ? (
          <p className="text-sm text-gray-500 mb-3">Todavía no hay cobros registrados.</p>
        ) : (
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-gray-100">
                {cobros.map(c => (
                  <tr key={c.id} className={c.anulado ? 'opacity-50' : ''}>
                    <td className="py-2 pr-3 text-gray-600">{fmtFecha(c.fecha_cobro)}</td>
                    <td className="py-2 pr-3 text-gray-600">{c.medios_pago?.nombre || '—'}</td>
                    <td className={`py-2 pr-3 text-right font-medium ${c.anulado ? 'line-through' : 'text-green-700'}`}>{fmt(c.monto)}</td>
                    <td className="py-2 pr-3 text-gray-500 text-xs">{c.anulado ? 'Anulado' : c.observaciones || ''}</td>
                    <td className="py-2 text-right whitespace-nowrap">
                      {!c.anulado && !venta.anulada && (
                        anulandoCobro === c.id ? (
                          <span className="text-xs">
                            ¿Anular?{' '}
                            <button onClick={() => anularCobro(c.id)} disabled={trabajando} className="text-red-600 font-medium hover:underline disabled:opacity-50">Sí</button>
                            {' · '}
                            <button onClick={() => setAnulandoCobro(null)} className="text-gray-500 hover:underline">No</button>
                          </span>
                        ) : (
                          <button onClick={() => setAnulandoCobro(c.id)} className="text-xs text-gray-400 hover:text-red-500">Anular</button>
                        )
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!venta.anulada && pendiente > 0.005 && (
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-medium text-gray-600 mb-2">Registrar cobro</p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Monto</label>
                <InputMonto value={cobroMonto} onChange={setCobroMonto} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Fecha</label>
                <input type="date" value={cobroFecha} onChange={e => setCobroFecha(e.target.value)}
                  min={FECHA_MIN} max={fechaMax()} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Medio de pago</label>
                <select value={cobroMedio} onChange={e => setCobroMedio(e.target.value)} className={inputCls}>
                  {medios.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Nota (opcional)</label>
                <input type="text" value={cobroObs} onChange={e => setCobroObs(e.target.value)} className={inputCls} />
              </div>
              <button type="button" onClick={registrarCobro} disabled={trabajando}
                className="bg-[#00a19a] text-white px-4 py-2 rounded text-sm hover:bg-[#008f89] disabled:opacity-50">
                Registrar cobro
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Entrega */}
      {!venta.anulada && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Entrega</h2>
          {entregada ? (
            <p className="text-sm text-gray-600">Entregada el {fmtFecha(venta.fecha_entrega)}. El stock ya fue descontado.</p>
          ) : (
            <>
              <p className="text-sm text-gray-500 mb-3">
                Pendiente de entrega. Al marcarla como entregada se descuenta el stock de los artículos (la OC tiene que estar cargada).
              </p>
              {confirmandoEntrega ? (
                <div className="flex items-end gap-3 flex-wrap">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Fecha de entrega</label>
                    <input type="date" value={fechaEntrega} onChange={e => setFechaEntrega(e.target.value)}
                      min={FECHA_MIN} max={fechaMax()} className="px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]" />
                  </div>
                  <button onClick={entregar} disabled={trabajando}
                    className="bg-[#00a19a] text-white px-4 py-2 rounded text-sm hover:bg-[#008f89] disabled:opacity-50">
                    Confirmar entrega
                  </button>
                  <button onClick={() => setConfirmandoEntrega(false)} className="text-sm text-gray-500 hover:text-[#3c3c3b] py-2">Cancelar</button>
                </div>
              ) : (
                <button onClick={() => setConfirmandoEntrega(true)}
                  className="bg-[#3c3c3b] text-white px-4 py-2 rounded text-sm hover:bg-black transition-colors">
                  Marcar como entregada
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Anular venta */}
      {!venta.anulada && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Anular venta</h2>
          {confirmandoAnular ? (
            <div className="space-y-3 max-w-lg">
              {cobrosActivos > 0 && (
                <p className="text-sm text-amber-700">Tiene {cobrosActivos} {cobrosActivos === 1 ? 'cobro activo' : 'cobros activos'}: anulalos primero.</p>
              )}
              {entregada && <p className="text-sm text-gray-500">Como ya fue entregada, el stock se va a devolver.</p>}
              <input type="text" value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Motivo de la anulación" className={inputCls} />
              <div className="flex items-center gap-3">
                <button onClick={anularVenta} disabled={trabajando || cobrosActivos > 0}
                  className="bg-red-600 text-white px-4 py-2 rounded text-sm hover:bg-red-700 disabled:opacity-50">
                  Confirmar anulación
                </button>
                <button onClick={() => { setConfirmandoAnular(false); setMotivo('') }} className="text-sm text-gray-500 hover:text-[#3c3c3b]">Cancelar</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setConfirmandoAnular(true)} className="text-sm text-red-600 hover:underline">Anular esta venta mayorista…</button>
          )}
        </div>
      )}
    </div>
  )
}
