// Ruta destino: C:\Users\Usuario\Documents\sistema-habitus-sd\src\app\(sistema)\mayoristas\nueva\page.tsx
//
// Alta de venta mayorista. El precio se calcula solo (costo × (1 + recargo%)),
// pero costo y % son editables por línea. No baja stock salvo que se marque
// "Entregar ahora" (el stock baja al entregar, no al guardar). No fiscaliza.
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Trash2, Search, ChevronLeft } from 'lucide-react'
import { FECHA_MIN, fechaMax, fechaFueraDeRango } from '@/lib/fechaLimites'

interface ClienteMay { id: number; nombre: string; recargo_mayorista_pct: number }
interface ArticuloOpt { id: number; nombre: string; costo_sin_iva: number | null }
interface OcOpt { id: number; fecha_orden: string; total: number; proveedores: { nombre_comercial: string } | null }
interface OcInfo { flete: number; subtotal: number }
interface Linea { key: number; articulo_id: number; nombre: string; cantidad: string; costo: string; pct: string }

const fmt = (n: number) => '$' + Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const hoyAR = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
const num = (s: string) => { const n = Number(String(s).replace(',', '.')); return Number.isFinite(n) ? n : NaN }
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

// Misma búsqueda que el resto del sistema: tokenizada, sin acentos ni mayúsculas
const normalizar = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

export default function NuevaVentaMayoristaPage() {
  const router = useRouter()

  const [clientes, setClientes] = useState<ClienteMay[]>([])
  const [articulos, setArticulos] = useState<ArticuloOpt[]>([])
  const [ocs, setOcs] = useState<OcOpt[]>([])
  const [medioTransferenciaId, setMedioTransferenciaId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [clienteId, setClienteId] = useState('')
  const [fecha, setFecha] = useState(hoyAR())
  const [errFecha, setErrFecha] = useState(false)
  const [ocId, setOcId] = useState('')
  const [ocInfo, setOcInfo] = useState<OcInfo | null>(null)
  const [cargandoOc, setCargandoOc] = useState(false)
  const [flete, setFlete] = useState('')
  const [obs, setObs] = useState('')
  const [lineas, setLineas] = useState<Linea[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [entregarAhora, setEntregarAhora] = useState(false)
  const [registrarCobro, setRegistrarCobro] = useState(false)
  const [cobroMonto, setCobroMonto] = useState('')
  const [cobroFecha, setCobroFecha] = useState(hoyAR())

  const [guardando, setGuardando] = useState(false)
  const [msgError, setMsgError] = useState<string | null>(null)
  const [ventaCreadaId, setVentaCreadaId] = useState<number | null>(null)

  useEffect(() => {
    async function cargar() {
      const supabase = createClient()
      const [c, a, o, m] = await Promise.all([
        supabase.from('clientes').select('id, nombre, recargo_mayorista_pct')
          .eq('activo', true).not('recargo_mayorista_pct', 'is', null).order('nombre'),
        supabase.from('articulos').select('id, nombre, costo_sin_iva').order('nombre').limit(3000),
        supabase.from('ordenes_compra').select('id, fecha_orden, total, proveedores(nombre_comercial)')
          .order('id', { ascending: false }).limit(40),
        supabase.from('medios_pago').select('id, nombre').eq('nombre', 'Transferencia').maybeSingle(),
      ])
      if (c.error || a.error) { setError((c.error || a.error)!.message); setLoading(false); return }
      setClientes((c.data || []) as ClienteMay[])
      setArticulos((a.data || []) as ArticuloOpt[])
      setOcs((o.data || []) as unknown as OcOpt[])
      setMedioTransferenciaId(m.data?.id ?? null)
      setLoading(false)
    }
    cargar()
  }, [])

  const cliente = clientes.find(c => String(c.id) === clienteId) || null

  const resultados = useMemo(() => {
    const tokens = normalizar(busqueda.trim()).split(/\s+/).filter(Boolean)
    if (tokens.length === 0) return []
    const yaAgregados = new Set(lineas.map(l => l.articulo_id))
    return articulos
      .filter(a => !yaAgregados.has(a.id))
      .filter(a => { const n = normalizar(a.nombre); return tokens.every(t => n.includes(t)) })
      .slice(0, 8)
  }, [busqueda, articulos, lineas])

  function agregar(a: ArticuloOpt) {
    const costo = a.costo_sin_iva != null ? String(Number(Number(a.costo_sin_iva).toFixed(4))) : '0'
    setLineas(prev => [...prev, {
      key: Date.now() + a.id,
      articulo_id: a.id,
      nombre: a.nombre,
      cantidad: '1',
      costo,
      pct: String(cliente ? cliente.recargo_mayorista_pct : 0),
    }])
    setBusqueda('')
  }

  // Trae las líneas de la OC elegida (precio de proveedor sin IVA y sin flete).
  // El usuario después borra las líneas que no van y ajusta cantidades.
  async function cargarItemsDeOc() {
    if (!ocId) return
    if (lineas.length > 0 && !window.confirm('Esto reemplaza los artículos ya cargados. ¿Continuar?')) return
    setCargandoOc(true)
    setMsgError(null)
    const supabase = createClient()
    const { data, error: err } = await supabase
      .from('ordenes_compra')
      .select('id, flete_monto, subtotal, orden_compra_items(articulo_id, cantidad_facturada, precio_unitario_con_iva, precio_unitario_sin_iva, es_ajuste_redondeo, articulos(nombre))')
      .eq('id', Number(ocId))
      .maybeSingle()
    setCargandoOc(false)
    if (err || !data) { setMsgError('No se pudo leer la OC: ' + (err?.message || 'no existe')); return }

    const pct = String(cliente ? cliente.recargo_mayorista_pct : 0)
    const filas = ((data as any).orden_compra_items || []) as {
      articulo_id: number | null
      cantidad_facturada: number
      precio_unitario_con_iva: number | null
      precio_unitario_sin_iva: number
      es_ajuste_redondeo: boolean
      articulos: { nombre: string } | null
    }[]
    const nuevas: Linea[] = filas
      .filter(f => f.articulo_id != null && !f.es_ajuste_redondeo)
      .map((f, i) => ({
        key: Date.now() * 1000 + i,
        articulo_id: Number(f.articulo_id),
        nombre: f.articulos?.nombre || `Artículo #${f.articulo_id}`,
        cantidad: String(Number(f.cantidad_facturada)),
        // Precio que figura en la OC (c/IVA, sin flete): lo que efectivamente se pagó por unidad
        costo: String(Number(Number(f.precio_unitario_con_iva ?? f.precio_unitario_sin_iva ?? 0).toFixed(4))),
        pct,
      }))
    if (nuevas.length === 0) { setMsgError('La OC no tiene artículos para cargar.'); return }
    setLineas(nuevas)
    setOcInfo({ flete: Number((data as any).flete_monto || 0), subtotal: Number((data as any).subtotal || 0) })
  }

  function actualizar(key: number, campo: 'cantidad' | 'costo' | 'pct', valor: string) {
    setLineas(prev => prev.map(l => (l.key === key ? { ...l, [campo]: valor } : l)))
  }

  const calculo = lineas.map(l => {
    const cant = num(l.cantidad), costo = num(l.costo), pct = num(l.pct)
    const precio = r2(costo * (1 + pct / 100))
    const sub = r2(cant * precio)
    return { precio, sub, ok: cant > 0 && costo >= 0 && pct >= 0 && Number.isFinite(precio) && Number.isFinite(sub) }
  })
  const productos = r2(calculo.reduce((s, c) => s + (c.ok ? c.sub : 0), 0))
  const costoTotal = lineas.reduce((s, l, i) => s + (calculo[i].ok ? num(l.cantidad) * num(l.costo) : 0), 0)
  // El flete se cobra aparte y sin recargo: suma al total pero no es ganancia.
  const fleteNum = flete.trim() === '' ? 0 : num(flete)
  const fleteOk = Number.isFinite(fleteNum) && fleteNum >= 0
  const total = r2(productos + (fleteOk ? fleteNum : 0))
  const ganancia = r2(productos - costoTotal)
  // Orientativo: flete de la OC proporcional al costo de los artículos que se le cargan
  const fleteSugerido = ocInfo && ocInfo.flete > 0 && ocInfo.subtotal > 0 ? r2((ocInfo.flete * costoTotal) / ocInfo.subtotal) : null

  async function guardar() {
    setMsgError(null)
    if (!clienteId) { setMsgError('Elegí un cliente.'); return }
    if (!fecha || fechaFueraDeRango(fecha)) { setMsgError('La fecha está fuera de rango.'); return }
    if (lineas.length === 0) { setMsgError('Agregá al menos un artículo.'); return }
    if (!fleteOk) { setMsgError('El flete es inválido (usá 0 o un número positivo).'); return }
    if (calculo.some(c => !c.ok)) { setMsgError('Revisá cantidades, costos y % de recargo: hay valores inválidos.'); return }
    let montoCobro = 0
    if (registrarCobro) {
      montoCobro = num(cobroMonto)
      if (!(montoCobro > 0)) { setMsgError('El monto del cobro es inválido.'); return }
      if (!cobroFecha || fechaFueraDeRango(cobroFecha)) { setMsgError('La fecha del cobro está fuera de rango.'); return }
      if (medioTransferenciaId == null) { setMsgError('No se encontró el medio de pago "Transferencia".'); return }
    }

    setGuardando(true)
    const supabase = createClient()
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')
      const { data: usuario } = await supabase.from('usuarios').select('sucursal_id').eq('id', user.id).single()
      if (!usuario) throw new Error('Usuario no encontrado')

      const items = lineas.map(l => ({
        articulo_id: l.articulo_id,
        cantidad: num(l.cantidad),
        costo_unitario: num(l.costo),
        recargo_pct: num(l.pct),
      }))

      const { data: ventaId, error: errVenta } = await supabase.rpc('registrar_venta_mayorista', {
        p_cliente_id: Number(clienteId),
        p_fecha: fecha,
        p_orden_compra_id: ocId ? Number(ocId) : null,
        p_observaciones: obs.trim() || null,
        p_items: items,
        p_sucursal_id: usuario.sucursal_id,
        p_entregar_ahora: entregarAhora,
        p_flete: fleteOk ? r2(fleteNum) : 0,
      })
      if (errVenta) throw new Error(errVenta.message)
      const id = Number(ventaId)
      setVentaCreadaId(id)

      if (registrarCobro) {
        // Si el cobro es por el total mostrado, se usa el total exacto guardado
        // en la base (evita diferencias de centavos por redondeo).
        const { data: v } = await supabase.from('ventas_mayoristas').select('total').eq('id', id).single()
        let monto = montoCobro
        if (v && Math.abs(montoCobro - total) < 0.011) monto = Number(v.total)
        const { error: errCobro } = await supabase.rpc('registrar_cobro_mayorista', {
          p_venta_id: id,
          p_monto: monto,
          p_fecha: cobroFecha,
          p_medio_pago_id: medioTransferenciaId,
          p_observaciones: null,
        })
        if (errCobro) {
          setMsgError(`La venta #${id} se guardó, pero el cobro falló: ${errCobro.message}. Registralo desde el detalle del pedido.`)
          setGuardando(false)
          return
        }
      }
      router.push(`/mayoristas/${id}`)
    } catch (e: any) {
      setMsgError('No se pudo guardar: ' + e.message)
      setGuardando(false)
    }
  }

  if (loading) return <p className="text-sm text-gray-500">Cargando...</p>
  if (error) return <p className="text-red-500 text-sm">Error: {error}</p>

  const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]'

  return (
    <div className="max-w-5xl">
      <Link href="/mayoristas" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-[#3c3c3b] mb-3">
        <ChevronLeft className="w-4 h-4" /> Volver a Mayoristas
      </Link>
      <h1 className="text-xl font-semibold text-[#3c3c3b] mb-6">Nueva venta mayorista</h1>

      {msgError && (
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-4 py-3 mb-4 text-sm flex items-center justify-between gap-3">
          <span>{msgError}</span>
          {ventaCreadaId && (
            <Link href={`/mayoristas/${ventaCreadaId}`} className="underline font-medium whitespace-nowrap">Ir al pedido #{ventaCreadaId}</Link>
          )}
        </div>
      )}

      {/* Datos generales */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Cliente mayorista</label>
          <select value={clienteId} onChange={e => setClienteId(e.target.value)} className={inputCls}>
            <option value="">Elegir...</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre} ({c.recargo_mayorista_pct}%)</option>)}
          </select>
          {clientes.length === 0 && (
            <p className="text-xs text-amber-700 mt-1">No hay clientes con recargo mayorista cargado.</p>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Fecha</label>
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
            min={FECHA_MIN} max={fechaMax()}
            onBlur={e => { if (fechaFueraDeRango(e.target.value)) { setFecha(hoyAR()); setErrFecha(true) } else setErrFecha(false) }}
            className={`${inputCls} ${errFecha ? 'border-red-400' : ''}`} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">OC de origen (opcional)</label>
          <select value={ocId} onChange={e => { setOcId(e.target.value); setOcInfo(null) }} className={inputCls}>
            <option value="">Sin vincular</option>
            {ocs.map(o => (
              <option key={o.id} value={o.id}>
                #{o.id} — {o.proveedores?.nombre_comercial || 'Sin proveedor'} — {o.fecha_orden.slice(0, 10).split('-').reverse().join('/')} — {fmt(o.total)}
              </option>
            ))}
          </select>
          {ocId && (
            <button type="button" onClick={cargarItemsDeOc} disabled={cargandoOc}
              className="mt-2 text-xs text-[#00a19a] hover:underline disabled:opacity-50">
              {cargandoOc ? 'Cargando...' : 'Cargar artículos de esta OC'}
            </button>
          )}
        </div>
        <div className="md:col-span-3">
          <label className="block text-xs font-medium text-gray-600 mb-1">Observaciones</label>
          <input type="text" value={obs} onChange={e => setObs(e.target.value)} className={inputCls} placeholder="Opcional" />
        </div>
      </div>

      {/* Artículos */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Artículos</h2>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar artículo por nombre..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]" />
          {resultados.length > 0 && (
            <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
              {resultados.map(a => (
                <button key={a.id} type="button" onClick={() => agregar(a)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between gap-3">
                  <span className="text-gray-800">{a.nombre}</span>
                  <span className="text-xs text-gray-400 whitespace-nowrap">costo {fmt(a.costo_sin_iva ?? 0)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {lineas.length === 0 ? (
          <p className="text-sm text-gray-500">Buscá y elegí los artículos, o elegí una OC arriba y cargá sus artículos para después borrar lo que no va y ajustar cantidades. El costo se precarga y se puede editar.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200">
                <tr>
                  <th className="text-left py-2 pr-2 text-xs text-gray-600 font-semibold">Artículo</th>
                  <th className="text-right py-2 px-2 text-xs text-gray-600 font-semibold w-24">Cantidad</th>
                  <th className="text-right py-2 px-2 text-xs text-gray-600 font-semibold w-32">Costo unit.</th>
                  <th className="text-right py-2 px-2 text-xs text-gray-600 font-semibold w-20">Recargo %</th>
                  <th className="text-right py-2 px-2 text-xs text-gray-600 font-semibold w-28">Precio unit.</th>
                  <th className="text-right py-2 px-2 text-xs text-gray-600 font-semibold w-32">Subtotal</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lineas.map((l, i) => (
                  <tr key={l.key}>
                    <td className="py-2 pr-2 text-gray-800">{l.nombre}</td>
                    <td className="py-2 px-2">
                      <input type="text" inputMode="decimal" value={l.cantidad} onChange={e => actualizar(l.key, 'cantidad', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-[#00a19a]" />
                    </td>
                    <td className="py-2 px-2">
                      <input type="text" inputMode="decimal" value={l.costo} onChange={e => actualizar(l.key, 'costo', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-[#00a19a]" />
                    </td>
                    <td className="py-2 px-2">
                      <input type="text" inputMode="decimal" value={l.pct} onChange={e => actualizar(l.key, 'pct', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-[#00a19a]" />
                    </td>
                    <td className="py-2 px-2 text-right text-gray-700">{calculo[i].ok ? fmt(calculo[i].precio) : '—'}</td>
                    <td className="py-2 px-2 text-right font-medium">{calculo[i].ok ? fmt(calculo[i].sub) : <span className="text-red-500 text-xs">revisar</span>}</td>
                    <td className="py-2 pl-2">
                      <button type="button" onClick={() => setLineas(prev => prev.filter(x => x.key !== l.key))}
                        className="text-gray-400 hover:text-red-500" title="Quitar">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {lineas.length > 0 && (
          <div className="mt-4 flex flex-col items-end gap-1 text-sm">
            <div className="w-full max-w-xs mb-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Flete a cargar al cliente (sin recargo)</label>
              <input type="text" inputMode="decimal" value={flete} onChange={e => setFlete(e.target.value)}
                placeholder="0"
                className={`w-full px-3 py-2 border rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-[#00a19a] ${fleteOk ? 'border-gray-300' : 'border-red-400'}`} />
              {fleteSugerido != null && (
                <p className="text-xs text-gray-500 mt-1 text-right">
                  Flete de la OC: {fmt(ocInfo!.flete)}. Proporcional a estos artículos: {fmt(fleteSugerido)}{' '}
                  <button type="button" onClick={() => setFlete(String(fleteSugerido))} className="text-[#00a19a] hover:underline">usar</button>
                </p>
              )}
              <p className="text-xs text-gray-400 mt-1 text-right">Dejalo vacío si él paga el flete por su cuenta.</p>
            </div>
            <p className="text-gray-500">Costo: <span className="text-gray-700">{fmt(costoTotal)}</span></p>
            <p className="text-gray-500">Ganancia: <span className="text-[#00a19a] font-medium">{fmt(ganancia)}</span></p>
            <p className="text-gray-500">Artículos: <span className="text-gray-700">{fmt(productos)}</span></p>
            {fleteOk && fleteNum > 0 && <p className="text-gray-500">Flete: <span className="text-gray-700">{fmt(fleteNum)}</span></p>}
            <p className="text-base font-semibold text-[#3c3c3b]">Total: {fmt(total)}</p>
          </div>
        )}
      </div>

      {/* Entrega y cobro */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6 space-y-4">
        <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
          <input type="checkbox" checked={entregarAhora} onChange={e => setEntregarAhora(e.target.checked)}
            className="mt-0.5 rounded border-gray-300 text-[#00a19a] focus:ring-[#00a19a]" />
          <span>
            Entregar ahora
            <span className="block text-xs text-gray-500">Descuenta el stock en este momento. Si lo dejás sin marcar, el pedido queda pendiente de entrega y el stock baja cuando lo entregues.</span>
          </span>
        </label>

        <div>
          <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={registrarCobro}
              onChange={e => { setRegistrarCobro(e.target.checked); if (e.target.checked && !cobroMonto) setCobroMonto(total > 0 ? String(total) : '') }}
              className="mt-0.5 rounded border-gray-300 text-[#00a19a] focus:ring-[#00a19a]" />
            <span>
              Registrar el cobro ahora (por transferencia)
              <span className="block text-xs text-gray-500">Genera el ingreso en Movimientos con la fecha del cobro.</span>
            </span>
          </label>
          {registrarCobro && (
            <div className="grid grid-cols-2 gap-3 mt-3 max-w-md">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Monto cobrado</label>
                <input type="text" inputMode="decimal" value={cobroMonto} onChange={e => setCobroMonto(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Fecha del cobro</label>
                <input type="date" value={cobroFecha} onChange={e => setCobroFecha(e.target.value)}
                  min={FECHA_MIN} max={fechaMax()} className={inputCls} />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button type="button" onClick={guardar} disabled={guardando || ventaCreadaId !== null}
          className="bg-[#00a19a] text-white px-5 py-2 rounded text-sm hover:bg-[#008f89] disabled:opacity-50 transition-colors">
          {guardando ? 'Guardando...' : 'Guardar venta mayorista'}
        </button>
        <Link href="/mayoristas" className="text-sm text-gray-500 hover:text-[#3c3c3b]">Cancelar</Link>
      </div>
    </div>
  )
}
