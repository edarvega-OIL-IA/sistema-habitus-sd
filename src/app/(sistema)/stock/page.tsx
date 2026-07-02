'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface MovimientoStock {
  id: number
  fecha_utc: string
  origen_tipo: string | null
  tipo_movimiento_stock: { nombre: string }
  subtipo_movimiento_stock: { nombre: string } | null
  deportista: { nombre: string; apellido: string } | null
  observaciones: string | null
  movimiento_stock_items: { cantidad: number; articulo: { nombre: string } }[]
}

export default function StockPage() {
  const router = useRouter()
  const [movimientos, setMovimientos] = useState<MovimientoStock[]>([])
  const [cargando, setCargando] = useState(true)
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroTexto, setFiltroTexto] = useState('')
  const [eliminando, setEliminando] = useState<number | null>(null)
  const [expandidos, setExpandidos] = useState<Set<number>>(new Set())

  useEffect(() => { cargarMovimientos() }, [])

  async function cargarMovimientos() {
    const supabase = createClient()
    const { data } = await supabase
      .from('movimientos_stock')
      .select(`
        id, fecha_utc, observaciones, origen_tipo,
        tipo_movimiento_stock:tipos_movimiento_stock(nombre),
        subtipo_movimiento_stock:subtipos_movimiento_stock(nombre),
        deportista:deportistas(nombre, apellido),
        movimiento_stock_items(cantidad, articulo:articulos(nombre))
      `)
      // Esta pantalla es solo para movimientos manuales (Consumo interno,
      // Merma, Sponsoreo). Ventas y Compras generan sus propios movimientos
      // de stock automáticamente (con origen_tipo='venta'/'compra') y tienen
      // sus propias pantallas — no deben listarse ni editarse acá.
      .is('origen_tipo', null)
      .order('fecha_utc', { ascending: false })
      .limit(100)

    setMovimientos((data as any) || [])
    setCargando(false)
  }

  async function eliminar(id: number, origenTipo: string | null) {
    if (origenTipo) return // traba defensiva: nunca debería llegar acá un movimiento automático
    if (!confirm('¿Eliminar este movimiento? El stock de todos los artículos será revertido.')) return
    setEliminando(id)
    const supabase = createClient()
    const { error } = await supabase.rpc('eliminar_movimiento_stock', { p_movimiento_id: id })
    if (error) {
      alert('Error al eliminar: ' + error.message)
    } else {
      setMovimientos(prev => prev.filter(m => m.id !== id))
    }
    setEliminando(null)
  }

  function toggleExpandir(id: number) {
    setExpandidos(prev => {
      const nuevo = new Set(prev)
      nuevo.has(id) ? nuevo.delete(id) : nuevo.add(id)
      return nuevo
    })
  }

  const movimientosFiltrados = movimientos.filter(m => {
    const matchTipo = !filtroTipo || m.tipo_movimiento_stock?.nombre === filtroTipo
    const matchTexto = !filtroTexto ||
      m.movimiento_stock_items?.some(i => i.articulo?.nombre.toLowerCase().includes(filtroTexto.toLowerCase())) ||
      m.deportista?.apellido.toLowerCase().includes(filtroTexto.toLowerCase()) ||
      m.subtipo_movimiento_stock?.nombre.toLowerCase().includes(filtroTexto.toLowerCase())
    return matchTipo && matchTexto
  })

  // fecha_utc es tipo DATE (sin hora) — nunca usar new Date() sobre este
  // valor, corre un día para atrás por conversión de huso horario.
  function formatFecha(fecha: string) {
    return fecha.split('-').reverse().join('/')
  }

  function colorTipo(nombre: string) {
    if (nombre === 'Ingreso') return 'text-[#00a19a] font-medium'
    if (nombre === 'Egreso') return 'text-red-500 font-medium'
    return 'text-gray-500 font-medium'
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[#3c3c3b]">Movimientos de stock</h1>
        <button onClick={() => router.push('/stock/nuevo')}
          className="px-4 py-2 bg-[#00a19a] text-white rounded-lg text-sm font-medium hover:bg-[#008f89]">
          + Nuevo movimiento
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 flex gap-4 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Tipo</label>
          <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}
            className="h-8 px-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-[#00a19a]">
            <option value="">Todos</option>
            <option value="Ingreso">Ingreso</option>
            <option value="Egreso">Egreso</option>
            <option value="Ajuste">Ajuste</option>
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-xs text-gray-500 mb-1">Buscar artículo o deportista</label>
          <input type="text" value={filtroTexto} onChange={e => setFiltroTexto(e.target.value)}
            placeholder="Nombre del artículo o deportista..."
            className="w-full h-8 px-3 border border-gray-300 rounded text-sm focus:outline-none focus:border-[#00a19a]" />
        </div>
        <button onClick={() => { setFiltroTipo(''); setFiltroTexto('') }}
          className="h-8 px-3 border border-gray-300 rounded text-sm text-gray-500 hover:bg-gray-50">
          Limpiar
        </button>
      </div>

      {/* Listado */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {cargando ? (
          <div className="p-8 text-center text-gray-400 text-sm">Cargando...</div>
        ) : movimientosFiltrados.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">Sin movimientos registrados</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left">Fecha</th>
                <th className="px-4 py-3 text-center">Tipo</th>
                <th className="px-4 py-3 text-center">Motivo</th>
                <th className="px-4 py-3 text-left">Artículos</th>
                <th className="px-4 py-3 text-left">Deportista / Obs.</th>
                <th className="px-4 py-3 text-center w-32">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {movimientosFiltrados.map(m => {
                const items = m.movimiento_stock_items || []
                const expandido = expandidos.has(m.id)
                const resumen = items.length === 1
                  ? `${items[0].articulo?.nombre} (${items[0].cantidad})`
                  : `${items.length} artículos`
                const esManual = !m.origen_tipo

                return (
                  <React.Fragment key={m.id}>
                    <tr key={m.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatFecha(m.fecha_utc)}</td>
                      <td className={`px-4 py-3 text-center ${colorTipo(m.tipo_movimiento_stock?.nombre)}`}>
                        {m.tipo_movimiento_stock?.nombre}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-500">
                        {m.subtipo_movimiento_stock?.nombre ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-[#3c3c3b]">
                        <button onClick={() => items.length > 1 && toggleExpandir(m.id)}
                          className={`text-left ${items.length > 1 ? 'hover:text-[#00a19a] cursor-pointer' : ''}`}>
                          {resumen}
                          {items.length > 1 && (
                            <span className="ml-1 text-gray-400">{expandido ? '▲' : '▼'}</span>
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {m.deportista
                          ? `${m.deportista.apellido}, ${m.deportista.nombre}`
                          : m.observaciones ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex gap-3 justify-center">
                          <button onClick={() => esManual && router.push(`/stock/${m.id}`)}
                            disabled={!esManual}
                            className="text-xs text-[#00a19a] hover:underline disabled:text-gray-300 disabled:no-underline disabled:cursor-not-allowed">
                            Editar
                          </button>
                          <button onClick={() => eliminar(m.id, m.origen_tipo)}
                            disabled={!esManual || eliminando === m.id}
                            className="text-xs text-red-500 hover:underline disabled:opacity-50 disabled:cursor-not-allowed">
                            {eliminando === m.id ? '...' : 'Eliminar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandido && items.map((item, idx) => (
                      <tr key={`${m.id}-${idx}`} className="bg-gray-50 border-t border-gray-100">
                        <td colSpan={2}></td>
                        <td></td>
                        <td className="px-4 py-2 text-xs text-gray-600 pl-8">
                          — {item.articulo?.nombre}
                        </td>
                        <td className="px-4 py-2 text-xs text-gray-500">{item.cantidad} u.</td>
                        <td></td>
                      </tr>
                    ))}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="text-xs text-gray-400 text-right">
        {movimientosFiltrados.length} movimiento{movimientosFiltrados.length !== 1 ? 's' : ''}
      </div>
    </div>
  )
}
