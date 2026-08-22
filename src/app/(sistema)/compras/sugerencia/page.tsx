'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Search, Filter, AlertTriangle } from 'lucide-react'

interface DetallePresupuesto {
  numero: number
  cantidad: number
}

interface FilaArticulo {
  id: number
  nombre: string
  stockActual: number
  unidadesPeriodo: { 1: number; 3: number; 6: number; 12: number }
  cantidadPedida: number
  ultimoProveedorId: number | null
  ultimoProveedorNombre: string
  proveedoresHistoricos: Set<number>
  cantidadPresupuestos: number
  detallePresupuestos: DetallePresupuesto[]
}

interface Proveedor {
  id: number
  nombre: string
}

type PeriodoMeses = 1 | 3 | 6 | 12

const SIN_PROVEEDOR = 'sin_proveedor'

export default function SugerenciaCompraPage() {
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filas, setFilas] = useState<FilaArticulo[]>([])
  const [proveedores, setProveedores] = useState<Proveedor[]>([])

  const [periodo, setPeriodo] = useState<PeriodoMeses>(3)
  const [umbralDias, setUmbralDias] = useState<number>(15)
  const [objetivoDias, setObjetivoDias] = useState<number>(30)
  const [mostrarTodos, setMostrarTodos] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [filtroProveedor, setFiltroProveedor] = useState<string>('todos')

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
      let articuloIds = (articulosData || []).map(a => a.id)

      // Presupuestos activos (Enviado/Aprobado — compromisos reales con un
      // cliente, no Borradores que todavía son solo una exploración) —
      // suman demanda propia además de la venta histórica, con trazabilidad
      // de a qué presupuesto puntual corresponde cada cantidad.
      const { data: presupuestosData, error: presupuestosError } = await supabase
        .from('presupuestos')
        .select('id, numero')
        .in('estado', ['Enviado', 'Aprobado'])

      if (presupuestosError) throw presupuestosError

      const presupuestoNumeroMap = new Map<number, number>()
      ;(presupuestosData || []).forEach(p => presupuestoNumeroMap.set(p.id, p.numero))
      const presupuestoIds = (presupuestosData || []).map(p => p.id)

      const cantidadPresupuestosMap = new Map<number, number>()
      const detallePresupuestosMap = new Map<number, DetallePresupuesto[]>()

      if (presupuestoIds.length > 0) {
        for (const lote of partirEnLotes(presupuestoIds, 500)) {
          const { data: presupuestoItemsData, error: presupuestoItemsError } = await supabase
            .from('presupuesto_items')
            .select('presupuesto_id, articulo_id, cantidad')
            .in('presupuesto_id', lote)

          if (presupuestoItemsError) throw presupuestoItemsError

          ;(presupuestoItemsData || []).forEach(it => {
            const numero = presupuestoNumeroMap.get(it.presupuesto_id)
            if (!numero) return
            cantidadPresupuestosMap.set(it.articulo_id, (cantidadPresupuestosMap.get(it.articulo_id) || 0) + it.cantidad)
            const detalle = detallePresupuestosMap.get(it.articulo_id) || []
            detalle.push({ numero, cantidad: it.cantidad })
            detallePresupuestosMap.set(it.articulo_id, detalle)
          })
        }
      }

      // El buscador de Presupuestos no filtra por "Disponible en local" (a
      // propósito, para poder presupuestar cualquier cosa) — así que puede
      // haber artículos con compromiso real en un presupuesto que no
      // formen parte del universo normal de esta pantalla. Se agregan acá
      // para no dejarlos invisibles, en vez de perderlos en silencio.
      const idsFaltantesEnUniverso = [...cantidadPresupuestosMap.keys()].filter(id => !articuloNombreMap.has(id))
      if (idsFaltantesEnUniverso.length > 0) {
        const { data: articulosExtra, error: articulosExtraError } = await supabase
          .from('articulos')
          .select('id, nombre')
          .in('id', idsFaltantesEnUniverso)

        if (articulosExtraError) throw articulosExtraError

        ;(articulosExtra || []).forEach(a => articuloNombreMap.set(a.id, a.nombre))
        articuloIds = [...articuloIds, ...idsFaltantesEnUniverso]
      }

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
      // (ya recibida — sirve tanto para "Último proveedor" como para saber
      // TODOS los proveedores a los que se le compró alguna vez cada
      // artículo, no solo el más reciente — necesario para el filtro).
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
        .order('nombre_comercial')

      if (proveedoresError) throw proveedoresError

      const proveedorNombreMap = new Map<number, string>()
      ;(proveedoresData || []).forEach(p => proveedorNombreMap.set(p.id, p.nombre_comercial))
      setProveedores((proveedoresData || []).map(p => ({ id: p.id, nombre: p.nombre_comercial })))

      const cantidadPedidaMap = new Map<number, number>()
      const ultimoProveedorPorArticuloMap = new Map<number, { proveedorId: number; fecha: string }>()
      const todosProveedoresPorArticuloMap = new Map<number, Set<number>>()

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
              const actual = ultimoProveedorPorArticuloMap.get(it.articulo_id)
              if (!actual || orden.fecha > actual.fecha) {
                ultimoProveedorPorArticuloMap.set(it.articulo_id, { proveedorId: orden.proveedorId, fecha: orden.fecha })
              }
              const historicos = todosProveedoresPorArticuloMap.get(it.articulo_id) || new Set<number>()
              historicos.add(orden.proveedorId)
              todosProveedoresPorArticuloMap.set(it.articulo_id, historicos)
            }
          })
        }
      }

      const filasArmadas: FilaArticulo[] = articuloIds.map(id => {
        const proveedorInfo = ultimoProveedorPorArticuloMap.get(id)
        const ultimoProveedorId = proveedorInfo?.proveedorId ?? null
        const ultimoProveedorNombre = ultimoProveedorId ? (proveedorNombreMap.get(ultimoProveedorId) || 'Proveedor desconocido') : 'Sin proveedor asignado'

        return {
          id,
          nombre: articuloNombreMap.get(id) || `Artículo #${id}`,
          stockActual: stockMap.get(id) || 0,
          unidadesPeriodo: unidadesPorArticulo.get(id) || { 1: 0, 3: 0, 6: 0, 12: 0 },
          cantidadPedida: cantidadPedidaMap.get(id) || 0,
          ultimoProveedorId,
          ultimoProveedorNombre,
          proveedoresHistoricos: todosProveedoresPorArticuloMap.get(id) || new Set<number>(),
          cantidadPresupuestos: cantidadPresupuestosMap.get(id) || 0,
          detallePresupuestos: detallePresupuestosMap.get(id) || [],
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
      const necesitaPorCobertura = diasCobertura < umbralDias
      // Lo que falta específicamente para cubrir los presupuestos activos
      // (Enviado/Aprobado), descontando stock y lo que ya viene en camino
      // por OC pendiente — independiente de si la venta histórica lo pedía.
      const faltantePresupuesto = Math.max(0, Math.ceil(f.cantidadPresupuestos - f.stockActual - f.cantidadPedida))
      const necesitaCompra = necesitaPorCobertura || faltantePresupuesto > 0
      const cantidadSugeridaBruta = promedioDiario * objetivoDias - f.stockActual - f.cantidadPedida
      const cantidadSugerida = necesitaCompra
        ? Math.max(0, Math.ceil(cantidadSugeridaBruta), faltantePresupuesto)
        : 0
      return { ...f, promedioDiario, diasCobertura, necesitaCompra, cantidadSugerida, faltantePresupuesto }
    })
  }, [filas, periodo, umbralDias, objetivoDias])

  const filasFiltradas = useMemo(() => {
    let out = filasCalculadas
    if (!mostrarTodos) out = out.filter(f => f.necesitaCompra)
    if (busqueda.trim()) {
      const q = busqueda.trim().toLowerCase()
      out = out.filter(f => f.nombre.toLowerCase().includes(q) || f.ultimoProveedorNombre.toLowerCase().includes(q))
    }
    // Filtro por proveedor: "comprado ALGUNA VEZ ahí" (todo el historial),
    // no solo el último — por eso puede aparecer un artículo cuyo "Último
    // proveedor" mostrado sea otro distinto al elegido acá; es intencional,
    // sirve para armar un pedido completo a un proveedor puntual.
    if (filtroProveedor === SIN_PROVEEDOR) {
      out = out.filter(f => f.proveedoresHistoricos.size === 0)
    } else if (filtroProveedor !== 'todos') {
      const proveedorId = Number(filtroProveedor)
      out = out.filter(f => f.proveedoresHistoricos.has(proveedorId))
    }
    // Orden: primero lo que tiene un presupuesto activo esperando
    // (compromiso real con un cliente, la urgencia más alta posible),
    // después lo que más pesa en la próxima compra (Cant. sugerida desc),
    // y a igualdad, lo que más rota (Venta prom. mensual desc).
    return [...out].sort((a, b) => {
      const aTienePresupuesto = a.faltantePresupuesto > 0
      const bTienePresupuesto = b.faltantePresupuesto > 0
      if (aTienePresupuesto !== bTienePresupuesto) return aTienePresupuesto ? -1 : 1
      if (b.cantidadSugerida !== a.cantidadSugerida) return b.cantidadSugerida - a.cantidadSugerida
      return b.promedioDiario - a.promedioDiario
    })
  }, [filasCalculadas, mostrarTodos, busqueda, filtroProveedor])

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
        <h1 className="text-xl font-semibold text-[#3c3c3b]">Compras — Sugerencia de Compra</h1>
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
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Proveedor (comprado alguna vez ahí)</label>
            <select
              value={filtroProveedor}
              onChange={e => setFiltroProveedor(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]"
            >
              <option value="todos">Todos</option>
              {proveedores.map(p => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
              <option value={SIN_PROVEEDOR}>Sin proveedor asignado</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar artículo o proveedor..."
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg text-[#3c3c3b]"
            />
          </div>
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

      {filasFiltradas.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-sm text-gray-400">
          {mostrarTodos
            ? 'No hay artículos que coincidan con los filtros elegidos.'
            : 'Ningún artículo está por debajo del umbral de cobertura elegido — probá bajar el umbral o tildar "Mostrar todos".'}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Artículo</th>
                <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Stock actual</th>
                <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Venta prom. mensual</th>
                <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Días cobertura</th>
                <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Cant. pedida</th>
                <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Presupuestos</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Último proveedor</th>
                <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Cant. sugerida</th>
              </tr>
            </thead>
            <tbody>
              {filasFiltradas.map(f => (
                <tr key={f.id} className={`border-b border-gray-50 last:border-0 hover:bg-gray-50 ${f.faltantePresupuesto > 0 ? 'bg-blue-50/40' : ''}`}>
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
                  <td className="px-4 py-2.5 text-right">
                    {f.detallePresupuestos.length === 0 ? (
                      <span className="text-gray-300">—</span>
                    ) : (
                      <span className="text-xs text-blue-700 font-medium">
                        {f.detallePresupuestos.map(d => `#${d.numero} (${d.cantidad})`).join(', ')}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 text-sm">{f.ultimoProveedorNombre}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-[#00a19a]">
                    {f.cantidadSugerida > 0 ? f.cantidadSugerida.toLocaleString('es-AR') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-400">
        Solo se evalúan artículos marcados como "Disponible en local" (más los que estén en un presupuesto activo
        aunque no tengan ese tilde, para no dejarlos invisibles). Cant. pedida = unidades ya cargadas en Órdenes de
        Compra en estado Borrador (todavía no confirmadas/recibidas). Presupuestos = artículos comprometidos en
        presupuestos Enviados o Aprobados (no Borrador) — siempre dispara la necesidad de compra, incluso si la venta
        histórica no lo pedía; esas filas quedan resaltadas y primero en la lista. "Último proveedor" es la compra
        Confirmada más reciente de ese artículo puntual — el filtro de Proveedor, en cambio, busca en todo el
        historial (puede mostrar un artículo cuyo Último proveedor sea otro distinto al filtrado).
      </p>
    </div>
  )
}
