// Ruta destino: C:\Users\Usuario\Documents\sistema-habitus-sd\src\app\(sistema)\obligaciones\page.tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ChevronDown, ChevronRight, Plus } from 'lucide-react'

interface Acreedor {
  id: number
  nombre: string
  categoria_gasto_id: number
  categoria_nombre: string
}

interface Obligacion {
  id: number
  acreedor_id: number
  concepto_gasto_id: number
  concepto_nombre: string
  tipo: 'Cargo' | 'Pago'
  monto: number
  periodo: string | null
  fecha_vencimiento: string | null
  fecha_pago: string | null
  numero_comprobante: string | null
  observaciones: string | null
  creado_en: string
}

interface Concepto { id: number; nombre: string; categoria_gasto_id: number; tipo: string }

const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]'

// Fecha "efectiva" de una obligación para ordenarla y mostrarla en el
// listado — un Pago usa su fecha real; un Cargo usa el vencimiento si lo
// tiene, si no el período, y como último recurso cuándo se cargó.
function fechaEfectiva(o: Obligacion): string {
  if (o.tipo === 'Pago') return o.fecha_pago || o.creado_en.slice(0, 10)
  return o.fecha_vencimiento || o.periodo || o.creado_en.slice(0, 10)
}

function fmtFecha(f: string) {
  return f.slice(0, 10).split('-').reverse().join('/')
}
function fmtMonto(n: number) {
  return n.toLocaleString('es-AR', { minimumFractionDigits: 2 })
}

export default function ObligacionesPage() {
  const [loading, setLoading] = useState(true)
  const [acreedores, setAcreedores] = useState<Acreedor[]>([])
  const [obligaciones, setObligaciones] = useState<Obligacion[]>([])
  const [conceptos, setConceptos] = useState<Concepto[]>([])
  const [conceptosPorAcreedor, setConceptosPorAcreedor] = useState<Map<number, number[]>>(new Map())
  const [mediosPago, setMediosPago] = useState<{ id: number; nombre: string }[]>([])
  const [expandido, setExpandido] = useState<Set<number>>(new Set())
  const [categoriasAbiertas, setCategoriasAbiertas] = useState<Set<string>>(new Set())
  const [modalCargo, setModalCargo] = useState<Acreedor | null>(null)
  const [modalPago, setModalPago] = useState<Acreedor | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [sucursalId, setSucursalId] = useState<number>(1)
  const [usuarioId, setUsuarioId] = useState<string | null>(null)
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todas')

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    setLoading(true)
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      setUsuarioId(user.id)
      const { data: usuarioData } = await supabase.from('usuarios').select('sucursal_id').eq('id', user.id).single()
      setSucursalId(usuarioData?.sucursal_id ?? 1)
    }

    const [acreedoresRes, obligacionesRes, conceptosRes, mediosRes, acreedorConceptosRes] = await Promise.all([
      supabase.from('acreedores').select('id, nombre, categoria_gasto_id, categorias_gasto ( nombre )').eq('activo', true).order('nombre'),
      supabase.from('obligaciones')
        .select('id, acreedor_id, concepto_gasto_id, tipo, monto, periodo, fecha_vencimiento, fecha_pago, numero_comprobante, observaciones, creado_en, conceptos_gasto ( nombre )')
        .eq('anulado', false),
      supabase.from('conceptos_gasto').select('id, nombre, categoria_gasto_id, tipo').order('nombre'),
      supabase.from('medios_pago').select('id, nombre').eq('activo', true).order('id'),
      supabase.from('acreedor_conceptos').select('acreedor_id, concepto_gasto_id'),
    ])

    setAcreedores((acreedoresRes.data || []).map((a: any) => ({
      id: a.id, nombre: a.nombre, categoria_gasto_id: a.categoria_gasto_id,
      categoria_nombre: a.categorias_gasto?.nombre || '',
    })))
    setObligaciones((obligacionesRes.data || []).map((o: any) => ({
      ...o, concepto_nombre: o.conceptos_gasto?.nombre || '',
    })))
    setConceptos(conceptosRes.data || [])
    setMediosPago(mediosRes.data || [])

    // Mapa acreedor_id -> [concepto_gasto_id] permitidos para ese acreedor
    // (tabla puente acreedor_conceptos — no todos los conceptos de la
    // categoría del acreedor aplican, ej. "Servicios" tiene 5 conceptos
    // pero Aguas Rionegrinas solo usa uno).
    const mapa = new Map<number, number[]>()
    for (const ac of acreedorConceptosRes.data || []) {
      const lista = mapa.get(ac.acreedor_id) || []
      lista.push(ac.concepto_gasto_id)
      mapa.set(ac.acreedor_id, lista)
    }
    setConceptosPorAcreedor(mapa)

    setLoading(false)
  }

  function toggleExpandido(id: number) {
    setExpandido(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleCategoria(cat: string) {
    setCategoriasAbiertas(prev => {
      const next = new Set(prev)
      next.has(cat) ? next.delete(cat) : next.add(cat)
      return next
    })
  }

  function obligacionesDe(acreedorId: number): Obligacion[] {
    return obligaciones
      .filter(o => o.acreedor_id === acreedorId)
      .sort((a, b) => fechaEfectiva(a).localeCompare(fechaEfectiva(b)))
  }

  function saldoDe(acreedorId: number): number {
    return obligacionesDe(acreedorId).reduce((acc, o) => acc + (o.tipo === 'Cargo' ? o.monto : -o.monto), 0)
  }

  const totalPendiente = acreedores.reduce((acc, a) => acc + saldoDe(a.id), 0)

  // Categorías presentes, en el mismo orden en que ya aparecían agrupadas
  const categorias = Array.from(new Set(acreedores.map(a => a.categoria_nombre)))

  const acreedoresFiltrados = filtroCategoria === 'todas'
    ? acreedores
    : acreedores.filter(a => a.categoria_nombre === filtroCategoria)

  // Agrupados por categoría, cada grupo ordenado alfabéticamente por nombre
  const grupos = categorias
    .filter(cat => filtroCategoria === 'todas' || cat === filtroCategoria)
    .map(cat => ({
      categoria: cat,
      acreedores: acreedoresFiltrados.filter(a => a.categoria_nombre === cat).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    }))
    .filter(g => g.acreedores.length > 0)

  if (loading) return <div className="p-6 text-sm text-gray-500">Cargando...</div>

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[#3c3c3b]">Obligaciones</h1>
        <p className="text-sm text-gray-500 mt-1">Cuenta corriente por acreedor — impuestos, sueldos, servicios y profesionales.</p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6 inline-block">
        <p className="text-xs text-gray-500">Total pendiente</p>
        <p className="text-2xl font-bold text-[#3c3c3b]">${fmtMonto(totalPendiente)}</p>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <button type="button" onClick={() => { setFiltroCategoria('todas'); setCategoriasAbiertas(new Set()) }}
          className={`px-3 py-1.5 rounded text-sm border transition-colors ${
            filtroCategoria === 'todas' ? 'bg-[#00a19a] text-white border-[#00a19a]' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
          }`}>
          Todas
        </button>
        {categorias.map(cat => (
          <button key={cat} type="button" onClick={() => { setFiltroCategoria(cat); setCategoriasAbiertas(prev => new Set(prev).add(cat)) }}
            className={`px-3 py-1.5 rounded text-sm border transition-colors ${
              filtroCategoria === cat ? 'bg-[#00a19a] text-white border-[#00a19a]' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}>
            {cat}
          </button>
        ))}
      </div>

      <div className="space-y-3">
       {grupos.map(grupo => {
        const abiertaCategoria = categoriasAbiertas.has(grupo.categoria)
        const saldoCategoria = grupo.acreedores.reduce((acc, a) => acc + saldoDe(a.id), 0)
        return (
        <div key={grupo.categoria} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <button type="button" onClick={() => toggleCategoria(grupo.categoria)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-2">
              {abiertaCategoria ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
              <span className="text-sm font-semibold text-[#3c3c3b] uppercase tracking-wide">{grupo.categoria}</span>
              <span className="text-xs text-gray-400">({grupo.acreedores.length})</span>
            </div>
            <span className={`font-semibold ${saldoCategoria > 0 ? 'text-red-600' : 'text-gray-400'}`}>
              ${fmtMonto(saldoCategoria)}
            </span>
          </button>

          {abiertaCategoria && (
          <div className="px-4 pb-4 space-y-2 border-t border-gray-100 pt-3">
          {grupo.acreedores.map(acreedor => {
          const items = obligacionesDe(acreedor.id)
          const saldo = saldoDe(acreedor.id)
          const abierto = expandido.has(acreedor.id)

          // Saldo corrido para mostrar en cada fila del detalle
          let corrido = 0
          const itemsConSaldo = items.map(o => {
            corrido += o.tipo === 'Cargo' ? o.monto : -o.monto
            return { ...o, saldoCorrido: corrido }
          })

          return (
            <div key={acreedor.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <button type="button" onClick={() => toggleExpandido(acreedor.id)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-2">
                  {abierto ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                  <span className="font-medium text-[#3c3c3b]">{acreedor.nombre}</span>
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{acreedor.categoria_nombre}</span>
                </div>
                <span className={`font-semibold ${saldo > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                  ${fmtMonto(saldo)}
                </span>
              </button>

              {abierto && (
                <div className="border-t border-gray-100 px-4 py-3">
                  <div className="flex gap-2 mb-3">
                    <button type="button" onClick={() => setModalCargo(acreedor)}
                      className="flex items-center gap-1 border border-[#00a19a] text-[#00a19a] px-3 py-1.5 rounded text-xs hover:bg-[#00a19a]/10">
                      <Plus className="w-3.5 h-3.5" /> Nuevo cargo
                    </button>
                    <button type="button" onClick={() => setModalPago(acreedor)} disabled={saldo <= 0}
                      className="flex items-center gap-1 bg-[#00a19a] text-white px-3 py-1.5 rounded text-xs hover:bg-[#008f89] disabled:opacity-40 disabled:cursor-not-allowed">
                      <Plus className="w-3.5 h-3.5" /> Registrar pago
                    </button>
                  </div>

                  {itemsConSaldo.length === 0 ? (
                    <p className="text-sm text-gray-400">Sin movimientos todavía.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-gray-500">
                          <th className="pb-1 font-medium">Fecha</th>
                          <th className="pb-1 font-medium">Concepto</th>
                          <th className="pb-1 font-medium">Comprobante</th>
                          <th className="pb-1 font-medium text-right">Cargo</th>
                          <th className="pb-1 font-medium text-right">Pago</th>
                          <th className="pb-1 font-medium text-right">Saldo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {itemsConSaldo.map(o => (
                          <tr key={o.id} className="border-t border-gray-50">
                            <td className="py-1.5 text-gray-600">{fmtFecha(fechaEfectiva(o))}</td>
                            <td className="py-1.5">{o.concepto_nombre}</td>
                            <td className="py-1.5 text-gray-400">{o.numero_comprobante || '—'}</td>
                            <td className="py-1.5 text-right">{o.tipo === 'Cargo' ? `$${fmtMonto(o.monto)}` : ''}</td>
                            <td className="py-1.5 text-right text-[#00a19a]">{o.tipo === 'Pago' ? `$${fmtMonto(o.monto)}` : ''}</td>
                            <td className="py-1.5 text-right font-medium">${fmtMonto(o.saldoCorrido)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          )
        })}
          </div>
          )}
        </div>
        )
       })}
      </div>

      {modalCargo && (
        <ModalNuevoCargo
          acreedor={modalCargo}
          conceptos={conceptos.filter(c => (conceptosPorAcreedor.get(modalCargo.id) || []).includes(c.id))}
          guardando={guardando}
          onCerrar={() => setModalCargo(null)}
          onGuardar={async (payload) => {
            setGuardando(true)
            const supabase = createClient()
            const { error } = await supabase.from('obligaciones').insert({
              acreedor_id: modalCargo.id,
              categoria_gasto_id: modalCargo.categoria_gasto_id,
              concepto_gasto_id: payload.concepto_gasto_id,
              tipo: 'Cargo',
              monto: payload.monto,
              periodo: payload.periodo ? `${payload.periodo}-01` : null,
              fecha_vencimiento: payload.fecha_vencimiento || null,
              numero_comprobante: payload.numero_comprobante || null,
              observaciones: payload.observaciones || null,
              usuario_id: usuarioId,
            })
            setGuardando(false)
            if (error) { alert('Error al guardar: ' + error.message); return }
            setModalCargo(null)
            await cargarDatos()
            setExpandido(prev => new Set(prev).add(modalCargo.id))
          }}
        />
      )}

      {modalPago && (
        <ModalRegistrarPago
          acreedor={modalPago}
          saldoPendiente={saldoDe(modalPago.id)}
          conceptos={conceptos.filter(c => (conceptosPorAcreedor.get(modalPago.id) || []).includes(c.id))}
          mediosPago={mediosPago}
          guardando={guardando}
          onCerrar={() => setModalPago(null)}
          onGuardar={async (payload) => {
            setGuardando(true)
            const supabase = createClient()
            const fechaPago = payload.fecha_pago
            const mesContable = fechaPago.slice(0, 7) + '-01'

            const { data: cierreActivo } = await supabase
              .from('cierres_turno').select('id')
              .eq('sucursal_id', sucursalId).eq('estado_cierre_turno_id', 1).maybeSingle()

            const { data: mov, error: movError } = await supabase.from('movimientos').insert({
              sucursal_id: sucursalId,
              tipo: 'Egreso',
              categoria_gasto_id: modalPago.categoria_gasto_id,
              concepto_gasto_id: payload.concepto_gasto_id,
              monto: payload.monto,
              medio_pago_id: payload.medio_pago_id,
              fecha_utc: fechaPago,
              mes_contable: mesContable,
              observaciones: payload.observaciones || `Pago a ${modalPago.nombre}`,
              usuario_id: usuarioId,
              cierre_turno_id: cierreActivo?.id || null,
              origen_tipo: null,
              anulado: false,
            }).select('id').single()

            if (movError || !mov) { setGuardando(false); alert('Error al generar el movimiento: ' + movError?.message); return }

            const { error: oblError } = await supabase.from('obligaciones').insert({
              acreedor_id: modalPago.id,
              categoria_gasto_id: modalPago.categoria_gasto_id,
              concepto_gasto_id: payload.concepto_gasto_id,
              tipo: 'Pago',
              monto: payload.monto,
              fecha_pago: fechaPago,
              medio_pago_id: payload.medio_pago_id,
              movimiento_id: mov.id,
              observaciones: payload.observaciones || null,
              usuario_id: usuarioId,
            })

            setGuardando(false)
            if (oblError) { alert('El pago se registró en Movimientos pero falló al enlazarlo acá: ' + oblError.message); return }
            setModalPago(null)
            await cargarDatos()
            setExpandido(prev => new Set(prev).add(modalPago.id))
          }}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────

interface ModalNuevoCargoProps {
  acreedor: Acreedor
  conceptos: Concepto[]
  guardando: boolean
  onCerrar: () => void
  onGuardar: (payload: {
    concepto_gasto_id: number; monto: number; periodo: string; fecha_vencimiento: string;
    numero_comprobante: string; observaciones: string
  }) => void
}

function ModalNuevoCargo({ acreedor, conceptos, guardando, onCerrar, onGuardar }: ModalNuevoCargoProps) {
  const [conceptoId, setConceptoId] = useState<number | ''>(() => conceptos.length === 1 ? conceptos[0].id : '')
  const [monto, setMonto] = useState(0)
  const [montoTexto, setMontoTexto] = useState<string | null>(null)
  const [periodo, setPeriodo] = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).slice(0, 7))
  const [vencimiento, setVencimiento] = useState('')
  const [comprobante, setComprobante] = useState('')
  const [obs, setObs] = useState('')

  function parsearMonto(v: string): number {
    const s = v.trim()
    if (!s) return 0
    const n = parseFloat(s.replace(/\./g, '').replace(',', '.'))
    return isNaN(n) ? 0 : n
  }
  function fmtInput(n: number): string {
    return n ? n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''
  }
  function handleMontoChange(raw: string) {
    setMontoTexto(raw)
    setMonto(parsearMonto(raw))
  }

  function guardar() {
    if (!conceptoId) { alert('Elegí un concepto'); return }
    if (monto <= 0) { alert('El monto debe ser mayor a 0'); return }
    onGuardar({ concepto_gasto_id: Number(conceptoId), monto, periodo, fecha_vencimiento: vencimiento, numero_comprobante: comprobante, observaciones: obs })
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg border border-gray-200 w-full max-w-md">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-[#3c3c3b]">Nuevo cargo — {acreedor.nombre}</h2>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Concepto</label>
            <select value={conceptoId} onChange={e => setConceptoId(e.target.value ? Number(e.target.value) : '')} className={inputClass}>
              <option value="">Seleccionar concepto</option>
              {conceptos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Monto</label>
            <input type="text" inputMode="decimal" value={montoTexto !== null ? montoTexto : fmtInput(monto)}
              onFocus={e => e.target.select()} onChange={e => handleMontoChange(e.target.value)} onBlur={() => setMontoTexto(null)}
              placeholder="0" className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Período</label>
              <input type="month" value={periodo} onChange={e => setPeriodo(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Vencimiento</label>
              <input type="date" value={vencimiento} onChange={e => setVencimiento(e.target.value)} className={inputClass} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Nº comprobante (opcional)</label>
            <input type="text" value={comprobante} onChange={e => setComprobante(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Observaciones</label>
            <textarea value={obs} onChange={e => setObs(e.target.value)} rows={2} className={inputClass} />
          </div>
        </div>
        <div className="flex justify-end gap-2 p-4 border-t border-gray-200">
          <button type="button" onClick={onCerrar} className="px-4 py-2 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50">Cancelar</button>
          <button type="button" onClick={guardar} disabled={guardando}
            className="px-4 py-2 bg-[#00a19a] text-white rounded text-sm hover:bg-[#008f89] disabled:opacity-50">
            {guardando ? 'Guardando...' : 'Guardar cargo'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────

interface ModalRegistrarPagoProps {
  acreedor: Acreedor
  saldoPendiente: number
  conceptos: Concepto[]
  mediosPago: { id: number; nombre: string }[]
  guardando: boolean
  onCerrar: () => void
  onGuardar: (payload: {
    concepto_gasto_id: number; monto: number; fecha_pago: string; medio_pago_id: number; observaciones: string
  }) => void
}

function ModalRegistrarPago({ acreedor, saldoPendiente, conceptos, mediosPago, guardando, onCerrar, onGuardar }: ModalRegistrarPagoProps) {
  const [conceptoId, setConceptoId] = useState<number | ''>(() => conceptos.length === 1 ? conceptos[0].id : '')
  const [monto, setMonto] = useState(saldoPendiente)
  const [montoTexto, setMontoTexto] = useState<string | null>(null)
  const [fecha, setFecha] = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }))
  const [medioPagoId, setMedioPagoId] = useState<number | ''>('')
  const [obs, setObs] = useState('')

  function parsearMonto(v: string): number {
    const s = v.trim()
    if (!s) return 0
    const n = parseFloat(s.replace(/\./g, '').replace(',', '.'))
    return isNaN(n) ? 0 : n
  }
  function fmtInput(n: number): string {
    return n ? n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''
  }
  function handleMontoChange(raw: string) {
    setMontoTexto(raw)
    setMonto(parsearMonto(raw))
  }

  function guardar() {
    if (!conceptoId) { alert('Elegí un concepto'); return }
    if (!medioPagoId) { alert('Elegí un medio de pago'); return }
    if (monto <= 0) { alert('El monto debe ser mayor a 0'); return }
    onGuardar({ concepto_gasto_id: Number(conceptoId), monto, fecha_pago: fecha, medio_pago_id: Number(medioPagoId), observaciones: obs })
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg border border-gray-200 w-full max-w-md">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-[#3c3c3b]">Registrar pago — {acreedor.nombre}</h2>
          <p className="text-xs text-gray-500 mt-1">Saldo pendiente: ${fmtMonto(saldoPendiente)} — podés pagar total o parcial.</p>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Concepto</label>
            <select value={conceptoId} onChange={e => setConceptoId(e.target.value ? Number(e.target.value) : '')} className={inputClass}>
              <option value="">Seleccionar concepto</option>
              {conceptos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Monto a pagar</label>
            <input type="text" inputMode="decimal" value={montoTexto !== null ? montoTexto : fmtInput(monto)}
              onFocus={e => e.target.select()} onChange={e => handleMontoChange(e.target.value)} onBlur={() => setMontoTexto(null)}
              className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Fecha de pago</label>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Medio de pago</label>
              <select value={medioPagoId} onChange={e => setMedioPagoId(e.target.value ? Number(e.target.value) : '')} className={inputClass}>
                <option value="">Seleccionar</option>
                {mediosPago.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Observaciones</label>
            <textarea value={obs} onChange={e => setObs(e.target.value)} rows={2} className={inputClass} />
          </div>
        </div>
        <div className="flex justify-end gap-2 p-4 border-t border-gray-200">
          <button type="button" onClick={onCerrar} className="px-4 py-2 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50">Cancelar</button>
          <button type="button" onClick={guardar} disabled={guardando}
            className="px-4 py-2 bg-[#00a19a] text-white rounded text-sm hover:bg-[#008f89] disabled:opacity-50">
            {guardando ? 'Guardando...' : 'Registrar pago'}
          </button>
        </div>
      </div>
    </div>
  )
}
