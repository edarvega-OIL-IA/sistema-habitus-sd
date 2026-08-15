'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Search, Filter, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react'

interface FilaArticulo {
  id: number
  nombre: string
  stockActual: number
  unidadesPeriodo: { 1: number; 3: number; 6: number; 12: number }
  cantidadPedida: number
  proveedorId: number | null
  proveedorNombre: string
}

interface Proveedor {
  id: number
  nombre: string
}

type PeriodoMeses = 1 | 3 | 6 | 12

const SIN_PROVEEDOR = 0

export default function SugerenciaCompraPage() {
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filas, setFilas] = useState<FilaArticulo[]>([])

  const [periodo, setPeriodo] = useState<PeriodoMeses>(3)
  const [umbralDias, setUmbralDias] = useState<number>(15)
  const [objetivoDias, setObjetivoDias] = useState<number>(30)
  const [mostrarTodos, setMostrarTodos] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [gruposColapsados, setGruposColapsados] = useState<Set<number>>(new Set())

  useEffect(() => { cargar() }, [])

  function partirEnLotes<T>(arr: T[], tam: number): T[][] {
    const out: T[][] = []
    for (let i = 0; i < arr.length; i += tam) out.push(arr.slice(i, i + tam))
    return out
  }

  function fechaMenosMeses(meses: number): string {
    const hoy = new Date()
    hoy.setMonth(hoy.getMonth() - meses)
    return hoy.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
  }

  async function cargar() {
    setLoading(true)
    setError(null)
    try {
      // Universo: solo lo que Ariel marcó como disponible en el local
      const { data: articulosData, error: articulosError } = await supabase
        .from('articulos')
        .select('id, nombre, nombre_base')
        .eq('activo', true)
        .eq('disponible_local', true)

      if (articulosError) throw articulosError

      // IMPORTANTE: usar nombre (armado por el trigger fn_generar_nombre_articulo
      // con base+sabor+marca), NUNCA nombre_base — nombre_base no distingue
      // sabores y mostraba artículos distintos repetidos con el mismo texto.
      const articuloNombreMap = new Map<number, string>()
      ;(articulosData || []).forEach(a => articuloNombreMap.set(a.id, a.nombre))
      const articuloIds = (articulosData || []).map(a => a.id)

      // Stock actual
      const stockMap = new Map<number, number>()
      for (const lote of partirEnLotes(articuloIds, 500)) {
        const { data: stockData, error: stockError } = await supabase
          .from('articulo_stock')
          .select('articulo_id, stock_actual')
          .eq('sucursal_id', 1)
          .in('articulo_id', lote)

        if (stockError) throw stockError
        ;(stockData || []).forEach(s => stockMap.set(s.articulo_id, s.stock_actual))
      }

      // Ventas del último año (excluye anuladas) — se calculan los 4
      // períodos posibles en una sola pasada, así cambiar el selector no
      // requiere volver a consultar la base.
      const cutoff12 = fechaMenosMeses(12)
      const { data: ventasData, error: ventasError } = await supabase
        .from('ventas')
        .select('id, fecha_utc')
        .eq('sucursal_id', 1)
        .neq('estado_venta_id', 3)
        .gte('fecha_utc', cutoff12)

      if (ventasError) throw ventasError

      const cutoff1 = fechaMenosMeses(1)
      const cutoff3 = fechaMenosMeses(3)
      const cutoff6 = fechaMenosMeses(6)

      const ventaFechaMap = new Map<number, string>()
      ;(ventasData || []).forEach(v => ventaFechaMap.set(v.id, v.fecha_utc))
      const ventaIds = (ventasData || []).map(v => v.id)

      const unidadesPorArticulo = new Map<number, { 1: number; 3: number; 6: number; 12: number }>()

      if (ventaIds.length > 0) {
        for (const lote of partirEnLotes(ventaIds, 500)) {
          const { data: itemsData, error: itemsError } = await supabase
            .from('venta_items')
            .select('venta_id, articulo_id, cantidad')
            .in('venta_id', lote)

          if (itemsError) throw itemsError

          ;(itemsData || []).forEach(it => {
            const fecha = ventaFechaMap.get(it.venta_id)
            if (!fecha) return
            const prev = unidadesPorArticulo.get(it.articulo_id) || { 1: 0, 3: 0, 6: 0, 12: 0 }
            if (fecha >= cutoff1) prev[1] += it.cantidad
            if (fecha >= cutoff3) prev[3] += it.cantidad
            if (fecha >= cutoff6) prev[6] += it.cantidad
            if (fecha >= cutoff12) prev[12] += it.cantidad
            unidadesPorArticulo.set(it.articulo_id, prev)
          })
        }
      }

      // Órdenes de Compra: Borrador (pendiente de llegar) y Confirmada
      // (ya recibida — sirve para saber el proveedor habitual de cada
      // artículo, tomando la compra confirmada más reciente).
      const { data: ordenesData, error: ordenesError } = await supabase
        .from('ordenes_compra')
        .select('id, proveedor_id, estado_orden_compra_id, fecha_orden')
        .in('estado_orden_compra_id', [1, 2])

      if (ordenesError) throw ordenesError

      const ordenInfoMap = new Map<number, { proveedorId: number; estado: number; fecha: string }>()
      ;(ordenesData || []).forEach(o => ordenInfoMap.set(o.id, { proveedorId: o.proveedor_id, estado: o.estado_orden_compra_id, fecha: o.fecha_orden }))
      const ordenIds = (ordenesData || []).map(o => o.id)

      const { data: proveedoresData, error: proveedoresError } = await supabase
        .from('proveedores')
        .select('id, nombre_comercial')

      if (proveedoresError) throw proveedoresError

      const proveedorNombreMap = new Map<number, string>()
      ;(proveedoresData || []).forEach(p => proveedorNombreMap.set(p.id, p.nombre_comercial))

      const cantidadPedidaMap = new Map<number, number>()
      const proveedorPorArticuloMap = new Map<number, { proveedorId: number; fecha: string }>()

      if (ordenIds.length > 0) {
        for (const lote of partirEnLotes(ordenIds, 500)) {
          const { data: ocItemsData, error: ocItemsError } = await supabase
            .from('orden_compra_items')
            .select('orden_compra_id, articulo_id, cantidad_facturada')
            .in('orden_compra_id', lote)

          if (ocItemsError) throw ocItemsError

          ;(ocItemsData || []).forEach(it => {
            if (!it.articulo_id) return
            const orden = ordenInfoMap.get(it.orden_compra_id)
            if (!orden) return

            if (orden.estado === 1) {
              cantidadPedidaMap.set(it.articulo_id, (cantidadPedidaMap.get(it.articulo_id) || 0) + it.cantidad_facturada)
            } else if (orden.estado === 2) {
              const actual = proveedorPorArticuloMap.get(it.articulo_id)
              if (!actual || orden.fecha > actual.fecha) {
                proveedorPorArticuloMap.set(it.articulo_id, { proveedorId: orden.proveedorId, fecha: orden.fecha })
              }
            }
          })
        }
      }

      const filasArmadas: FilaArticulo[] = articuloIds.map(id => {
        const proveedorInfo = proveedorPorArticuloMap.get(id)
        const proveedorId = proveedorInfo?.proveedorId ?? null
        const proveedorNombre = proveedorId ? (proveedorNombreMap.get(proveedorId) || 'Proveedor desconocido') : 'Sin proveedor asignado'

        return {
          id,
          nombre: articuloNombreMap.get(id) || `Artículo #${id}`,
          stockActual: stockMap.get(id) || 0,
          unidadesPeriodo: unidadesPorArticulo.get(id) || { 1: 0, 3: 0, 6: 0, 12: 0 },
          cantidadPedida: cantidadPedidaMap.get(id) || 0,
          proveedorId,
          proveedorNombre,
        }
      })

      setFilas(filasArmadas)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : JSON.stringify(err))
    } finally {
      setLoading(false)
    }
  }

  // Cálculo de cobertura y sugerencia — depende de los inputs configurables
  const filasCalculadas = useMemo(() => {
    const diasPeriodo = periodo * 30
    return filas.map(f => {
      const unidades = f.unidadesPeriodo[periodo]
      const promedioDiario = unidades / diasPeriodo
      const diasCobertura = promedioDiario > 0 ? f.stockActual / promedioDiario : Infinity
      const necesitaCompra = diasCobertura < umbralDias
      const cantidadSugeridaBruta = promedioDiario * objetivoDias - f.stockActual - f.cantidadPedida
      const cantidadSugerida = necesitaCompra ? Math.max(0, Math.ceil(cantidadSugeridaBruta)) : 0
      return { ...f, promedioDiario, diasCobertura, necesitaCompra, cantidadSugerida }
    })
  }, [filas, periodo, umbralDias, objetivoDias])

  const filasFiltradas = useMemo(() => {
    let out = filasCalculadas
    if (!mostrarTodos) out = out.filter(f => f.necesitaCompra)
    if (busqueda.trim()) {
      const q = busqueda.trim().toLowerCase()
      out = out.filter(f => f.nombre.toLowerCase().includes(q) || f.proveedorNombre.toLowerCase().includes(q))
    }
    return out
  }, [filasCalculadas, mostrarTodos, busqueda])

  // Agrupación por proveedor, ordenada alfabéticamente — "Sin proveedor
  // asignado" siempre al final. Dentro de cada grupo, más urgente primero.
  const grupos = useMemo(() => {
    const map = new Map<number, { id: number; nombre: string; filas: typeof filasFiltradas }>()
    filasFiltradas.forEach(f => {
      const key = f.proveedorId ?? SIN_PROVEEDOR
      const grupo = map.get(key) || { id: key, nombre: f.proveedorNombre, filas: [] }
      grupo.filas.push(f)
      map.set(key, grupo)
    })
    const arr = Array.from(map.values())
    arr.forEach(g => g.filas.sort((a, b) => a.diasCobertura - b.diasCobertura))
    arr.sort((a, b) => {
      if (a.id === SIN_PROVEEDOR) return 1
      if (b.id === SIN_PROVEEDOR) return -1
      return a.nombre.localeCompare(b.nombre)
    })
    return arr
  }, [filasFiltradas])

  function toggleGrupo(id: number) {
    setGruposColapsados(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const totalUnidadesSugeridas = filasFiltradas.reduce((sum, f) => sum + f.cantidadSugerida, 0)
  const totalArticulos = filasFiltradas.length

  const fmtDias = (n: number) => (n === Infinity ? '—' : Math.round(n).toString())

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-sm text-gray-400">Cargando sugerencia de compra...</p>
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
        <h1 className="text-xl font-semibold text-[#3c3c3b]">Reportes — Sugerencia de Compra</h1>
        {totalArticulos > 0 && (
          <span className="text-xs text-gray-400">
            {totalArticulos} {totalArticulos === 1 ? 'artículo' : 'artículos'} · {totalUnidadesSugeridas.toLocaleString('es-AR')} unidades sugeridas
          </span>
        )}
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Filter className="w-4 h-4 text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-700">Parámetros</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Período de historia de ventas</label>
            <select
              value={periodo}
              onChange={e => setPeriodo(Number(e.target.value) as PeriodoMeses)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]"
            >
              <option value={1}>Último mes</option>
              <option value={3}>Últimos 3 meses</option>
              <option value={6}>Últimos 6 meses</option>
              <option value={12}>Último año</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Umbral — cobertura mínima (días)</label>
            <input
              type="text"
              inputMode="numeric"
              value={umbralDias}
              onChange={e => setUmbralDias(Number(e.target.value.replace(/\D/g, '')) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Cobertura objetivo al reponer (días)</label>
            <input
              type="text"
              inputMode="numeric"
              value={objetivoDias}
              onChange={e => setObjetivoDias(Number(e.target.value.replace(/\D/g, '')) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]"
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={mostrarTodos}
                onChange={e => setMostrarTodos(e.target.checked)}
                className="rounded border-gray-300 text-[#00a19a] focus:ring-[#00a19a]"
              />
              Mostrar todos (no solo los que necesitan reposición)
            </label>
          </div>
        </div>

        <div className="relative max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar artículo o proveedor..."
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg text-[#3c3c3b]"
          />
        </div>
      </div>

      {grupos.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-sm text-gray-400">
          {mostrarTodos
            ? 'No hay artículos disponibles en el local para evaluar.'
            : 'Ningún artículo está por debajo del umbral de cobertura elegido — probá bajar el umbral o tildar "Mostrar todos".'}
        </div>
      ) : (
        <div className="space-y-4">
          {grupos.map(grupo => {
            const colapsado = gruposColapsados.has(grupo.id)
            const unidadesGrupo = grupo.filas.reduce((s, f) => s + f.cantidadSugerida, 0)
            return (
              <div key={grupo.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <button
                  onClick={() => toggleGrupo(grupo.id)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {colapsado ? <ChevronRight className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    <span className="text-sm font-semibold text-[#3c3c3b]">{grupo.nombre}</span>
                    <span className="text-xs text-gray-400">({grupo.filas.length})</span>
                  </div>
                  <span className="text-xs text-gray-500">{unidadesGrupo.toLocaleString('es-AR')} unidades sugeridas</span>
                </button>

                {!colapsado && (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/50">
                        <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Artículo</th>
                        <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Stock actual</th>
                        <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Venta prom. mensual</th>
                        <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Días cobertura</th>
                        <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Cant. pedida</th>
                        <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Cant. sugerida</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grupo.filas.map(f => (
                        <tr key={f.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                          <td className="px-4 py-2.5 text-[#3c3c3b] flex items-center gap-1.5">
                            {f.necesitaCompra && f.diasCobertura < umbralDias / 2 && (
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            )}
                            {f.nombre}
                          </td>
                          <td className="px-4 py-2.5 text-right text-[#3c3c3b]">{f.stockActual.toLocaleString('es-AR')}</td>
                          <td className="px-4 py-2.5 text-right text-gray-500">{(f.promedioDiario * 30).toFixed(1)}</td>
                          <td className={`px-4 py-2.5 text-right font-medium ${f.necesitaCompra ? 'text-red-600' : 'text-gray-500'}`}>
                            {fmtDias(f.diasCobertura)}
                          </td>
                          <td className="px-4 py-2.5 text-right text-gray-500">{f.cantidadPedida.toLocaleString('es-AR')}</td>
                          <td className="px-4 py-2.5 text-right font-semibold text-[#00a19a]">
                            {f.cantidadSugerida > 0 ? f.cantidadSugerida.toLocaleString('es-AR') : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )
          })}
        </div>
      )}

      <p className="text-xs text-gray-400">
        Solo se evalúan artículos marcados como "Disponible en local". Cant. pedida = unidades ya cargadas en Órdenes
        de Compra en estado Borrador (todavía no confirmadas/recibidas). El proveedor de cada artículo se toma de su
        compra Confirmada más reciente — los que nunca tuvieron una compra registrada quedan en "Sin proveedor asignado".
      </p>
    </div>
  )
}
