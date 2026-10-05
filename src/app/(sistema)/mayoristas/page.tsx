// Ruta destino: C:\Users\Usuario\Documents\sistema-habitus-sd\src\app\(sistema)\mayoristas\page.tsx
//
// Ventas mayoristas (reventa a Agustín y otros): resumen por cliente, listado de
// pedidos y extracto. Lee de las vistas ventas_mayoristas_resumen y
// ventas_mayoristas_extracto. No pasa por Fiscalización.
'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Plus, Filter } from 'lucide-react'
import { FECHA_MIN, fechaMax, fechaFueraDeRango } from '@/lib/fechaLimites'

interface Resumen {
  id: number
  cliente_id: number
  cliente: string
  fecha_utc: string
  orden_compra_id: number | null
  total: number
  anulada: boolean
  estado_entrega: 'Pendiente' | 'Entregada'
  fecha_entrega: string | null
  costo_total: number
  ganancia: number
  cobrado: number
  pendiente: number
}

interface FilaExtracto {
  cliente_id: number
  fecha: string
  tipo: 'Pedido' | 'Cobro'
  venta_mayorista_id: number
  ref_id: number
  debe: number
  haber: number
  saldo: number
}

const fmt = (n: number) => '$' + Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtFecha = (f: string | null) => (f ? f.slice(0, 10).split('-').reverse().join('/') : '—')

function estadoCobro(r: Resumen): { texto: string; clase: string } {
  if (r.anulada) return { texto: 'Anulada', clase: 'bg-gray-100 text-gray-500' }
  if (r.pendiente <= 0.01) return { texto: 'Cobrada', clase: 'bg-green-100 text-green-700' }
  if (r.cobrado > 0) return { texto: 'Cobro parcial', clase: 'bg-amber-100 text-amber-800' }
  return { texto: 'Sin cobrar', clase: 'bg-red-100 text-red-700' }
}

export default function MayoristasPage() {
  const [filas, setFilas] = useState<Resumen[]>([])
  const [extracto, setExtracto] = useState<FilaExtracto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [clienteFiltro, setClienteFiltro] = useState('todos')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [errDesde, setErrDesde] = useState(false)
  const [errHasta, setErrHasta] = useState(false)
  const [verAnuladas, setVerAnuladas] = useState(false)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { data, error: err } = await supabase
      .from('ventas_mayoristas_resumen')
      .select('*')
      .order('fecha_utc', { ascending: false })
      .order('id', { ascending: false })
    if (err) { setError(err.message); setLoading(false); return }
    setFilas((data || []) as Resumen[])
    setLoading(false)
  }

  // Extracto del cliente elegido (pedidos suman, cobros restan)
  useEffect(() => {
    if (clienteFiltro === 'todos') { setExtracto([]); return }
    async function cargarExtracto() {
      const supabase = createClient()
      const { data } = await supabase
        .from('ventas_mayoristas_extracto')
        .select('*')
        .eq('cliente_id', Number(clienteFiltro))
      const orden = (t: string) => (t === 'Pedido' ? 1 : 2)
      const lista = ((data || []) as FilaExtracto[]).sort((a, b) =>
        a.fecha.localeCompare(b.fecha) || orden(a.tipo) - orden(b.tipo) || a.ref_id - b.ref_id)
      setExtracto(lista)
    }
    cargarExtracto()
  }, [clienteFiltro])

  const clientes = useMemo(() => {
    const m = new Map<number, string>()
    filas.forEach(f => m.set(f.cliente_id, f.cliente))
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], 'es'))
  }, [filas])

  const filtradas = useMemo(() => filas.filter(f => {
    if (!verAnuladas && f.anulada) return false
    if (clienteFiltro !== 'todos' && f.cliente_id !== Number(clienteFiltro)) return false
    if (desde && f.fecha_utc < desde) return false
    if (hasta && f.fecha_utc > hasta) return false
    return true
  }), [filas, clienteFiltro, desde, hasta, verAnuladas])

  const activas = filtradas.filter(f => !f.anulada)
  const totVendido = activas.reduce((s, f) => s + Number(f.total), 0)
  const totGanancia = activas.reduce((s, f) => s + Number(f.ganancia), 0)
  const totCobrado = activas.reduce((s, f) => s + Number(f.cobrado), 0)
  const totPendiente = activas.reduce((s, f) => s + Number(f.pendiente), 0)
  const sinEntregar = activas.filter(f => f.estado_entrega === 'Pendiente').length

  const porCliente = useMemo(() => {
    const m = new Map<number, { nombre: string; pedidos: number; vendido: number; ganancia: number; cobrado: number; pendiente: number }>()
    activas.forEach(f => {
      const x = m.get(f.cliente_id) || { nombre: f.cliente, pedidos: 0, vendido: 0, ganancia: 0, cobrado: 0, pendiente: 0 }
      x.pedidos += 1
      x.vendido += Number(f.total)
      x.ganancia += Number(f.ganancia)
      x.cobrado += Number(f.cobrado)
      x.pendiente += Number(f.pendiente)
      m.set(f.cliente_id, x)
    })
    return [...m.entries()].sort((a, b) => a[1].nombre.localeCompare(b[1].nombre, 'es'))
  }, [activas])

  if (loading) return <p className="text-sm text-gray-500">Cargando ventas mayoristas...</p>
  if (error) return <p className="text-red-500 text-sm">Error: {error}</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <h1 className="text-xl font-semibold text-[#3c3c3b]">Ventas mayoristas</h1>
        <Link href="/mayoristas/nueva"
          className="bg-[#00a19a] text-white px-4 py-2 rounded text-sm hover:bg-[#008f89] flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nueva venta mayorista
        </Link>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-700">Filtros</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Cliente</label>
            <select value={clienteFiltro} onChange={e => setClienteFiltro(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]">
              <option value="todos">Todos los clientes</option>
              {clientes.map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Desde</label>
            <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
              min={FECHA_MIN} max={fechaMax()}
              onBlur={e => {
                if (fechaFueraDeRango(e.target.value)) { setDesde(''); setErrDesde(true) } else setErrDesde(false)
              }}
              className={`w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a] ${errDesde ? 'border-red-400' : 'border-gray-300'}`} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Hasta</label>
            <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
              min={FECHA_MIN} max={fechaMax()}
              onBlur={e => {
                if (fechaFueraDeRango(e.target.value)) { setHasta(''); setErrHasta(true) } else setErrHasta(false)
              }}
              className={`w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a] ${errHasta ? 'border-red-400' : 'border-gray-300'}`} />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer pb-2">
            <input type="checkbox" checked={verAnuladas} onChange={e => setVerAnuladas(e.target.checked)}
              className="rounded border-gray-300 text-[#00a19a] focus:ring-[#00a19a]" />
            Mostrar anuladas
          </label>
        </div>
      </div>

      {/* Totales */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        {[
          { t: 'Vendido', v: fmt(totVendido), c: 'text-[#3c3c3b]' },
          { t: 'Ganancia', v: fmt(totGanancia), c: 'text-[#00a19a]' },
          { t: 'Cobrado', v: fmt(totCobrado), c: 'text-green-700' },
          { t: 'Pendiente de cobro', v: fmt(totPendiente), c: totPendiente > 0.01 ? 'text-red-600' : 'text-gray-500' },
          { t: 'Sin entregar', v: `${sinEntregar} ${sinEntregar === 1 ? 'pedido' : 'pedidos'}`, c: sinEntregar > 0 ? 'text-amber-700' : 'text-gray-500' },
        ].map(k => (
          <div key={k.t} className="bg-white rounded-lg border border-gray-200 p-3">
            <p className="text-xs text-gray-500">{k.t}</p>
            <p className={`text-lg font-semibold mt-0.5 ${k.c}`}>{k.v}</p>
          </div>
        ))}
      </div>

      {/* Resumen por cliente */}
      {clienteFiltro === 'todos' && porCliente.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto mb-4">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <span className="text-xs text-gray-500">Por cliente</span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2 text-xs text-gray-600 font-semibold">Cliente</th>
                <th className="text-right px-4 py-2 text-xs text-gray-600 font-semibold">Pedidos</th>
                <th className="text-right px-4 py-2 text-xs text-gray-600 font-semibold">Vendido</th>
                <th className="text-right px-4 py-2 text-xs text-gray-600 font-semibold">Ganancia</th>
                <th className="text-right px-4 py-2 text-xs text-gray-600 font-semibold">Cobrado</th>
                <th className="text-right px-4 py-2 text-xs text-gray-600 font-semibold">Pendiente</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {porCliente.map(([id, c]) => (
                <tr key={id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setClienteFiltro(String(id))}>
                  <td className="px-4 py-2 font-medium text-gray-800">{c.nombre}</td>
                  <td className="px-4 py-2 text-right text-gray-600">{c.pedidos}</td>
                  <td className="px-4 py-2 text-right">{fmt(c.vendido)}</td>
                  <td className="px-4 py-2 text-right text-[#00a19a]">{fmt(c.ganancia)}</td>
                  <td className="px-4 py-2 text-right text-green-700">{fmt(c.cobrado)}</td>
                  <td className={`px-4 py-2 text-right ${c.pendiente > 0.01 ? 'text-red-600 font-medium' : 'text-gray-500'}`}>{fmt(c.pendiente)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pedidos */}
      {filtradas.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-sm text-gray-500">
          {filas.length === 0 ? 'Todavía no hay ventas mayoristas registradas.' : 'No hay ventas con los filtros aplicados.'}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <span className="text-xs text-gray-500">
              {filtradas.length} {filtradas.length === 1 ? 'pedido' : 'pedidos'}
            </span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2 text-xs text-gray-600 font-semibold">#</th>
                <th className="text-left px-4 py-2 text-xs text-gray-600 font-semibold">Fecha</th>
                <th className="text-left px-4 py-2 text-xs text-gray-600 font-semibold">Cliente</th>
                <th className="text-right px-4 py-2 text-xs text-gray-600 font-semibold">Total</th>
                <th className="text-right px-4 py-2 text-xs text-gray-600 font-semibold">Ganancia</th>
                <th className="text-right px-4 py-2 text-xs text-gray-600 font-semibold">Pendiente</th>
                <th className="text-left px-4 py-2 text-xs text-gray-600 font-semibold">Cobro</th>
                <th className="text-left px-4 py-2 text-xs text-gray-600 font-semibold">Entrega</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtradas.map(f => {
                const ec = estadoCobro(f)
                return (
                  <tr key={f.id} className={`hover:bg-gray-50 ${f.anulada ? 'opacity-60' : ''}`}>
                    <td className="px-4 py-2">
                      <Link href={`/mayoristas/${f.id}`} className="text-[#00a19a] hover:underline font-medium">#{f.id}</Link>
                    </td>
                    <td className="px-4 py-2 text-gray-600">{fmtFecha(f.fecha_utc)}</td>
                    <td className="px-4 py-2 text-gray-800">{f.cliente}</td>
                    <td className="px-4 py-2 text-right">{fmt(f.total)}</td>
                    <td className="px-4 py-2 text-right text-[#00a19a]">{fmt(f.ganancia)}</td>
                    <td className="px-4 py-2 text-right">{f.anulada ? '—' : fmt(f.pendiente)}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ec.clase}`}>{ec.texto}</span>
                    </td>
                    <td className="px-4 py-2">
                      {f.anulada ? '—' : f.estado_entrega === 'Entregada' ? (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          Entregada {fmtFecha(f.fecha_entrega)}
                        </span>
                      ) : (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">Pendiente</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Extracto del cliente elegido */}
      {clienteFiltro !== 'todos' && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto mt-4">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <span className="text-xs text-gray-500">
              Extracto — los pedidos suman, los cobros restan. Saldo positivo: el cliente debe. Negativo: saldo a favor.
            </span>
          </div>
          {extracto.length === 0 ? (
            <p className="p-4 text-sm text-gray-500">Sin movimientos.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-2 text-xs text-gray-600 font-semibold">Fecha</th>
                  <th className="text-left px-4 py-2 text-xs text-gray-600 font-semibold">Detalle</th>
                  <th className="text-right px-4 py-2 text-xs text-gray-600 font-semibold">Pedido</th>
                  <th className="text-right px-4 py-2 text-xs text-gray-600 font-semibold">Cobro</th>
                  <th className="text-right px-4 py-2 text-xs text-gray-600 font-semibold">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {extracto.map(x => (
                  <tr key={`${x.tipo}-${x.ref_id}`}>
                    <td className="px-4 py-2 text-gray-600">{fmtFecha(x.fecha)}</td>
                    <td className="px-4 py-2">
                      <Link href={`/mayoristas/${x.venta_mayorista_id}`} className="text-[#00a19a] hover:underline">
                        {x.tipo === 'Pedido' ? `Pedido #${x.venta_mayorista_id}` : `Cobro del pedido #${x.venta_mayorista_id}`}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-right">{x.debe > 0 ? fmt(x.debe) : ''}</td>
                    <td className="px-4 py-2 text-right text-green-700">{x.haber > 0 ? fmt(x.haber) : ''}</td>
                    <td className={`px-4 py-2 text-right font-medium ${x.saldo > 0.01 ? 'text-red-600' : x.saldo < -0.01 ? 'text-blue-600' : 'text-gray-500'}`}>
                      {fmt(x.saldo)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
