'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Search, Trash2, AlertTriangle, Save, FileDown, ShoppingCart } from 'lucide-react'

interface Cliente {
  id: number
  nombre: string
}

interface Articulo {
  id: number
  nombre: string
  precio_local: number
}

interface ItemForm {
  articulo_id: number
  nombre: string
  cantidad: number
  precio_unitario: number
}

interface ItemInicial {
  articulo_id: number
  nombre: string
  cantidad: number
  precio_unitario: number
}

interface Props {
  presupuestoId?: number
  numero?: number
  estadoInicial?: string
  clienteIdInicial?: number
  clienteNombreInicial?: string
  fechaInicial?: string
  validezInicial?: string
  formaPagoInicial?: string
  observacionesInicial?: string
  itemsIniciales?: ItemInicial[]
  ventaBorradorIdInicial?: number | null
}

const ESTADOS_EDITABLES = ['Borrador', 'Enviado']

export default function PresupuestoForm({
  presupuestoId,
  numero,
  estadoInicial = 'Borrador',
  clienteIdInicial,
  clienteNombreInicial,
  fechaInicial,
  validezInicial,
  formaPagoInicial,
  observacionesInicial,
  itemsIniciales,
  ventaBorradorIdInicial,
}: Props) {
  const supabase = createClient()
  const router = useRouter()

  const [estado, setEstado] = useState(estadoInicial)
  const editable = ESTADOS_EDITABLES.includes(estado)
  const [ventaBorradorId, setVentaBorradorId] = useState<number | null>(ventaBorradorIdInicial ?? null)
  const [enviandoABorrador, setEnviandoABorrador] = useState(false)

  const [clientes, setClientes] = useState<Cliente[]>([])
  const [clienteId, setClienteId] = useState<number | null>(clienteIdInicial ?? null)
  const [busquedaCliente, setBusquedaCliente] = useState(clienteNombreInicial ?? '')
  const [dropdownClienteAbierto, setDropdownClienteAbierto] = useState(false)

  const [articulos, setArticulos] = useState<Articulo[]>([])
  const [stockMap, setStockMap] = useState<Map<number, number>>(new Map())
  const [pendienteOcMap, setPendienteOcMap] = useState<Map<number, number>>(new Map())
  const [busquedaArticulo, setBusquedaArticulo] = useState('')
  const [dropdownArticuloAbierto, setDropdownArticuloAbierto] = useState(false)
  const [indiceResaltado, setIndiceResaltado] = useState(0)

  const [items, setItems] = useState<ItemForm[]>(
    (itemsIniciales || []).map(i => ({ articulo_id: i.articulo_id, nombre: i.nombre, cantidad: i.cantidad, precio_unitario: i.precio_unitario }))
  )

  const [fecha, setFecha] = useState(fechaInicial || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }))
  const [validezHasta, setValidezHasta] = useState(validezInicial || '')
  const [formaPago, setFormaPago] = useState(formaPagoInicial || 'Efectivo o transferencia')
  const [observaciones, setObservaciones] = useState(observacionesInicial || '')

  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { cargarCatalogo() }, [])

  async function cargarCatalogo() {
    const { data: clientesData } = await supabase.from('clientes').select('id, nombre').eq('activo', true).order('nombre')
    setClientes(clientesData || [])

    const { data: articulosData } = await supabase.from('articulos').select('id, nombre, precio_local').eq('activo', true).order('nombre')
    setArticulos(articulosData || [])

    const { data: stockData } = await supabase.from('articulo_stock').select('articulo_id, stock_actual').eq('sucursal_id', 1)
    setStockMap(new Map((stockData || []).map(s => [s.articulo_id, s.stock_actual])))
  }

  // Cantidad ya pedida en OC en Borrador, solo para los artículos que están
  // en este presupuesto (mismo espíritu que Sugerencia de Compra).
  useEffect(() => {
    async function cargarPendienteOc() {
      const articuloIds = items.map(i => i.articulo_id)
      if (articuloIds.length === 0) { setPendienteOcMap(new Map()); return }

      const { data: ordenesData } = await supabase
        .from('ordenes_compra')
        .select('id')
        .eq('estado_orden_compra_id', 1)

      const ordenIds = (ordenesData || []).map(o => o.id)
      if (ordenIds.length === 0) { setPendienteOcMap(new Map()); return }

      const { data: itemsOcData } = await supabase
        .from('orden_compra_items')
        .select('articulo_id, cantidad_facturada, orden_compra_id')
        .in('orden_compra_id', ordenIds)
        .in('articulo_id', articuloIds)

      const map = new Map<number, number>()
      ;(itemsOcData || []).forEach(it => {
        if (!it.articulo_id) return
        map.set(it.articulo_id, (map.get(it.articulo_id) || 0) + it.cantidad_facturada)
      })
      setPendienteOcMap(map)
    }
    cargarPendienteOc()
  }, [items.map(i => i.articulo_id).join(',')])

  const clientesFiltrados = useMemo(() => {
    if (!busquedaCliente.trim()) return clientes.slice(0, 15)
    const q = busquedaCliente.trim().toLowerCase()
    return clientes.filter(c => c.nombre.toLowerCase().includes(q)).slice(0, 15)
  }, [clientes, busquedaCliente])

  const articulosFiltrados = useMemo(() => {
    if (!busquedaArticulo.trim()) return []
    const palabras = busquedaArticulo.trim().toLowerCase().split(/\s+/)
    const yaAgregados = new Set(items.map(i => i.articulo_id))
    return articulos
      .filter(a => !yaAgregados.has(a.id))
      .filter(a => {
        const nombre = a.nombre.toLowerCase()
        return palabras.every(p => nombre.includes(p))
      })
      .slice(0, 15)
  }, [articulos, busquedaArticulo, items])

  useEffect(() => { setIndiceResaltado(0) }, [busquedaArticulo])

  function elegirCliente(c: Cliente) {
    setClienteId(c.id)
    setBusquedaCliente(c.nombre)
    setDropdownClienteAbierto(false)
  }

  function agregarArticulo(a: Articulo) {
    setItems(prev => [...prev, { articulo_id: a.id, nombre: a.nombre, cantidad: 1, precio_unitario: a.precio_local }])
    setBusquedaArticulo('')
    setDropdownArticuloAbierto(false)
  }

  function actualizarItem(index: number, campo: 'cantidad' | 'precio_unitario', valor: number) {
    setItems(prev => {
      const nuevo = [...prev]
      nuevo[index] = { ...nuevo[index], [campo]: valor }
      return nuevo
    })
  }

  function eliminarItem(index: number) {
    setItems(prev => prev.filter((_, i) => i !== index))
  }

  const subtotal = items.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0)

  const faltantes = useMemo(() => {
    return items.map(i => {
      const stock = stockMap.get(i.articulo_id) || 0
      const pendienteOc = pendienteOcMap.get(i.articulo_id) || 0
      const faltante = Math.max(0, i.cantidad - stock - pendienteOc)
      return { articulo_id: i.articulo_id, nombre: i.nombre, faltante, stock, pendienteOc }
    }).filter(f => f.faltante > 0)
  }, [items, stockMap, pendienteOcMap])

  async function guardar(nuevoEstado?: string) {
    if (!clienteId) { setError('Elegí un cliente'); return }
    if (items.length === 0) { setError('Agregá al menos un artículo'); return }

    setGuardando(true)
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')

      const estadoFinal = nuevoEstado || estado

      let idPresupuesto = presupuestoId

      if (!idPresupuesto) {
        const { data: numeracion, error: numError } = await supabase.rpc('incrementar_numero_presupuesto')
        if (numError) throw numError

        const { data: nuevoPresupuesto, error: insertError } = await supabase
          .from('presupuestos')
          .insert({
            numero: numeracion,
            cliente_id: clienteId,
            estado: estadoFinal,
            fecha,
            validez_hasta: validezHasta || null,
            forma_pago: formaPago || null,
            observaciones: observaciones || null,
            subtotal,
            total: subtotal,
            usuario_id: user.id,
          })
          .select('id')
          .single()

        if (insertError) throw insertError
        idPresupuesto = nuevoPresupuesto.id
      } else {
        const { error: updateError } = await supabase
          .from('presupuestos')
          .update({
            cliente_id: clienteId,
            estado: estadoFinal,
            fecha,
            validez_hasta: validezHasta || null,
            forma_pago: formaPago || null,
            observaciones: observaciones || null,
            subtotal,
            total: subtotal,
          })
          .eq('id', idPresupuesto)

        if (updateError) throw updateError

        // Reemplazo completo de ítems — seguro mientras el presupuesto no
        // está Aprobado/Convertido (nunca tocó stock ni movimientos reales).
        const { error: deleteError } = await supabase.from('presupuesto_items').delete().eq('presupuesto_id', idPresupuesto)
        if (deleteError) throw deleteError
      }

      const { error: itemsError } = await supabase
        .from('presupuesto_items')
        .insert(items.map(i => ({
          presupuesto_id: idPresupuesto,
          articulo_id: i.articulo_id,
          cantidad: i.cantidad,
          precio_unitario: i.precio_unitario,
          subtotal: i.cantidad * i.precio_unitario,
        })))

      if (itemsError) throw itemsError

      router.push(`/presupuestos/${idPresupuesto}`)
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : JSON.stringify(err))
    } finally {
      setGuardando(false)
    }
  }

  const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-AR')
  const fmtFechaPdf = (f: string) => f ? f.split('-').reverse().join('/') : ''

  async function generarPDF() {
    if (!clienteId || items.length === 0) { setError('Elegí un cliente y agregá al menos un artículo antes de generar el PDF'); return }
    setError(null)
    try {
      const { jsPDF } = await import('jspdf')
      const autoTableModule = await import('jspdf-autotable')
      const autoTable = autoTableModule.default

      const doc = new jsPDF()

      // Encabezado con color de marca
      doc.setFillColor(0, 161, 154)
      doc.rect(0, 0, 210, 24, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(18)
      doc.text('HÁBITUS SD', 14, 14)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.text('Suplementos Deportivos', 14, 20)

      doc.setTextColor(60, 60, 59)
      doc.setFontSize(9)
      doc.text('de Vega Eduardo Ariel — Roca 54, Cinco Saltos, Río Negro', 14, 32)
      doc.text('CUIT 23-23890071-9  ·  Tel. +54 9 299 324-4332  ·  habitus.sd@gmail.com', 14, 37)

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(14)
      doc.text(`Presupuesto${numero ? ` N° ${numero}` : ''}`, 14, 49)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.text(`Fecha: ${fmtFechaPdf(fecha)}`, 14, 56)
      doc.text(`Cliente: ${busquedaCliente}`, 14, 62)

      autoTable(doc, {
        startY: 70,
        head: [['Descripción', 'Unidades', 'Prec. Unit.', 'Total']],
        body: items.map(i => [i.nombre, i.cantidad.toLocaleString('es-AR'), fmt(i.precio_unitario), fmt(i.cantidad * i.precio_unitario)]),
        headStyles: { fillColor: [0, 161, 154], textColor: [255, 255, 255] },
        styles: { fontSize: 9, textColor: [60, 60, 59] },
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
      })

      const finalY = (doc as any).lastAutoTable.finalY + 12
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.text(`Presupuesto final: ${fmt(subtotal)}`, 14, finalY)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      let y = finalY + 8
      if (formaPago) { doc.text(`Forma de pago: ${formaPago}`, 14, y); y += 6 }
      if (validezHasta) { doc.text(`El presupuesto tiene validez hasta el ${fmtFechaPdf(validezHasta)} inclusive`, 14, y); y += 6 }
      if (observaciones) {
        const lineas = doc.splitTextToSize(observaciones, 180)
        doc.text(lineas, 14, y + 2)
      }

      const nombreArchivo = `Presupuesto_${numero || 'borrador'}_${busquedaCliente.replace(/\s+/g, '_')}.pdf`
      doc.save(nombreArchivo)
    } catch (err: unknown) {
      setError('Error al generar el PDF: ' + (err instanceof Error ? err.message : JSON.stringify(err)))
    }
  }

  async function enviarABorradorVenta() {
    if (!presupuestoId || !clienteId) return
    setEnviandoABorrador(true)
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')

      const { data: cierreActivo } = await supabase
        .from('cierres_turno')
        .select('id')
        .eq('sucursal_id', 1)
        .eq('estado_cierre_turno_id', 1)
        .maybeSingle()

      if (!cierreActivo) throw new Error('No hay una caja abierta — abrí turno en Caja antes de enviar este presupuesto a la venta.')

      const itemsCarrito = items.map(i => ({
        articulo_id: i.articulo_id,
        nombre: i.nombre,
        precio_unitario: i.precio_unitario,
        cantidad: i.cantidad,
        descuento_pct: 0,
      }))

      const { data: borrador, error: borradorError } = await supabase
        .from('ventas_borrador')
        .insert({
          sucursal_id: 1,
          cierre_turno_id: cierreActivo.id,
          usuario_id: user.id,
          cliente_id: clienteId,
          etiqueta: `Presupuesto #${numero}`,
          items: itemsCarrito,
          descuento_pct: 0,
        })
        .select('id')
        .single()

      if (borradorError) throw borradorError

      const { error: updateError } = await supabase
        .from('presupuestos')
        .update({ venta_borrador_id: borrador.id })
        .eq('id', presupuestoId)

      if (updateError) throw updateError

      setVentaBorradorId(borrador.id)
      router.push(`/ventas?borrador=${borrador.id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : JSON.stringify(err))
    } finally {
      setEnviandoABorrador(false)
    }
  }

  const ESTADOS_BADGE: Record<string, string> = {
    Borrador: 'bg-gray-100 text-gray-600',
    Enviado: 'bg-blue-100 text-blue-700',
    Aprobado: 'bg-green-100 text-green-700',
    Rechazado: 'bg-red-100 text-red-700',
    Vencido: 'bg-amber-100 text-amber-700',
    Convertido: 'bg-[#00a19a]/10 text-[#00a19a]',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-semibold text-[#3c3c3b]">
          {numero ? `Presupuesto #${numero}` : 'Nuevo presupuesto'}
        </h1>
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${ESTADOS_BADGE[estado] || 'bg-gray-100 text-gray-600'}`}>
          {estado}
        </span>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
      )}

      {/* Cliente */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <label className="block text-xs font-medium text-gray-600 mb-1">Cliente</label>
        {editable ? (
          <div className="relative max-w-md">
            <input
              type="text"
              value={busquedaCliente}
              onChange={e => { setBusquedaCliente(e.target.value); setClienteId(null); setDropdownClienteAbierto(true) }}
              onFocus={() => setDropdownClienteAbierto(true)}
              placeholder="Buscar cliente..."
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]"
            />
            {dropdownClienteAbierto && clientesFiltrados.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                {clientesFiltrados.map(c => (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => elegirCliente(c)}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    {c.nombre}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-[#3c3c3b] font-medium">{busquedaCliente}</p>
        )}
      </div>

      {/* Ítems */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Artículos</h2>

        {editable && (
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={busquedaArticulo}
              onChange={e => { setBusquedaArticulo(e.target.value); setDropdownArticuloAbierto(true) }}
              onKeyDown={e => {
                if (!dropdownArticuloAbierto || articulosFiltrados.length === 0) return
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  setIndiceResaltado(prev => (prev + 1) % articulosFiltrados.length)
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  setIndiceResaltado(prev => (prev - 1 + articulosFiltrados.length) % articulosFiltrados.length)
                } else if (e.key === 'Enter') {
                  e.preventDefault()
                  agregarArticulo(articulosFiltrados[indiceResaltado])
                } else if (e.key === 'Escape') {
                  setDropdownArticuloAbierto(false)
                }
              }}
              placeholder="Buscar artículo para agregar (sin filtrar por stock)..."
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]"
            />
            {dropdownArticuloAbierto && articulosFiltrados.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-72 overflow-y-auto">
                {articulosFiltrados.map((a, i) => {
                  const stock = stockMap.get(a.id) || 0
                  return (
                    <button
                      type="button"
                      key={a.id}
                      onClick={() => agregarArticulo(a)}
                      onMouseEnter={() => setIndiceResaltado(i)}
                      className={`w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 ${
                        i === indiceResaltado ? 'bg-[#00a19a]/10' : 'hover:bg-gray-50'
                      }`}
                    >
                      <span>{a.nombre}</span>
                      <span className={`text-xs ${stock > 0 ? 'text-gray-400' : 'text-amber-600'}`}>
                        {stock > 0 ? `Stock: ${stock}` : 'Sin stock'}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {items.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">Todavía no agregaste artículos.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left px-2 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Descripción</th>
                <th className="text-right px-2 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Unidades</th>
                <th className="text-right px-2 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Prec. Unit.</th>
                <th className="text-right px-2 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                {editable && <th className="w-8"></th>}
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={item.articulo_id} className="border-b border-gray-50 last:border-0">
                  <td className="px-2 py-2 text-[#3c3c3b]">{item.nombre}</td>
                  <td className="px-2 py-2 text-right">
                    {editable ? (
                      <input
                        type="text"
                        inputMode="numeric"
                        value={item.cantidad}
                        onChange={e => actualizarItem(i, 'cantidad', Number(e.target.value.replace(/\D/g, '')) || 0)}
                        className="w-16 text-right border border-gray-200 rounded px-1.5 py-1 text-sm"
                      />
                    ) : item.cantidad}
                  </td>
                  <td className="px-2 py-2 text-right">
                    {editable ? (
                      <input
                        type="text"
                        inputMode="decimal"
                        value={item.precio_unitario}
                        onChange={e => actualizarItem(i, 'precio_unitario', Number(e.target.value.replace(/[^0-9.]/g, '')) || 0)}
                        className="w-24 text-right border border-gray-200 rounded px-1.5 py-1 text-sm"
                      />
                    ) : fmt(item.precio_unitario)}
                  </td>
                  <td className="px-2 py-2 text-right text-[#3c3c3b] font-medium">{fmt(item.cantidad * item.precio_unitario)}</td>
                  {editable && (
                    <td className="px-2 py-2 text-right">
                      <button type="button" onClick={() => eliminarItem(i)} className="text-gray-300 hover:text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 font-semibold">
                <td className="px-2 py-3" colSpan={3}>Presupuesto final</td>
                <td className="px-2 py-3 text-right text-[#00a19a] text-base">{fmt(subtotal)}</td>
                {editable && <td></td>}
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* Faltante de compra — dato interno, no va al cliente */}
      {faltantes.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-amber-800 flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4" /> Falta comprar para completar este presupuesto (dato interno, no va en el PDF)
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-amber-700">
                <th className="text-left py-1 text-xs font-semibold uppercase tracking-wide">Artículo</th>
                <th className="text-right py-1 text-xs font-semibold uppercase tracking-wide">Stock</th>
                <th className="text-right py-1 text-xs font-semibold uppercase tracking-wide">En OC pendiente</th>
                <th className="text-right py-1 text-xs font-semibold uppercase tracking-wide">Falta comprar</th>
              </tr>
            </thead>
            <tbody>
              {faltantes.map(f => (
                <tr key={f.articulo_id}>
                  <td className="py-1 text-amber-900">{f.nombre}</td>
                  <td className="py-1 text-right text-amber-700">{f.stock}</td>
                  <td className="py-1 text-right text-amber-700">{f.pendienteOc}</td>
                  <td className="py-1 text-right font-semibold text-amber-900">{f.faltante}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Datos adicionales */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Fecha</label>
            <input
              type="date"
              value={fecha}
              disabled={!editable}
              onChange={e => setFecha(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a] disabled:bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Validez hasta</label>
            <input
              type="date"
              value={validezHasta}
              disabled={!editable}
              onChange={e => setValidezHasta(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a] disabled:bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Forma de pago</label>
            <input
              type="text"
              value={formaPago}
              disabled={!editable}
              onChange={e => setFormaPago(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a] disabled:bg-gray-50"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Observaciones (van en el PDF)</label>
          <textarea
            value={observaciones}
            disabled={!editable}
            onChange={e => setObservaciones(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a] disabled:bg-gray-50"
          />
        </div>
      </div>

      {/* Acciones */}
      <div className="flex items-center gap-3 flex-wrap">
        {clienteId && items.length > 0 && (
          <button
            onClick={generarPDF}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50"
          >
            <FileDown className="w-4 h-4" /> Generar PDF
          </button>
        )}

        {editable && (
          <>
            <button
              onClick={() => guardar('Borrador')}
              disabled={guardando}
              className="flex items-center gap-2 bg-[#00a19a] text-white px-4 py-2 rounded text-sm hover:bg-[#008f89] transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" /> {guardando ? 'Guardando...' : 'Guardar borrador'}
            </button>
            {presupuestoId && estado === 'Borrador' && (
              <button
                onClick={() => guardar('Enviado')}
                disabled={guardando}
                className="px-4 py-2 border border-gray-300 rounded text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                Marcar como Enviado
              </button>
            )}
            {presupuestoId && estado === 'Enviado' && (
              <>
                <button
                  onClick={() => guardar('Aprobado')}
                  disabled={guardando}
                  className="px-4 py-2 border border-green-300 bg-green-50 rounded text-sm text-green-700 hover:bg-green-100 disabled:opacity-50"
                >
                  Marcar como Aprobado
                </button>
                <button
                  onClick={() => guardar('Rechazado')}
                  disabled={guardando}
                  className="px-4 py-2 border border-red-300 bg-red-50 rounded text-sm text-red-700 hover:bg-red-100 disabled:opacity-50"
                >
                  Marcar como Rechazado
                </button>
              </>
            )}
          </>
        )}

        {estado === 'Aprobado' && !ventaBorradorId && (
          <button
            onClick={enviarABorradorVenta}
            disabled={enviandoABorrador}
            className="flex items-center gap-2 bg-[#00a19a] text-white px-4 py-2 rounded text-sm hover:bg-[#008f89] transition-colors disabled:opacity-50"
          >
            <ShoppingCart className="w-4 h-4" /> {enviandoABorrador ? 'Enviando...' : 'Enviar a borrador de venta'}
          </button>
        )}

        {ventaBorradorId && (
          <a
            href={`/ventas?borrador=${ventaBorradorId}`}
            className="flex items-center gap-2 px-4 py-2 border border-[#00a19a] text-[#00a19a] rounded text-sm hover:bg-[#00a19a]/10 transition-colors"
          >
            <ShoppingCart className="w-4 h-4" /> Ya enviado a borrador de venta — abrir en Ventas
          </a>
        )}
      </div>
    </div>
  )
}
