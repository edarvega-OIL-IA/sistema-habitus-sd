'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Plus, Filter, Edit, Trash2 } from 'lucide-react'
import { FECHA_MIN, fechaMax } from '@/lib/fechaLimites'

interface Movimiento {
  id: number
  fecha_utc: string
  creado_en: string
  tipo: 'Ingreso' | 'Egreso'
  monto: number
  observaciones: string | null
  categoria_gasto_id: number | null
  medio_pago_id: number | null
  origen_tipo: string | null
  cierre_turno_id: number | null
  categorias_gasto: { nombre: string } | null
  conceptos_gasto: { nombre: string } | null
  medios_pago: { nombre: string } | null
}

interface Categoria {
  id: number
  nombre: string
}

interface MedioPago {
  id: number
  nombre: string
}

export default function MovimientosPage() {
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [mediosPago, setMediosPago] = useState<MedioPago[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rolUsuario, setRolUsuario] = useState<number | null>(null)
  const [cierreActivoId, setCierreActivoId] = useState<number | null>(null)
  const [confirmandoEliminar, setConfirmandoEliminar] = useState<number | null>(null)
  const [eliminando, setEliminando] = useState<number | null>(null)
  const [tipoFiltro, setTipoFiltro] = useState<string>('todos')
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('todos')
  const [medioPagoFiltro, setMedioPagoFiltro] = useState<string>('todos')
  const [modoPeriodo, setModoPeriodo] = useState<'dia' | 'mes' | 'anio' | 'libre' | 'todos'>('mes')
  const [fechaRef, setFechaRef] = useState<Date>(new Date())
  const [fechaDesde, setFechaDesde] = useState<string>('')
  const [fechaHasta, setFechaHasta] = useState<string>('')
  // Categoría "Caja" (id=13) = retiro/ingreso manual de plata, movimiento
  // interno entre caja y banco/bolsillo, no un ingreso o gasto real del
  // negocio (decisión 08/07/2026). Por defecto se sigue mostrando (false),
  // para no cambiar el comportamiento existente sin que el usuario lo pida.
  const [excluirCaja, setExcluirCaja] = useState<boolean>(false)

  function toArgentina(d: Date) {
    return d.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
  }

  function getDesdHasta() {
    if (modoPeriodo === 'todos' || modoPeriodo === 'libre') return { desde: fechaDesde, hasta: fechaHasta }
    const y = fechaRef.getFullYear()
    const m = fechaRef.getMonth()
    const d = fechaRef.getDate()
    if (modoPeriodo === 'dia') {
      const s = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
      return { desde: s, hasta: s }
    }
    if (modoPeriodo === 'mes') {
      const desde = `${y}-${String(m+1).padStart(2,'0')}-01`
      const ultimo = new Date(y, m+1, 0).getDate()
      const hasta = `${y}-${String(m+1).padStart(2,'0')}-${String(ultimo).padStart(2,'0')}`
      return { desde, hasta }
    }
    if (modoPeriodo === 'anio') {
      return { desde: `${y}-01-01`, hasta: `${y}-12-31` }
    }
    return { desde: '', hasta: '' }
  }

  function avanzar() {
    const d = new Date(fechaRef)
    if (modoPeriodo === 'dia') d.setDate(d.getDate() + 1)
    else if (modoPeriodo === 'mes') d.setMonth(d.getMonth() + 1)
    else if (modoPeriodo === 'anio') d.setFullYear(d.getFullYear() + 1)
    setFechaRef(d)
  }

  function retroceder() {
    const d = new Date(fechaRef)
    if (modoPeriodo === 'dia') d.setDate(d.getDate() - 1)
    else if (modoPeriodo === 'mes') d.setMonth(d.getMonth() - 1)
    else if (modoPeriodo === 'anio') d.setFullYear(d.getFullYear() - 1)
    setFechaRef(d)
  }

  function labelFechaRef() {
    if (modoPeriodo === 'dia') return fechaRef.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'America/Argentina/Buenos_Aires' })
    if (modoPeriodo === 'mes') return fechaRef.toLocaleDateString('es-AR', { month: 'long', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' })
    if (modoPeriodo === 'anio') return fechaRef.getFullYear().toString()
    return ''
  }

  function limpiarTodo() {
    setModoPeriodo('todos')
    setTipoFiltro('todos')
    setCategoriaFiltro('todos')
    setMedioPagoFiltro('todos')
    setFechaDesde('')
    setFechaHasta('')
    setFechaRef(new Date())
    setExcluirCaja(false)
  }

  const { desde, hasta } = getDesdHasta()

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    const supabase = createClient()
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: usuarioData } = await supabase
          .from('usuarios').select('rol_id, sucursal_id').eq('id', user.id).single()
        if (usuarioData) {
          setRolUsuario(usuarioData.rol_id)
          const { data: cierreActivo } = await supabase
            .from('cierres_turno').select('id')
            .eq('sucursal_id', usuarioData.sucursal_id ?? 1).eq('estado_cierre_turno_id', 1).maybeSingle()
          setCierreActivoId(cierreActivo?.id ?? null)
        }
      }

      const { data: movimientosData, error: movimientosError } = await supabase
        .from('movimientos')
        .select(`
          id,
          fecha_utc,
          tipo,
          monto,
          observaciones,
          categoria_gasto_id,
          medio_pago_id,
          origen_tipo,
          cierre_turno_id,
          creado_en,
          categorias_gasto ( nombre ),
          conceptos_gasto ( nombre ),
          medios_pago ( nombre )
        `)
        .eq('anulado', false)
        .order('fecha_utc', { ascending: false })
        .order('id', { ascending: false })

      if (movimientosError) throw movimientosError

      const { data: categoriasData, error: categoriasError } = await supabase
        .from('categorias_gasto')
        .select('id, nombre')
        .order('nombre')

      if (categoriasError) throw categoriasError

      const { data: mediosPagoData, error: mediosPagoError } = await supabase
        .from('medios_pago')
        .select('id, nombre')
        .order('nombre')

      if (mediosPagoError) throw mediosPagoError

      setMovimientos(movimientosData as any || [])
      setCategorias(categoriasData || [])
      setMediosPago(mediosPagoData || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Editar/Eliminar solo para movimientos manuales (origen_tipo null) —
  // los generados por Ventas/Compras/Caja se corrigen desde su origen.
  // Admin siempre puede; otro usuario solo si pertenece al cierre de
  // turno actualmente abierto.
  function puedeEditar(mov: Movimiento): boolean {
    if (mov.origen_tipo !== null) return false
    if (rolUsuario === 1) return true
    return mov.cierre_turno_id !== null && mov.cierre_turno_id === cierreActivoId
  }

  async function eliminarMovimiento(id: number) {
    setEliminando(id)
    const supabase = createClient()
    const { error } = await supabase.from('movimientos').update({ anulado: true }).eq('id', id)
    setEliminando(null)
    setConfirmandoEliminar(null)
    if (error) { setError('Error al eliminar: ' + error.message); return }
    setMovimientos(prev => prev.filter(m => m.id !== id))
  }

  const movimientosFiltrados = movimientos.filter(mov => {
    const cumpleTipo = tipoFiltro === 'todos' || mov.tipo === tipoFiltro
    const cumpleCategoria = categoriaFiltro === 'todos' ||
      mov.categoria_gasto_id?.toString() === categoriaFiltro
    const cumpleMedioPago = medioPagoFiltro === 'todos' ||
      mov.medio_pago_id?.toString() === medioPagoFiltro
    const cumpleExclusionCaja = !excluirCaja || mov.categoria_gasto_id !== 13
    const fechaCreado = new Date(mov.creado_en).toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
    const cumpleFechaDesde = !desde || fechaCreado >= desde
    const cumpleFechaHasta = !hasta || fechaCreado <= hasta
    return cumpleTipo && cumpleCategoria && cumpleMedioPago && cumpleExclusionCaja && cumpleFechaDesde && cumpleFechaHasta
  })

  const totalIngresos = movimientosFiltrados
    .filter(m => m.tipo === 'Ingreso')
    .reduce((sum, m) => sum + m.monto, 0)

  const totalEgresos = movimientosFiltrados
    .filter(m => m.tipo === 'Egreso')
    .reduce((sum, m) => sum + m.monto, 0)

  const diferencia = totalIngresos - totalEgresos

  if (loading) return <p className="text-sm text-gray-500">Cargando movimientos...</p>
  if (error) return <p className="text-red-500 text-sm">Error al cargar movimientos: {error}</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-[#3c3c3b]">Movimientos</h1>
        <Link
          href="/movimientos/nuevo"
          className="bg-[#00a19a] text-white px-4 py-2 rounded text-sm hover:bg-[#008f89] transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Nuevo movimiento
        </Link>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-700">Filtros</h2>
        </div>

        {/* Fila 1: botones período + fechas */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {(['dia', 'mes', 'anio', 'libre'] as const).map(m => (
            <div key={m} className="flex items-center">
              {m !== 'libre' && modoPeriodo === m && (
                <button onClick={retroceder}
                  className="w-7 h-7 flex items-center justify-center rounded-l border border-r-0 border-gray-300 hover:bg-gray-100 text-gray-600 text-sm">
                  ‹
                </button>
              )}
              <button
                onClick={() => setModoPeriodo(m)}
                className={`px-3 py-1.5 text-sm font-medium border transition-colors ${
                  modoPeriodo === m
                    ? 'bg-[#00a19a] text-white border-[#00a19a]'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                } ${m !== 'libre' && modoPeriodo === m ? '' : 'rounded'}`}
              >
                {modoPeriodo === m && m !== 'libre' ? labelFechaRef() : m === 'dia' ? 'Día' : m === 'mes' ? 'Mes' : m === 'anio' ? 'Año' : 'Libre'}
              </button>
              {m !== 'libre' && modoPeriodo === m && (
                <button onClick={avanzar}
                  className="w-7 h-7 flex items-center justify-center rounded-r border border-l-0 border-gray-300 hover:bg-gray-100 text-gray-600 text-sm">
                  ›
                </button>
              )}
            </div>
          ))}
          <button
            onClick={limpiarTodo}
            className={`px-3 py-1.5 text-sm font-medium border rounded transition-colors ${
              modoPeriodo === 'todos'
                ? 'bg-[#00a19a] text-white border-[#00a19a]'
                : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50'
            }`}
          >
            Todos
          </button>

          {/* Fechas en la misma fila — solo cuando no es Todos */}
          {modoPeriodo !== 'todos' && (
            <div className="flex items-center gap-2 ml-2">
              <input type="date" value={desde}
                onChange={e => { setModoPeriodo('libre'); setFechaDesde(e.target.value) }}
                min={FECHA_MIN} max={fechaMax()}
                className="px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]" />
              <span className="text-gray-400 text-sm">—</span>
              <input type="date" value={hasta}
                onChange={e => { setModoPeriodo('libre'); setFechaHasta(e.target.value) }}
                min={FECHA_MIN} max={fechaMax()}
                className="px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]" />
            </div>
          )}
        </div>

        {/* Fila 2: tipo, categoría y medio de pago */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
            <select value={tipoFiltro} onChange={e => setTipoFiltro(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]">
              <option value="todos">Todos</option>
              <option value="Ingreso">Ingresos</option>
              <option value="Egreso">Egresos</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Categoría</label>
            <select value={categoriaFiltro} onChange={e => setCategoriaFiltro(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]">
              <option value="todos">Todas las categorías</option>
              {categorias.map(cat => (
                <option key={cat.id} value={cat.id.toString()}>{cat.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Medio de pago</label>
            <select value={medioPagoFiltro} onChange={e => setMedioPagoFiltro(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]">
              <option value="todos">Todos los medios</option>
              {mediosPago.map(mp => (
                <option key={mp.id} value={mp.id.toString()}>{mp.nombre}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Fila 3: exclusión de movimientos internos de Caja */}
        <div className="mt-3 pt-3 border-t border-gray-100">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer w-fit">
            <input
              type="checkbox"
              checked={excluirCaja}
              onChange={e => setExcluirCaja(e.target.checked)}
              className="rounded border-gray-300 text-[#00a19a] focus:ring-[#00a19a]"
            />
            Excluir movimientos internos de Caja (Retiro/Ingreso manual) — no son ingreso o gasto real del negocio
          </label>
        </div>

      </div>

      {/* Totales — siempre visibles */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <p className="text-xs text-green-600 font-medium mb-1">Total Ingresos</p>
            <p className="text-2xl font-bold text-green-700">
              ${totalIngresos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-red-50 rounded-lg p-4 border border-red-200">
            <p className="text-xs text-red-600 font-medium mb-1">Total Egresos</p>
            <p className="text-2xl font-bold text-red-700">
              ${totalEgresos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className={`rounded-lg p-4 border ${
            diferencia >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'
          }`}>
            <p className={`text-xs font-medium mb-1 ${diferencia >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
              Diferencia
            </p>
            <p className={`text-2xl font-bold ${diferencia >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
              {diferencia >= 0 ? '+' : ''}$
              {diferencia.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </div>

      {movimientosFiltrados.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-500">
            {movimientos.length === 0
              ? 'No hay movimientos registrados todavía.'
              : 'No se encontraron movimientos con los filtros aplicados.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              {movimientosFiltrados.length} {movimientosFiltrados.length === 1 ? 'movimiento' : 'movimientos'}
            </span>
          </div>
          <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs text-gray-600 font-semibold">Fecha</th>
                  <th className="text-left px-4 py-3 text-xs text-gray-600 font-semibold">Tipo</th>
                  <th className="text-left px-4 py-3 text-xs text-gray-600 font-semibold">Categoría</th>
                  <th className="text-left px-4 py-3 text-xs text-gray-600 font-semibold">Concepto</th>
                  <th className="text-right px-4 py-3 text-xs text-gray-600 font-semibold">Monto</th>
                  <th className="text-left px-4 py-3 text-xs text-gray-600 font-semibold">Medio de pago</th>
                  <th className="text-left px-4 py-3 text-xs text-gray-600 font-semibold">Observaciones</th>
                  <th className="px-4 py-3 w-24"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {movimientosFiltrados.map(mov => (
                  <tr key={mov.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-700">
                      {mov.fecha_utc.split('-').reverse().join('/')}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        mov.tipo === 'Ingreso' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>{mov.tipo}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{mov.categorias_gasto?.nombre || '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{mov.conceptos_gasto?.nombre || '—'}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${
                      mov.tipo === 'Ingreso' ? 'text-green-700' : 'text-red-700'
                    }`}>
                      {mov.tipo === 'Ingreso' ? '+' : '-'}$
                      {mov.monto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{mov.medios_pago?.nombre || '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">
                      {mov.observaciones || ''}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {puedeEditar(mov) && (
                        confirmandoEliminar === mov.id ? (
                          <div className="flex items-center justify-end gap-1 text-xs">
                            <span className="text-gray-500">¿Eliminar?</span>
                            <button onClick={() => eliminarMovimiento(mov.id)} disabled={eliminando === mov.id}
                              className="text-red-600 hover:underline disabled:opacity-50">
                              {eliminando === mov.id ? '...' : 'Sí'}
                            </button>
                            <button onClick={() => setConfirmandoEliminar(null)} className="text-gray-400 hover:underline">No</button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            <Link href={`/movimientos/${mov.id}`}
                              title="Editar"
                              className="inline-flex items-center justify-center w-8 h-8 rounded text-blue-400 hover:bg-blue-500 hover:text-white transition-colors">
                              <Edit className="w-4 h-4" />
                            </Link>
                            <button onClick={() => setConfirmandoEliminar(mov.id)}
                              title="Eliminar"
                              className="inline-flex items-center justify-center w-8 h-8 rounded text-red-400 hover:bg-red-500 hover:text-white transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )
                      )}
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
