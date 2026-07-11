'use client'

import { useEffect, useState, useMemo, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Search, ArrowLeft } from 'lucide-react'

interface ArticuloPrecio {
  articulo_id: number
  nombre: string
  codigo_interno: string | null
  codigo_barra: string | null
  rubro_id: number | null
  rubroNombre: string | null
  marca_id: number | null
  marcaNombre: string | null
  disponible_local: boolean
  disponible_web: boolean
  stock: number
  tasaIvaId: number | null
  ivaPct: number
  costoConIva: number
  precioActual: number
  utilidadActual: number
  actualizadoFecha: string | null
  desactualizado: boolean
  precioNuevoTexto: string
  utilidadNuevoTexto: string
  seleccionado: boolean
}

interface Rubro { id: number; nombre: string }
interface Marca { id: number; nombre: string }
interface OrdenCompraOpcion { id: number; fecha_orden: string; proveedorNombre: string }

// Mismo criterio de búsqueda que Artículos: tokenizada, sin acentos/mayúsculas.
function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

// Mismo parseo de montos usado en el resto del sistema (Compras,
// ArticuloForm, Movimientos): coma o punto como decimal si hay 1-2 dígitos
// después, como separador de miles si hay 3 o más.
function parsearMonto(v: string): number {
  const limpio = v.trim()
  if (!limpio) return 0
  const ultimoSep = Math.max(limpio.lastIndexOf(','), limpio.lastIndexOf('.'))
  if (ultimoSep === -1) return parseInt(limpio, 10) || 0
  const decimales = limpio.length - ultimoSep - 1
  if (decimales >= 1 && decimales <= 2) {
    const entero = limpio.slice(0, ultimoSep).replace(/[.,]/g, '')
    const decimal = limpio.slice(ultimoSep + 1)
    return parseFloat(`${entero || '0'}.${decimal}`) || 0
  }
  return parseInt(limpio.replace(/[.,]/g, ''), 10) || 0
}

function fmtMonto(n: number): string {
  return n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Utilidad % = recargo sobre el costo (markup) — misma fórmula que
// ArticuloForm.tsx y que usaba Cover (unificado 10/07/2026).
function calcularUtilidadPct(precio: number, costoConIva: number): number {
  if (!costoConIva) return 0
  return ((precio - costoConIva) / costoConIva) * 100
}

function calcularPrecioDesdeUtilidad(utilidadPct: number, costoConIva: number): number {
  return costoConIva * (1 + utilidadPct / 100)
}

function ActualizarPreciosContent() {
  const searchParams = useSearchParams()

  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [accesoDenegado, setAccesoDenegado] = useState(false)
  const [usuarioId, setUsuarioId] = useState<string | null>(null)
  const [notif, setNotif] = useState<{ tipo: 'error' | 'ok'; msg: string } | null>(null)

  const [rubros, setRubros] = useState<Rubro[]>([])
  const [marcas, setMarcas] = useState<Marca[]>([])
  const [ordenesCompra, setOrdenesCompra] = useState<OrdenCompraOpcion[]>([])
  const [items, setItems] = useState<ArticuloPrecio[]>([])
  const [guardando, setGuardando] = useState<Set<number>>(new Set())

  // Cache de datos base (artículos/stock/rubros/marcas/histórico) para
  // reconstruir `items` cuando cambia el filtro de OC sin repetir queries.
  // useRef porque debe persistir entre renders — una variable local común
  // se resetea cada vez que el componente vuelve a ejecutar su función.
  const datosBaseRef = useRef<{
    articulosData: any[]
    mapStock: Map<number, number>
    mapTasas: Map<number, number>
    mapRubros: Map<number, string>
    mapMarcas: Map<number, string>
    mapActualizado: Map<number, string>
    mapActualizadoTs: Map<number, string>
    mapUltimoCostoTs: Map<number, string>
  } | null>(null)

  // Filtros — mismos nombres/valores por defecto que Artículos, + OC.
  const [busqueda, setBusqueda] = useState('')
  const [rubroFiltro, setRubroFiltro] = useState('todos')
  const [marcaFiltro, setMarcaFiltro] = useState('todos')
  const [disponibilidadFiltro, setDisponibilidadFiltro] = useState('local')
  const [stockFiltro, setStockFiltro] = useState('todos')
  const [ocFiltro, setOcFiltro] = useState('todos')
  const [soloDesactualizados, setSoloDesactualizados] = useState(false)
  const [pctAumento, setPctAumento] = useState('')

  useEffect(() => {
    const ocParam = searchParams.get('oc')
    if (ocParam) setOcFiltro(ocParam)
  }, [searchParams])

  useEffect(() => { cargarDatos() }, [])

  // Único lugar que decide cuándo (re)construir `items`: al terminar la
  // carga inicial, o cuando cambia el filtro de OC después. Evita la
  // condición de carrera entre "leer ?oc= de la URL" y "cargar datos"
  // (si ocFiltro cambiaba antes de que cargarDatos terminara, el filtro
  // podía no aplicarse en la primera construcción de la lista).
  useEffect(() => {
    if (!cargando && datosBaseRef.current) construirItems()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ocFiltro, cargando])

  async function cargarDatos() {
    const supabase = createClient()
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')

      const { data: usuarioData, error: usuarioError } = await supabase
        .from('usuarios').select('id, rol_id').eq('id', user.id).single()
      if (usuarioError) throw usuarioError

      // Pantalla admin-only — muestra costos (regla ya establecida).
      if (usuarioData.rol_id !== 1) {
        setAccesoDenegado(true)
        setCargando(false)
        return
      }
      setUsuarioId(usuarioData.id)

      const [
        { data: articulosData, error: articulosError },
        { data: stockData },
        { data: rubrosData },
        { data: marcasData },
        { data: tasasData },
        { data: historicoData },
        { data: historicoCostoData },
        { data: ordenesData },
        { data: proveedoresData },
      ] = await Promise.all([
        supabase.from('articulos')
          .select('id, nombre, codigo_interno, codigo_barra, rubro_id, marca_id, precio_local, disponible_local, disponible_web, tasa_iva_id, costo_sin_iva')
          .eq('activo', true).order('nombre'),
        supabase.from('articulo_stock').select('articulo_id, stock_actual').eq('sucursal_id', 1),
        supabase.from('rubros').select('id, nombre').eq('activo', true).order('nombre'),
        supabase.from('marcas').select('id, nombre').eq('activo', true).order('nombre'),
        supabase.from('tasas_iva').select('id, porcentaje'),
        // Solo cambios reales de precio (no de costo) — más recientes primero.
        // creado_en (con hora) se usa para decidir orden real; fecha (DATE)
        // solo para mostrar en pantalla.
        supabase.from('historico_precios').select('articulo_id, fecha, creado_en').eq('tipo', 'precio_manual').order('creado_en', { ascending: false }),
        // Cambios de costo (vienen de Compras al confirmar) — para detectar
        // artículos cuyo costo subió después de la última revisión de precio.
        supabase.from('historico_precios').select('articulo_id, fecha, creado_en').eq('tipo', 'costo').order('creado_en', { ascending: false }),
        // Solo Borrador: una vez Confirmada, el costo de esa compra ya
        // pasó a costo_sin_iva del artículo (costo general), así que no
        // hace falta seguir viéndola aparte en este combo.
        supabase.from('ordenes_compra').select('id, fecha_orden, proveedor_id').eq('estado_orden_compra_id', 1).order('id', { ascending: false }),
        supabase.from('proveedores').select('id, nombre_comercial'),
      ])

      if (articulosError) throw articulosError

      const mapStock = new Map<number, number>((stockData || []).map(s => [s.articulo_id, s.stock_actual]))
      const mapTasas = new Map<number, number>((tasasData || []).map(t => [t.id, t.porcentaje]))
      const mapProveedores = new Map<number, string>((proveedoresData || []).map(p => [p.id, p.nombre_comercial]))
      const mapRubros = new Map<number, string>((rubrosData || []).map((r: Rubro) => [r.id, r.nombre]))
      const mapMarcas = new Map<number, string>((marcasData || []).map((m: Marca) => [m.id, m.nombre]))

      // "Actualizado" = fecha del cambio de precio más reciente por
      // artículo (para MOSTRAR). Como historicoData ya viene ordenado por
      // creado_en desc, la primera aparición de cada articulo_id es la
      // más reciente. mapActualizadoTs guarda el creado_en real, para
      // COMPARAR con precisión (dos cambios el mismo día se distinguen).
      const mapActualizado = new Map<number, string>()
      const mapActualizadoTs = new Map<number, string>()
      for (const h of (historicoData || [])) {
        if (!mapActualizado.has(h.articulo_id)) {
          mapActualizado.set(h.articulo_id, h.fecha)
          mapActualizadoTs.set(h.articulo_id, h.creado_en)
        }
      }

      // Misma lógica, para el último cambio de costo.
      const mapUltimoCostoTs = new Map<number, string>()
      for (const h of (historicoCostoData || [])) {
        if (!mapUltimoCostoTs.has(h.articulo_id)) mapUltimoCostoTs.set(h.articulo_id, h.creado_en)
      }

      setRubros(rubrosData || [])
      setMarcas(marcasData || [])
      setOrdenesCompra((ordenesData || []).map((o: any) => ({
        id: o.id,
        fecha_orden: o.fecha_orden,
        proveedorNombre: mapProveedores.get(o.proveedor_id) || '—',
      })))

      // Guardo todo lo necesario para reconstruir items cuando cambie el
      // filtro de OC, sin tener que volver a pedir todo a la base. La
      // construcción de `items` en sí la dispara el efecto [ocFiltro, cargando]
      // una vez que setCargando(false) se aplique más abajo.
      datosBaseRef.current = {
        articulosData: articulosData || [],
        mapStock, mapTasas, mapRubros, mapMarcas, mapActualizado, mapActualizadoTs, mapUltimoCostoTs,
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }

  async function construirItems() {
    if (!datosBaseRef.current) return
    const { articulosData, mapStock, mapTasas, mapRubros, mapMarcas, mapActualizado, mapActualizadoTs, mapUltimoCostoTs } = datosBaseRef.current
    const supabase = createClient()

    // Costo específico de una OC puntual (si hay una seleccionada).
    let mapCostoOC: Map<number, number> | null = null
    let idsArticulosOC: Set<number> | null = null
    if (ocFiltro !== 'todos') {
      const { data: itemsOC, error: itemsOCError } = await supabase
        .from('orden_compra_items')
        .select('articulo_id, costo_final_unitario')
        .eq('orden_compra_id', Number(ocFiltro))
        .eq('es_ajuste_redondeo', false)
        .not('articulo_id', 'is', null)
      if (itemsOCError) { setNotif({ tipo: 'error', msg: 'Error al cargar la OC: ' + itemsOCError.message }); return }
      mapCostoOC = new Map((itemsOC || []).map((it: any) => [it.articulo_id, it.costo_final_unitario]))
      idsArticulosOC = new Set((itemsOC || []).map((it: any) => it.articulo_id))
    }

    // Conservar ediciones ya hechas en pantalla (precioNuevoTexto,
    // utilidadNuevoTexto, seleccionado) por artículo.
    const mapEdicionesPrevias = new Map(items.map(it => [it.articulo_id, it]))

    const nuevosItems: ArticuloPrecio[] = (articulosData as any[])
      .filter(a => !idsArticulosOC || idsArticulosOC.has(a.id))
      .map(a => {
        const ivaPct = a.tasa_iva_id != null ? (mapTasas.get(a.tasa_iva_id) ?? 0) : 0
        const costoSinIva = mapCostoOC ? (mapCostoOC.get(a.id) ?? 0) : (a.costo_sin_iva || 0)
        const costoConIva = costoSinIva * (1 + ivaPct / 100)
        const precioActual = a.precio_local || 0
        const utilidadActual = calcularUtilidadPct(precioActual, costoConIva)
        const actualizadoFecha = mapActualizado.get(a.id) || null
        const actualizadoTs = mapActualizadoTs.get(a.id) || null
        const ultimoCostoTs = mapUltimoCostoTs.get(a.id) || null
        // Desactualizado = nunca se revisó el precio manualmente, o el
        // costo cambió (por una compra) después de la última revisión.
        // Se compara por creado_en (TIMESTAMPTZ, formato ISO de Postgrest)
        // en vez de fecha (DATE) para distinguir correctamente dos cambios
        // del mismo día — con solo fecha, "empataban" y no disparaba la alerta.
        // Comparación de strings 'YYYY-MM-DD' es válida lexicográficamente.
        const desactualizado = !actualizadoTs || (!!ultimoCostoTs && ultimoCostoTs > actualizadoTs)
        const previa = mapEdicionesPrevias.get(a.id)
        const precioNuevoTexto = previa ? previa.precioNuevoTexto : fmtMonto(precioActual)
        const precioNuevoParsed = parsearMonto(precioNuevoTexto)
        return {
          articulo_id: a.id,
          nombre: a.nombre,
          codigo_interno: a.codigo_interno,
          codigo_barra: a.codigo_barra,
          rubro_id: a.rubro_id,
          rubroNombre: a.rubro_id ? (mapRubros.get(a.rubro_id) || null) : null,
          marca_id: a.marca_id,
          marcaNombre: a.marca_id ? (mapMarcas.get(a.marca_id) || null) : null,
          disponible_local: a.disponible_local,
          disponible_web: a.disponible_web,
          stock: mapStock.get(a.id) ?? 0,
          tasaIvaId: a.tasa_iva_id,
          ivaPct,
          costoConIva,
          precioActual,
          utilidadActual,
          actualizadoFecha,
          desactualizado,
          // precioNuevoTexto sí se preserva tal cual (es un monto real,
          // no depende del costo). utilidadNuevoTexto, en cambio, SIEMPRE
          // se recalcula contra el costoConIva actual — si se preservara
          // el texto viejo, quedaría mal cuando el costo cambia al
          // seleccionar/cambiar el filtro de OC (bug encontrado 11/07/2026).
          precioNuevoTexto,
          utilidadNuevoTexto: precioNuevoParsed > 0 ? calcularUtilidadPct(precioNuevoParsed, costoConIva).toFixed(1) : utilidadActual.toFixed(1),
          seleccionado: previa ? previa.seleccionado : false,
        }
      })

    setItems(nuevosItems)
  }

  const itemsVisibles = useMemo(() => {
    return items.filter(it => {
      const tokens = normalizar(busqueda).trim().split(/\s+/).filter(Boolean)
      if (tokens.length > 0) {
        const haystack = normalizar([it.nombre, it.codigo_interno, it.codigo_barra, it.rubroNombre, it.marcaNombre].filter(Boolean).join(' '))
        if (!tokens.every(t => haystack.includes(t))) return false
      }
      if (rubroFiltro !== 'todos' && it.rubro_id?.toString() !== rubroFiltro) return false
      if (marcaFiltro !== 'todos' && it.marca_id?.toString() !== marcaFiltro) return false
      if (disponibilidadFiltro === 'local' && !it.disponible_local) return false
      if (disponibilidadFiltro === 'web' && !it.disponible_web) return false
      if (stockFiltro === 'con_stock' && it.stock <= 0) return false
      if (stockFiltro === 'sin_stock' && it.stock > 0) return false
      if (soloDesactualizados && !it.desactualizado) return false
      return true
    })
  }, [items, busqueda, rubroFiltro, marcaFiltro, disponibilidadFiltro, stockFiltro, soloDesactualizados])

  const todosVisiblesSeleccionados = itemsVisibles.length > 0 && itemsVisibles.every(it => it.seleccionado)

  function toggleSeleccionarTodos() {
    const nuevoValor = !todosVisiblesSeleccionados
    const idsVisibles = new Set(itemsVisibles.map(it => it.articulo_id))
    setItems(prev => prev.map(it => idsVisibles.has(it.articulo_id) ? { ...it, seleccionado: nuevoValor } : it))
  }

  function toggleSeleccion(articuloId: number) {
    setItems(prev => prev.map(it => it.articulo_id === articuloId ? { ...it, seleccionado: !it.seleccionado } : it))
  }

  function aplicarAumentoASeleccionados() {
    const pct = parsearMonto(pctAumento)
    if (!pct) { setNotif({ tipo: 'error', msg: 'Ingresá un porcentaje válido.' }); return }
    setItems(prev => prev.map(it => {
      if (!it.seleccionado) return it
      const nuevoPrecio = Math.round(it.precioActual * (1 + pct / 100))
      return {
        ...it,
        precioNuevoTexto: fmtMonto(nuevoPrecio),
        utilidadNuevoTexto: calcularUtilidadPct(nuevoPrecio, it.costoConIva).toFixed(1),
      }
    }))
  }

  function actualizarDesdePrecio(articuloId: number, texto: string) {
    setItems(prev => prev.map(it => {
      if (it.articulo_id !== articuloId) return it
      const precio = parsearMonto(texto)
      const utilidad = calcularUtilidadPct(precio, it.costoConIva)
      return { ...it, precioNuevoTexto: texto, utilidadNuevoTexto: precio > 0 ? utilidad.toFixed(1) : it.utilidadNuevoTexto }
    }))
  }

  function actualizarDesdeUtilidad(articuloId: number, texto: string) {
    setItems(prev => prev.map(it => {
      if (it.articulo_id !== articuloId) return it
      const utilidadPct = parseFloat(texto.replace(',', '.'))
      if (isNaN(utilidadPct)) return { ...it, utilidadNuevoTexto: texto }
      const precio = calcularPrecioDesdeUtilidad(utilidadPct, it.costoConIva)
      return { ...it, utilidadNuevoTexto: texto, precioNuevoTexto: precio > 0 ? fmtMonto(Math.round(precio)) : it.precioNuevoTexto }
    }))
  }

  function reformatearFila(articuloId: number) {
    setItems(prev => prev.map(it => {
      if (it.articulo_id !== articuloId) return it
      const precio = parsearMonto(it.precioNuevoTexto)
      const utilidad = calcularUtilidadPct(precio, it.costoConIva)
      return {
        ...it,
        precioNuevoTexto: precio > 0 ? fmtMonto(precio) : it.precioNuevoTexto,
        utilidadNuevoTexto: precio > 0 ? utilidad.toFixed(1) : it.utilidadNuevoTexto,
      }
    }))
  }

  async function guardarPrecio(articuloId: number) {
    const item = items.find(it => it.articulo_id === articuloId)
    if (!item) return
    const nuevoPrecio = parsearMonto(item.precioNuevoTexto)
    if (nuevoPrecio <= 0) { setNotif({ tipo: 'error', msg: 'El precio debe ser mayor a $0.' }); return }

    setGuardando(prev => new Set(prev).add(articuloId))
    const supabase = createClient()
    try {
      const { error: updError } = await supabase.from('articulos').update({ precio_local: nuevoPrecio }).eq('id', articuloId)
      if (updError) throw updError

      const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
      const { error: histError } = await supabase.from('historico_precios').insert({
        articulo_id: articuloId,
        fecha: hoy,
        tipo: 'precio_manual',
        precio_local: nuevoPrecio,
        tasa_iva_id: item.tasaIvaId,
        origen_id: ocFiltro !== 'todos' ? Number(ocFiltro) : null,
        usuario_id: usuarioId,
      })
      if (histError) throw histError

      setItems(prev => prev.map(it => it.articulo_id === articuloId
        ? { ...it, precioActual: nuevoPrecio, utilidadActual: calcularUtilidadPct(nuevoPrecio, it.costoConIva), actualizadoFecha: hoy, desactualizado: false }
        : it))
      setNotif({ tipo: 'ok', msg: `Precio de "${item.nombre}" actualizado a $${fmtMonto(nuevoPrecio)}.` })
    } catch (err: any) {
      setNotif({ tipo: 'error', msg: 'Error al guardar: ' + err.message })
    } finally {
      setGuardando(prev => { const s = new Set(prev); s.delete(articuloId); return s })
    }
  }

  const hayModificados = items.some(it => parsearMonto(it.precioNuevoTexto) !== it.precioActual)

  async function guardarTodosLosModificados() {
    const idsModificados = items
      .filter(it => parsearMonto(it.precioNuevoTexto) !== it.precioActual)
      .map(it => it.articulo_id)
    for (const id of idsModificados) {
      await guardarPrecio(id)
    }
  }

  const ordenSeleccionada = ocFiltro !== 'todos' ? ordenesCompra.find(o => o.id === Number(ocFiltro)) : null

  if (cargando) return <p className="text-sm text-gray-500">Cargando artículos...</p>
  if (accesoDenegado) return <p className="text-sm text-red-500">No tenés permiso para ver esta pantalla.</p>
  if (error) return <p className="text-sm text-red-500">Error: {error}</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/articulos" className="text-xs text-gray-400 hover:text-[#00a19a] flex items-center gap-1 mb-1">
            <ArrowLeft className="w-3 h-3" /> Volver a Artículos
          </Link>
          <h1 className="text-xl font-semibold text-[#3c3c3b]">Actualizar precios</h1>
          {ordenSeleccionada && (
            <p className="text-xs text-gray-500">
              Filtrado por OC #{ordenSeleccionada.id} — {ordenSeleccionada.proveedorNombre} · {ordenSeleccionada.fecha_orden.split('-').reverse().join('/')}
            </p>
          )}
        </div>
        {hayModificados && (
          <button onClick={guardarTodosLosModificados} disabled={guardando.size > 0}
            className="bg-[#00a19a] text-white px-4 py-2 rounded text-sm hover:bg-[#008f89] disabled:opacity-50">
            Guardar todos los modificados
          </button>
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

      {/* Filtros */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Buscar</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input type="text" placeholder="Nombre, código interno o de barras"
                value={busqueda} onChange={e => setBusqueda(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Rubro</label>
            <select value={rubroFiltro} onChange={e => setRubroFiltro(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]">
              <option value="todos">Todos los rubros</option>
              {rubros.map(r => <option key={r.id} value={r.id.toString()}>{r.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Marca</label>
            <select value={marcaFiltro} onChange={e => setMarcaFiltro(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]">
              <option value="todos">Todas las marcas</option>
              {marcas.map(m => <option key={m.id} value={m.id.toString()}>{m.nombre}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Disponibilidad</label>
            <select value={disponibilidadFiltro} onChange={e => setDisponibilidadFiltro(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]">
              <option value="local">Disponibles en local</option>
              <option value="web">Disponibles en web</option>
              <option value="todos">Todos</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Stock</label>
            <select value={stockFiltro} onChange={e => setStockFiltro(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]">
              <option value="todos">Todos</option>
              <option value="con_stock">Con stock</option>
              <option value="sin_stock">Sin stock</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">OC pendiente</label>
            <select value={ocFiltro} onChange={e => setOcFiltro(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]">
              <option value="todos">Ninguna (costo general)</option>
              {ordenesCompra.map(o => (
                <option key={o.id} value={o.id.toString()}>
                  OC #{o.id} — {o.proveedorNombre} — {o.fecha_orden.split('-').reverse().join('/')}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <p className="text-xs text-gray-500 pb-2">
              {itemsVisibles.length} {itemsVisibles.length === 1 ? 'artículo' : 'artículos'}
            </p>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-gray-100">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer w-fit">
            <input type="checkbox" checked={soloDesactualizados} onChange={e => setSoloDesactualizados(e.target.checked)}
              className="rounded border-gray-300 text-[#00a19a] focus:ring-[#00a19a]" />
            Solo desactualizados — el costo cambió después de la última revisión de precio
            <span className="text-gray-400">
              ({items.filter(it => it.desactualizado).length} de {items.length})
            </span>
          </label>
        </div>
      </div>

      {/* Ajuste masivo */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4 flex items-center gap-3 flex-wrap">
        <button onClick={toggleSeleccionarTodos}
          className="text-xs border border-gray-300 rounded px-3 py-1.5 text-gray-600 hover:bg-gray-50">
          {todosVisiblesSeleccionados ? 'Desmarcar todos' : 'Seleccionar todos'}
        </button>
        <span className="text-xs text-gray-400">
          {itemsVisibles.filter(it => it.seleccionado).length} seleccionados
        </span>
        <div className="flex items-center gap-2 ml-auto">
          <label className="text-xs text-gray-600">% de aumento</label>
          <input type="text" inputMode="decimal" value={pctAumento} onChange={e => setPctAumento(e.target.value)}
            placeholder="ej: 8"
            className="w-20 px-2 py-1.5 border border-gray-300 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-[#00a19a]" />
          <button onClick={aplicarAumentoASeleccionados}
            className="text-xs bg-[#3c3c3b] text-white px-3 py-1.5 rounded hover:bg-black">
            Aplicar a seleccionados
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 w-8"></th>
                <th className="text-left px-4 py-3 text-xs text-gray-600 font-semibold">Artículo</th>
                <th className="text-right px-4 py-3 text-xs text-gray-600 font-semibold">Costo c/IVA</th>
                <th className="text-right px-4 py-3 text-xs text-gray-600 font-semibold">Precio actual</th>
                <th className="text-right px-4 py-3 text-xs text-gray-600 font-semibold">Utilidad actual</th>
                <th className="text-center px-4 py-3 text-xs text-gray-600 font-semibold">Actualizado</th>
                <th className="text-right px-4 py-3 text-xs text-gray-600 font-semibold w-32">Precio nuevo</th>
                <th className="text-right px-4 py-3 text-xs text-gray-600 font-semibold w-24">Utilidad %</th>
                <th className="px-4 py-3 w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {itemsVisibles.map(it => {
                const precioParsed = parsearMonto(it.precioNuevoTexto)
                const modificado = precioParsed !== it.precioActual
                // "Sin registro" (nunca se revisó el precio) es neutro, no
                // alarma — solo se resalta fuerte cuando SÍ hubo una
                // revisión previa y el costo cambió después de esa fecha.
                const alertaFuerte = it.desactualizado && !!it.actualizadoFecha
                return (
                  <tr key={it.articulo_id} className={modificado ? 'bg-amber-50' : alertaFuerte ? 'bg-orange-50/50' : ''}>
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={it.seleccionado} onChange={() => toggleSeleccion(it.articulo_id)}
                        className="rounded border-gray-300 text-[#00a19a] focus:ring-[#00a19a]" />
                    </td>
                    <td className="px-4 py-3 text-gray-700">{it.nombre}</td>
                    <td className="px-4 py-3 text-right text-gray-500">${fmtMonto(it.costoConIva)}</td>
                    <td className="px-4 py-3 text-right text-gray-500">${fmtMonto(it.precioActual)}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{it.utilidadActual.toFixed(1)}%</td>
                    <td className={`px-4 py-3 text-center text-xs ${alertaFuerte ? 'text-orange-600 font-medium' : 'text-gray-400'}`}>
                      {alertaFuerte && (
                        <span title="El costo cambió después de la última revisión de precio" className="mr-1">⚠</span>
                      )}
                      {it.actualizadoFecha ? it.actualizadoFecha.split('-').reverse().join('/') : 'Sin registro'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <input type="text" inputMode="decimal" value={it.precioNuevoTexto}
                        onChange={e => actualizarDesdePrecio(it.articulo_id, e.target.value)}
                        onBlur={() => reformatearFila(it.articulo_id)}
                        className="w-28 px-2 py-1 border border-gray-300 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-[#00a19a]" />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <input type="text" inputMode="decimal" value={it.utilidadNuevoTexto}
                        onChange={e => actualizarDesdeUtilidad(it.articulo_id, e.target.value)}
                        onBlur={() => reformatearFila(it.articulo_id)}
                        className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-[#00a19a]" />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => guardarPrecio(it.articulo_id)}
                        disabled={!modificado || guardando.has(it.articulo_id)}
                        className="text-xs bg-[#00a19a] text-white px-3 py-1.5 rounded hover:bg-[#008f89] disabled:opacity-30 disabled:cursor-not-allowed">
                        {guardando.has(it.articulo_id) ? '...' : 'Guardar'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {itemsVisibles.length === 0 && (
          <div className="p-8 text-center text-sm text-gray-500">No se encontraron artículos con los filtros aplicados.</div>
        )}
      </div>
    </div>
  )
}

// useSearchParams() (para leer ?oc=) exige estar envuelto en Suspense
// para que Next.js pueda generar la página estáticamente.
export default function ActualizarPreciosPage() {
  return (
    <Suspense fallback={<p className="text-sm text-gray-500">Cargando...</p>}>
      <ActualizarPreciosContent />
    </Suspense>
  )
}
