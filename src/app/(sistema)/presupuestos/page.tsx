'use client'

import { useEffect, useMemo, useState, Fragment } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Plus, Search, Edit, ChevronDown, ChevronRight } from 'lucide-react'

interface Presupuesto {
  id: number
  numero: number
  fecha: string
  validez_hasta: string | null
  estado: string
  total: number
  cliente_id: number
}

interface Cliente {
  id: number
  nombre: string
}

interface ItemPresupuesto {
  id: number
  nombre: string
  cantidad: number
  precio_unitario: number
  subtotal: number
}

type FiltroEstado = 'todos' | 'Borrador' | 'Enviado' | 'Aprobado' | 'Rechazado' | 'Vencido' | 'Convertido'

const ESTADOS_BADGE: Record<string, string> = {
  Borrador: 'bg-gray-100 text-gray-600',
  Enviado: 'bg-blue-100 text-blue-700',
  Aprobado: 'bg-green-100 text-green-700',
  Rechazado: 'bg-red-100 text-red-700',
  Vencido: 'bg-amber-100 text-amber-700',
  Convertido: 'bg-[#00a19a]/10 text-[#00a19a]',
}

export default function PresupuestosPage() {
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([])
  const [clientesMap, setClientesMap] = useState<Map<number, string>>(new Map())
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todos')
  const [busqueda, setBusqueda] = useState('')

  // Filas desplegadas + ítems ya cargados (se piden una sola vez por
  // presupuesto, la primera vez que se abre — no de entrada para todos).
  const [filasAbiertas, setFilasAbiertas] = useState<Set<number>>(new Set())
  const [itemsPorPresupuesto, setItemsPorPresupuesto] = useState<Map<number, ItemPresupuesto[]>>(new Map())
  const [cargandoItems, setCargandoItems] = useState<Set<number>>(new Set())

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    setError(null)
    try {
      const { data: presupuestosData, error: presupuestosError } = await supabase
        .from('presupuestos')
        .select('id, numero, fecha, validez_hasta, estado, total, cliente_id')
        .order('numero', { ascending: false })

      if (presupuestosError) throw presupuestosError
      setPresupuestos(presupuestosData || [])

      const clienteIds = [...new Set((presupuestosData || []).map(p => p.cliente_id))]
      if (clienteIds.length > 0) {
        const { data: clientesData, error: clientesError } = await supabase
          .from('clientes')
          .select('id, nombre')
          .in('id', clienteIds)

        if (clientesError) throw clientesError
        setClientesMap(new Map((clientesData || []).map(c => [c.id, c.nombre])))
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : JSON.stringify(err))
    } finally {
      setLoading(false)
    }
  }

  async function toggleFila(presupuestoId: number) {
    setFilasAbiertas(prev => {
      const next = new Set(prev)
      if (next.has(presupuestoId)) next.delete(presupuestoId)
      else next.add(presupuestoId)
      return next
    })

    if (itemsPorPresupuesto.has(presupuestoId)) return

    setCargandoItems(prev => new Set(prev).add(presupuestoId))
    try {
      const { data, error: itemsError } = await supabase
        .from('presupuesto_items')
        .select('id, cantidad, precio_unitario, subtotal, articulos(nombre)')
        .eq('presupuesto_id', presupuestoId)

      if (itemsError) throw itemsError

      const items: ItemPresupuesto[] = (data || []).map((i: any) => ({
        id: i.id,
        nombre: i.articulos?.nombre || 'Artículo eliminado',
        cantidad: i.cantidad,
        precio_unitario: i.precio_unitario,
        subtotal: i.subtotal,
      }))

      setItemsPorPresupuesto(prev => new Map(prev).set(presupuestoId, items))
    } catch (err: unknown) {
      setError('Error al cargar ítems: ' + (err instanceof Error ? err.message : JSON.stringify(err)))
    } finally {
      setCargandoItems(prev => {
        const next = new Set(prev)
        next.delete(presupuestoId)
        return next
      })
    }
  }

  const presupuestosFiltrados = useMemo(() => {
    return presupuestos.filter(p => {
      if (filtroEstado !== 'todos' && p.estado !== filtroEstado) return false
      if (busqueda.trim()) {
        const nombreCliente = clientesMap.get(p.cliente_id) || ''
        const q = busqueda.trim().toLowerCase()
        if (!nombreCliente.toLowerCase().includes(q) && !String(p.numero).includes(q)) return false
      }
      return true
    })
  }, [presupuestos, filtroEstado, busqueda, clientesMap])

  const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-AR')
  const fmtFecha = (f: string | null) => f ? f.slice(0, 10).split('-').reverse().join('/') : '—'

  if (loading) return <p className="text-sm text-gray-500">Cargando presupuestos...</p>
  if (error) return <p className="text-red-500 text-sm">Error al cargar presupuestos: {error}</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-[#3c3c3b]">Presupuestos</h1>
        <Link
          href="/presupuestos/nuevo"
          className="bg-[#00a19a] text-white px-4 py-2 rounded text-sm hover:bg-[#008f89] transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Nuevo presupuesto
        </Link>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por número o cliente..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]"
          />
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {(['todos', 'Borrador', 'Enviado', 'Aprobado', 'Rechazado', 'Vencido', 'Convertido'] as const).map(e => (
            <button
              key={e}
              onClick={() => setFiltroEstado(e)}
              className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                filtroEstado === e
                  ? 'bg-[#00a19a] text-white border-[#00a19a]'
                  : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {e === 'todos' ? 'Todos' : e}
            </button>
          ))}
        </div>
      </div>

      {presupuestosFiltrados.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-500">
            {presupuestos.length === 0 ? 'No hay presupuestos cargados todavía.' : 'No se encontraron presupuestos con los filtros aplicados.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="w-8"></th>
                <th className="text-left px-4 py-3 text-xs text-gray-600 font-semibold">N°</th>
                <th className="text-left px-4 py-3 text-xs text-gray-600 font-semibold">Cliente</th>
                <th className="text-left px-4 py-3 text-xs text-gray-600 font-semibold">Fecha</th>
                <th className="text-left px-4 py-3 text-xs text-gray-600 font-semibold">Validez</th>
                <th className="text-right px-4 py-3 text-xs text-gray-600 font-semibold">Total</th>
                <th className="text-left px-4 py-3 text-xs text-gray-600 font-semibold">Estado</th>
                <th className="px-4 py-3 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {presupuestosFiltrados.map(p => {
                const abierta = filasAbiertas.has(p.id)
                const items = itemsPorPresupuesto.get(p.id)
                const cargando = cargandoItems.has(p.id)
                return (
                  <Fragment key={p.id}>
                    <tr
                      onClick={() => toggleFila(p.id)}
                      className="hover:bg-gray-50 cursor-pointer"
                    >
                      <td className="pl-4 py-3 text-gray-400">
                        {abierta ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </td>
                      <td className="px-4 py-3 text-[#3c3c3b] font-medium">#{p.numero}</td>
                      <td className="px-4 py-3 text-gray-700">{clientesMap.get(p.cliente_id) || '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{fmtFecha(p.fecha)}</td>
                      <td className="px-4 py-3 text-gray-500">{fmtFecha(p.validez_hasta)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-[#3c3c3b]">{fmt(p.total)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${ESTADOS_BADGE[p.estado] || 'bg-gray-100 text-gray-600'}`}>
                          {p.estado}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/presupuestos/${p.id}`}
                          onClick={e => e.stopPropagation()}
                          title="Ver / Editar"
                          className="inline-flex items-center justify-center w-8 h-8 rounded text-blue-400 hover:bg-blue-500 hover:text-white transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </Link>
                      </td>
                    </tr>
                    {abierta && (
                      <tr key={`${p.id}-detalle`}>
                        <td colSpan={8} className="bg-gray-50 px-4 py-3">
                          {cargando ? (
                            <p className="text-xs text-gray-400 py-2">Cargando ítems...</p>
                          ) : !items || items.length === 0 ? (
                            <p className="text-xs text-gray-400 py-2">Este presupuesto no tiene ítems cargados.</p>
                          ) : (
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-gray-500">
                                  <th className="text-left py-1.5 pl-8 font-semibold uppercase tracking-wide">Artículo</th>
                                  <th className="text-right py-1.5 font-semibold uppercase tracking-wide">Cantidad</th>
                                  <th className="text-right py-1.5 font-semibold uppercase tracking-wide">Precio Unit.</th>
                                  <th className="text-right py-1.5 pr-4 font-semibold uppercase tracking-wide">Subtotal</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {items.map(i => (
                                  <tr key={i.id}>
                                    <td className="py-1.5 pl-8 text-gray-700">{i.nombre}</td>
                                    <td className="py-1.5 text-right text-gray-600">{i.cantidad.toLocaleString('es-AR')}</td>
                                    <td className="py-1.5 text-right text-gray-600">{fmt(i.precio_unitario)}</td>
                                    <td className="py-1.5 pr-4 text-right font-medium text-[#3c3c3b]">{fmt(i.subtotal)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
