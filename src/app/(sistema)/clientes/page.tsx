'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Plus, Search, Edit, Star } from 'lucide-react'

interface Cliente {
  id: number
  nombre: string
  tipo_cliente_id: number
  dni: string | null
  cuit: string | null
  telefono: string | null
  email: string | null
  tiene_cuenta_corriente: boolean
  plazo_dias_cta_cte: number | null
  activo: boolean
}

type FiltroTipo = 'todos' | 'consumidor_final' | 'cuenta_corriente'

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('todos')
  const [soloActivos, setSoloActivos] = useState(true)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { data, error: err } = await supabase
      .from('clientes')
      .select('id, nombre, tipo_cliente_id, dni, cuit, telefono, email, tiene_cuenta_corriente, plazo_dias_cta_cte, activo')
      .order('nombre')

    if (err) { setError(err.message); setLoading(false); return }
    setClientes(data || [])
    setLoading(false)
  }

  const clientesFiltrados = useMemo(() => {
    return clientes.filter(c => {
      if (soloActivos && !c.activo) return false
      if (filtroTipo === 'consumidor_final' && c.tipo_cliente_id !== 1) return false
      if (filtroTipo === 'cuenta_corriente' && !c.tiene_cuenta_corriente) return false
      if (busqueda.trim()) {
        const q = busqueda.trim().toLowerCase()
        const campos = [c.nombre, c.dni, c.cuit, c.telefono, c.email].filter(Boolean).join(' ').toLowerCase()
        if (!campos.includes(q)) return false
      }
      return true
    })
  }, [clientes, busqueda, filtroTipo, soloActivos])

  if (loading) return <p className="text-sm text-gray-500">Cargando clientes...</p>
  if (error) return <p className="text-red-500 text-sm">Error al cargar clientes: {error}</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-[#3c3c3b]">Clientes</h1>
        <Link
          href="/clientes/nuevo"
          className="bg-[#00a19a] text-white px-4 py-2 rounded text-sm hover:bg-[#008f89] transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Nuevo cliente
        </Link>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, DNI, CUIT, teléfono o email..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]"
          />
        </div>

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 w-fit">
            {(['todos', 'consumidor_final', 'cuenta_corriente'] as const).map(t => (
              <button
                key={t}
                onClick={() => setFiltroTipo(t)}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors ${filtroTipo === t ? 'bg-white text-[#3c3c3b] shadow-sm' : 'text-gray-500'}`}
              >
                {t === 'todos' ? 'Todos' : t === 'consumidor_final' ? 'Consumidor Final' : 'Cuenta Corriente'}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={soloActivos}
              onChange={e => setSoloActivos(e.target.checked)}
              className="rounded border-gray-300 text-[#00a19a] focus:ring-[#00a19a]"
            />
            Solo activos
          </label>
        </div>
      </div>

      {clientesFiltrados.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-500">
            {clientes.length === 0 ? 'No hay clientes cargados todavía.' : 'No se encontraron clientes con los filtros aplicados.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <span className="text-xs text-gray-500">
              {clientesFiltrados.length} {clientesFiltrados.length === 1 ? 'cliente' : 'clientes'}
            </span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs text-gray-600 font-semibold">Nombre</th>
                <th className="text-left px-4 py-3 text-xs text-gray-600 font-semibold">DNI / CUIT</th>
                <th className="text-left px-4 py-3 text-xs text-gray-600 font-semibold">Teléfono</th>
                <th className="text-left px-4 py-3 text-xs text-gray-600 font-semibold">Email</th>
                <th className="text-left px-4 py-3 text-xs text-gray-600 font-semibold">Tipo</th>
                <th className="px-4 py-3 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {clientesFiltrados.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-800 font-medium flex items-center gap-1.5">
                    {c.tiene_cuenta_corriente && <Star className="w-3.5 h-3.5 text-amber-400 shrink-0" fill="currentColor" />}
                    {c.nombre}
                    {!c.activo && <span className="text-xs text-gray-400">(inactivo)</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c.cuit || c.dni || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{c.telefono || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{c.email || '—'}</td>
                  <td className="px-4 py-3">
                    {c.tiene_cuenta_corriente ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                        Cta. Cte. {c.plazo_dias_cta_cte ? `(${c.plazo_dias_cta_cte}d)` : ''}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                        Consumidor Final
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/clientes/${c.id}`}
                      title="Editar"
                      className="inline-flex items-center justify-center w-8 h-8 rounded text-blue-400 hover:bg-blue-500 hover:text-white transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
