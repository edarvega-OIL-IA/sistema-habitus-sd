'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import { Save, X, FileCheck, Search, Trash2 } from 'lucide-react'

interface Proveedor { id: number; nombre_comercial: string }
interface Transportista { id: number; nombre: string }
interface TasaIva { id: number; porcentaje: number }
interface Articulo {
  id: number; nombre: string
  codigo_interno: string | null; codigo_barra: string | null
  rubro_nombre: string | null; marca_nombre: string | null
  costo_sin_iva: number | null; tasa_iva_id: number | null
  precio_local: number | null; precio_web: number | null
  precio_mayorista: number | null; precio_oferta_web: number | null
}
interface ItemOrden {
  articulo_id: number; articulo_nombre: string
  tasa_iva_id: number | null
  precio_local: number | null; precio_web: number | null
  precio_mayorista: number | null; precio_oferta_web: number | null
  cant_facturada: number; cant_recibida: number
  precio_unitario: number; descuento_pct: number; subtotal: number
}

const MEDIOS_PAGO = [
  { id: 1, nombre: 'Efectivo' },
  { id: 2, nombre: 'Débito' },
  { id: 3, nombre: 'Crédito' },
  { id: 4, nombre: 'Transferencia' },
]

export default function ComprasEditarPage() {
  const router = useRouter()
  const params = useParams()
  const ordenId = Number(params.id)

  const [loading, setLoading] = useState(false)
  const [loadingInicial, setLoadingInicial] = useState(true)
  const [notif, setNotif] = useState<{ tipo: 'error' | 'ok'; msg: string } | null>(null)
  const [estadoOrdenId, setEstadoOrdenId] = useState<number>(1)

  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [transportistas, setTransportistas] = useState<Transportista[]>([])
  const [tasasIva, setTasasIva] = useState<TasaIva[]>([])
  const [articulos, setArticulos] = useState<Articulo[]>([])
  const [items, setItems] = useState<ItemOrden[]>([])

  // Form
  const [tieneComprobante, setTieneComprobante] = useState(false)
  const [nroFactura, setNroFactura] = useState('')
  const [nroRemito, setNroRemito] = useState('')
  const [fechaFactura, setFechaFactura] = useState('')
  const [proveedorId, setProveedorId] = useState<number | ''>('')
  const [fechaOrden, setFechaOrden] = useState('')
  const [nroPedidoExterno, setNroPedidoExterno] = useState('')
  const [medioPagoId, setMedioPagoId] = useState<number>(1)
  const [fleteMonto, setFleteMonto] = useState<number>(0)
  const [fleteFecha, setFleteFecha] = useState('')
  const [fleteTransportistaId, setFleteTransportistaId] = useState<number | ''>('')
  const [fleteMedioPagoId, setFleteMedioPagoId] = useState<number>(1)
  const [distribuirFlete, setDistribuirFlete] = useState(true)
  const [observaciones, setObservaciones] = useState('')
  const [montoComprobante, setMontoComprobante] = useState<number>(0)
  const [diferenciaPendiente, setDiferenciaPendiente] = useState<{
    diferencia: number; confirmarPendiente: boolean
  } | null>(null)
  // Ítem de ajuste por redondeo ya existente en la orden (si lo hay) — se
  // guarda aparte de `items` para que no se mezcle con los artículos
  // editables (nunca debe aparecer como fila en la tabla de productos).
  const [ajusteExistente, setAjusteExistente] = useState<{ subtotal: number } | null>(null)

  // Foto del estado tal cual quedó guardado la orden, para saber si el
  // usuario cambió algo real desde entonces (usado para deshabilitar
  // "Confirmar orden" en una orden ya confirmada sin cambios pendientes).
  const [snapshotOriginal, setSnapshotOriginal] = useState<string | null>(null)

  // Texto crudo en edición para inputs de monto (evita que se pierda el
  // separador decimal mientras se tipea)
  const [montoComprobanteTexto, setMontoComprobanteTexto] = useState<string | null>(null)
  const [fleteMontoTexto, setFleteMontoTexto] = useState<string | null>(null)
  const [precioTexto, setPrecioTexto] = useState<Record<number, string>>({})

  // Buscador
  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState<Articulo[]>([])
  const [indiceSeleccionado, setIndiceSeleccionado] = useState(-1)
  const busquedaRef = useRef<HTMLInputElement>(null)
  const cantRef = useRef<HTMLInputElement>(null)

  useEffect(() => { cargarDatos() }, [])

  useEffect(() => {
    const termino = busqueda.trim()
    if (!termino) { setResultados([]); setIndiceSeleccionado(-1); return }
    const tokens = termino.toLowerCase().split(/\s+/)
    const filtrados = articulos.filter(a => {
      const haystack = [a.nombre, a.codigo_interno, a.codigo_barra, a.rubro_nombre, a.marca_nombre]
        .filter(Boolean).join(' ').toLowerCase()
      return tokens.every(t => haystack.includes(t))
    })
    setResultados(filtrados.slice(0, 12))
    setIndiceSeleccionado(-1)
  }, [busqueda, articulos])

  async function cargarDatos() {
    const supabase = createClient()
    try {
      const [provRes, transRes, artRes, tasasRes, ordenRes] = await Promise.all([
        supabase.from('proveedores').select('id, nombre_comercial').eq('activo', true).order('nombre_comercial'),
        supabase.from('transportistas').select('id, nombre').eq('activo', true).order('nombre'),
        supabase.from('articulos').select(`
          id, nombre, codigo_interno, codigo_barra, costo_sin_iva, tasa_iva_id,
          precio_local, precio_web, precio_mayorista, precio_oferta_web,
          rubros ( nombre ), marcas ( nombre )
        `).eq('activo', true).order('nombre'),
        supabase.from('tasas_iva').select('id, porcentaje'),
        supabase.from('ordenes_compra').select(`
          id, proveedor_id, fecha_orden, estado_orden_compra_id, tipo_orden_compra_id,
          tiene_comprobante, numero_factura_proveedor, numero_remito_proveedor, fecha_factura,
          numero_pedido_externo, medio_pago_id, flete_monto, flete_fecha, flete_medio_pago_id, flete_transportista_id,
          monto_comprobante, observaciones,
          orden_compra_items (
            articulo_id, cantidad_facturada, cantidad_recibida,
            precio_unitario_sin_iva, subtotal, es_ajuste_redondeo,
            articulos ( nombre, tasa_iva_id, precio_local, precio_web, precio_mayorista, precio_oferta_web )
          )
        `).eq('id', ordenId).single(),
      ])

      setProveedores(provRes.data || [])
      setTransportistas(transRes.data || [])
      setTasasIva(tasasRes.data || [])
      setArticulos((artRes.data || []).map((a: any) => ({
        ...a,
        rubro_nombre: a.rubros?.nombre || null,
        marca_nombre: a.marcas?.nombre || null,
      })))

      // Poblar form con datos de la orden
      const o = ordenRes.data as any
      if (!o) throw new Error('Orden no encontrada')

      setEstadoOrdenId(o.estado_orden_compra_id)
      setProveedorId(o.proveedor_id)
      setFechaOrden(o.fecha_orden)
      setTieneComprobante(o.tiene_comprobante)
      setNroFactura(o.numero_factura_proveedor || '')
      setNroRemito(o.numero_remito_proveedor || '')
      setFechaFactura(o.fecha_factura || '')
      setNroPedidoExterno(o.numero_pedido_externo || '')
      if (o.medio_pago_id) setMedioPagoId(o.medio_pago_id)
      setFleteMonto(o.flete_monto || 0)
      setFleteFecha(o.flete_fecha || '')
      setFleteMedioPagoId(o.flete_medio_pago_id || 1)
      setFleteTransportistaId(o.flete_transportista_id || '')
      setMontoComprobante(o.monto_comprobante || 0)
      setObservaciones(o.observaciones || '')

      // Poblar items — precio_unitario en pantalla es con IVA.
      // El ítem de ajuste por redondeo (es_ajuste_redondeo=true) NUNCA se
      // mezcla con los artículos editables — se guarda aparte para no
      // perder su marca especial al volver a guardar la orden.
      const tasas: TasaIva[] = tasasRes.data || []
      const itemsReales = (o.orden_compra_items || []).filter((it: any) => !it.es_ajuste_redondeo)
      const itemAjuste = (o.orden_compra_items || []).find((it: any) => it.es_ajuste_redondeo)
      setAjusteExistente(itemAjuste ? { subtotal: itemAjuste.subtotal } : null)

      const itemsCargados: ItemOrden[] = itemsReales.map((it: any) => {
        const tasa = tasas.find(t => t.id === it.articulos?.tasa_iva_id)
        const divisor = tasa ? 1 + tasa.porcentaje / 100 : 1.21
        const precioConIva = Math.round(it.precio_unitario_sin_iva * divisor * 100) / 100
        return {
          articulo_id: it.articulo_id,
          articulo_nombre: it.articulos?.nombre || '',
          tasa_iva_id: it.articulos?.tasa_iva_id || null,
          precio_local: it.articulos?.precio_local || null,
          precio_web: it.articulos?.precio_web || null,
          precio_mayorista: it.articulos?.precio_mayorista || null,
          precio_oferta_web: it.articulos?.precio_oferta_web || null,
          cant_facturada: it.cantidad_facturada,
          cant_recibida: it.cantidad_recibida,
          precio_unitario: precioConIva,
          descuento_pct: it.descuento_pct || 0,
          subtotal: it.subtotal,
        }
      })
      setItems(itemsCargados)
      setSnapshotOriginal(construirFirma({
        proveedorId: o.proveedor_id, fechaOrden: o.fecha_orden, tieneComprobante: o.tiene_comprobante,
        nroFactura: o.numero_factura_proveedor || '', nroRemito: o.numero_remito_proveedor || '',
        fechaFactura: o.fecha_factura || '', nroPedidoExterno: o.numero_pedido_externo || '',
        medioPagoId: o.medio_pago_id || 1, fleteMonto: o.flete_monto || 0, fleteFecha: o.flete_fecha || '',
        fleteMedioPagoId: o.flete_medio_pago_id || 1, fleteTransportistaId: o.flete_transportista_id || '',
        montoComprobante: o.monto_comprobante || 0, observaciones: o.observaciones || '',
        items: itemsCargados,
      }))
    } catch (e: any) {
      setNotif({ tipo: 'error', msg: e.message })
    } finally {
      setLoadingInicial(false)
    }
  }

  // Arma una "firma" comparable del estado del formulario — se usa para
  // saber si el usuario cambió algo real desde que se cargó/confirmó la
  // orden (ver snapshotOriginal más arriba).
  function construirFirma(vals: {
    proveedorId: number | ''; fechaOrden: string; tieneComprobante: boolean;
    nroFactura: string; nroRemito: string; fechaFactura: string; nroPedidoExterno: string;
    medioPagoId: number; fleteMonto: number; fleteFecha: string; fleteMedioPagoId: number;
    fleteTransportistaId: number | ''; montoComprobante: number; observaciones: string;
    items: ItemOrden[];
  }) {
    return JSON.stringify({
      proveedorId: vals.proveedorId, fechaOrden: vals.fechaOrden, tieneComprobante: vals.tieneComprobante,
      nroFactura: vals.nroFactura, nroRemito: vals.nroRemito, fechaFactura: vals.fechaFactura,
      nroPedidoExterno: vals.nroPedidoExterno, medioPagoId: vals.medioPagoId,
      fleteMonto: vals.fleteMonto, fleteFecha: vals.fleteFecha, fleteMedioPagoId: vals.fleteMedioPagoId,
      fleteTransportistaId: vals.fleteTransportistaId, montoComprobante: vals.montoComprobante,
      observaciones: vals.observaciones,
      items: [...vals.items]
        .sort((a, b) => (a.articulo_id ?? 0) - (b.articulo_id ?? 0))
        .map(it => ({
          articulo_id: it.articulo_id, cant_facturada: it.cant_facturada, cant_recibida: it.cant_recibida,
          precio_unitario: it.precio_unitario, descuento_pct: it.descuento_pct,
        })),
    })
  }

  function getDivisorIva(tasaIvaId: number | null): number {
    const tasa = tasasIva.find(t => t.id === tasaIvaId)
    return tasa ? 1 + tasa.porcentaje / 100 : 1.21
  }

  function agregarArticulo(art: Articulo) {
    if (items.find(i => i.articulo_id === art.id)) {
      setBusqueda(''); setResultados([]); return
    }
    const divisor = getDivisorIva(art.tasa_iva_id)
    const precio = art.costo_sin_iva ? Math.round(art.costo_sin_iva * divisor * 100) / 100 : 0
    setItems(prev => [...prev, {
      articulo_id: art.id, articulo_nombre: art.nombre,
      tasa_iva_id: art.tasa_iva_id,
      precio_local: art.precio_local, precio_web: art.precio_web,
      precio_mayorista: art.precio_mayorista, precio_oferta_web: art.precio_oferta_web,
      cant_facturada: 1, cant_recibida: 1,
      precio_unitario: precio, descuento_pct: 0, subtotal: precio,
    }])
    setBusqueda(''); setResultados([])
    setTimeout(() => cantRef.current?.focus(), 50)
  }

  function actualizarItem(index: number, campo: keyof ItemOrden, valor: any) {
    setItems(prev => {
      const next = [...prev]
      next[index] = { ...next[index], [campo]: valor }
      if (campo === 'cant_facturada') next[index].cant_recibida = valor
      const it = next[index]
      next[index].subtotal = it.cant_facturada * it.precio_unitario * (1 - it.descuento_pct / 100)
      return next
    })
  }

  function eliminarItem(index: number) {
    setItems(prev => prev.filter((_, i) => i !== index))
    setPrecioTexto(prev => {
      const next: Record<number, string> = {}
      Object.entries(prev).forEach(([k, v]) => {
        const i = Number(k)
        if (i < index) next[i] = v
        else if (i > index) next[i - 1] = v
      })
      return next
    })
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!resultados.length) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setIndiceSeleccionado(i => Math.min(i + 1, resultados.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setIndiceSeleccionado(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter' && indiceSeleccionado >= 0) { e.preventDefault(); agregarArticulo(resultados[indiceSeleccionado]) }
    if (e.key === 'Escape') { setResultados([]); setBusqueda('') }
  }

  function mostrarError(msg: string) {
    setNotif({ tipo: 'error', msg })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const subtotalArticulos = items.reduce((s, i) => s + i.subtotal, 0)
  const totalGeneral = subtotalArticulos + fleteMonto

  // Los dos avisos de diferencia contra el comprobante (rojo bloqueante y
  // amarillo de redondeo) se calculan una sola vez, al tocar Guardar/
  // Confirmar — si después el usuario corrige un artículo, cambia una
  // cantidad, agrega/elimina un ítem, o edita el monto del comprobante o el
  // flete, el aviso viejo queda desactualizado y hay que sacarlo de encima.
  // Vuelve a aparecer recién si, al reintentar guardar, la diferencia sigue
  // existiendo de verdad.
  useEffect(() => {
    if (diferenciaPendiente) setDiferenciaPendiente(null)
    if (notif?.tipo === 'error' && notif.msg.includes('difiere del monto del comprobante')) {
      setNotif(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, montoComprobante, fleteMonto])

  const UMBRAL_BLOQUEO = 500 // diferencia >= $500 -> bloquea, probablemente falta un artículo

  function calcularDiferenciaComprobante(): number | null {
    if (!montoComprobante || montoComprobante <= 0) return null
    return Math.round((montoComprobante - subtotalArticulos) * 100) / 100
  }

  function costoConFlete(item: ItemOrden): number | null {
    if (!distribuirFlete || fleteMonto === 0 || subtotalArticulos === 0) return null
    const prop = item.subtotal / subtotalArticulos
    // Costo por unidad CON IVA (misma base que "Precio Unit. (c/IVA)"), para
    // que se vea claramente que el flete SUMA al costo, nunca resta. El valor
    // sin IVA que se persiste como costo_sin_iva al confirmar se calcula
    // aparte, en guardar() — esta función es solo para mostrar.
    return (item.subtotal + fleteMonto * prop) / item.cant_recibida
  }

  function validar(): string | null {
    if (!proveedorId) return 'Seleccioná un proveedor'
    if (!fechaOrden) return 'La fecha es requerida'
    if (items.length === 0) return 'Agregá al menos un artículo'
    if (fleteMonto > 0 && !fleteTransportistaId) return 'Si hay flete, especificá el transportista'
    if (fleteMonto > 0 && !fleteFecha) return 'Si hay flete, especificá la fecha en que se pagó'
    const dif = calcularDiferenciaComprobante()
    if (dif !== null && Math.abs(dif) >= UMBRAL_BLOQUEO) {
      return `El total de artículos ($${subtotalArticulos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}) ` +
        `difiere del monto del comprobante ($${montoComprobante.toLocaleString('es-AR', { minimumFractionDigits: 2 })}) ` +
        `en $${Math.abs(dif).toLocaleString('es-AR', { minimumFractionDigits: 2 })}. ` +
        `Revisá si falta algún artículo o si hay un precio mal cargado.`
    }
    return null
  }

  // ----------------------------------------------------------------
  // Sincroniza el movimiento de un subtipo ('mercaderia' | 'flete')
  // contra el monto/fecha/medio actuales. Crea, actualiza o elimina
  // (con confirmación) según corresponda. No duplica nunca.
  // ----------------------------------------------------------------
  async function sincronizarMovimiento(opts: {
    supabase: any
    subtipo: 'mercaderia' | 'flete'
    monto: number
    fechaUtc: string
    medioPagoId: number
    sucursalId: number
    usuarioId: string
    categoriaGastoId: number
    conceptoGastoId: number
    observacionesTexto: string
  }): Promise<{ ok: boolean; cancelado?: boolean }> {
    const { supabase, subtipo, monto, fechaUtc, medioPagoId, sucursalId, usuarioId,
      categoriaGastoId, conceptoGastoId, observacionesTexto } = opts

    const { data: movExistente } = await supabase
      .from('movimientos')
      .select('id, monto')
      .eq('origen_tipo', 'orden_compra')
      .eq('origen_id', ordenId)
      .eq('origen_subtipo', subtipo)
      .eq('anulado', false)
      .maybeSingle()

    if (monto > 0) {
      if (movExistente) {
        await supabase.from('movimientos').update({
          monto, medio_pago_id: medioPagoId,
          fecha_utc: fechaUtc, mes_contable: fechaUtc.substring(0, 7) + '-01',
          observaciones: observacionesTexto,
        }).eq('id', movExistente.id)
      } else {
        await supabase.from('movimientos').insert({
          sucursal_id: sucursalId, tipo: 'Egreso',
          categoria_gasto_id: categoriaGastoId, concepto_gasto_id: conceptoGastoId,
          monto, medio_pago_id: medioPagoId,
          fecha_utc: fechaUtc, mes_contable: fechaUtc.substring(0, 7) + '-01',
          origen_tipo: 'orden_compra', origen_id: ordenId, origen_subtipo: subtipo,
          usuario_id: usuarioId, observaciones: observacionesTexto,
        })
      }
    } else if (movExistente) {
      // El monto bajó a 0: se permite eliminar, pero se confirma explícitamente
      const confirmaBorrado = confirm(
        `El monto de ${subtipo === 'mercaderia' ? 'mercadería' : 'flete'} quedó en $0. ` +
        `¿Eliminar el movimiento de pago ya registrado (id ${movExistente.id})?`
      )
      if (!confirmaBorrado) return { ok: false, cancelado: true }
      await supabase.from('movimientos').delete().eq('id', movExistente.id)
    }
    return { ok: true }
  }

  async function guardar(confirmar: boolean, montoAjustado?: number) {
    const err = validar()
    if (err) { mostrarError(err); return }

    // Si hay diferencia chica contra el comprobante y todavía no se resolvió, mostrar aviso y pausar
    if (montoAjustado === undefined) {
      const dif = calcularDiferenciaComprobante()
      if (dif !== null && dif !== 0 && Math.abs(dif) < UMBRAL_BLOQUEO) {
        setDiferenciaPendiente({ diferencia: dif, confirmarPendiente: confirmar })
        return
      }
    }

    if (confirmar && !confirm('¿Confirmar la orden? Se actualizará el stock y los costos de los artículos.')) return

    setLoading(true)
    setNotif(null)
    const supabase = createClient()

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')
      const { data: usuarioData } = await supabase
        .from('usuarios').select('id, sucursal_id').eq('id', user.id).single()
      if (!usuarioData) throw new Error('Usuario no encontrado')
      const sucursalId = usuarioData.sucursal_id

      // Verificar estado ACTUAL en BD (no el del estado React, que puede estar desactualizado)
      const { data: ordenActual } = await supabase
        .from('ordenes_compra')
        .select('estado_orden_compra_id')
        .eq('id', ordenId)
        .single()
      const eraConfirmada = ordenActual?.estado_orden_compra_id === 2

      // Si era confirmada y se está re-editando: revertir stock ANTES de reaplicar,
      // vía un movimiento de stock real (no un UPDATE directo) para que quede
      // trazable en el historial y el trigger fn_aplicar_item_stock haga la cuenta.
      // (el movimiento de mercadería/flete YA NO se anula acá — eso lo maneja sincronizarMovimiento)
      if (eraConfirmada) {
        const { data: itemsAnteriores } = await supabase
          .from('orden_compra_items')
          .select('articulo_id, cantidad_recibida')
          .eq('orden_compra_id', ordenId)

        const itemsAReverti = (itemsAnteriores || []).filter(
          (it: any) => it.articulo_id !== null && it.cantidad_recibida > 0
        )

        if (itemsAReverti.length > 0) {
          const { data: movReversion, error: errMovReversion } = await supabase
            .from('movimientos_stock')
            .insert({
              sucursal_id: sucursalId, tipo_movimiento_stock_id: 2, subtipo_movimiento_stock_id: null,
              origen_tipo: 'orden_compra', origen_id: ordenId,
              observaciones: `Reversión por edición de Orden #${ordenId} ya confirmada`,
              fecha_utc: fechaOrden, creado_en: new Date().toISOString(),
            })
            .select('id').single()
          if (errMovReversion) throw new Error('Error al revertir stock: ' + errMovReversion.message)

          const { error: errItemsReversion } = await supabase.from('movimiento_stock_items').insert(
            itemsAReverti.map((it: any) => ({
              movimiento_stock_id: movReversion.id,
              articulo_id: it.articulo_id,
              cantidad: it.cantidad_recibida,
            }))
          )
          if (errItemsReversion) throw new Error('Error al revertir stock: ' + errItemsReversion.message)
        }
      }

      // Eliminar items anteriores (se recargan siempre)
      await supabase.from('orden_compra_items').delete().eq('orden_compra_id', ordenId)

      // Calcular flete prorrateado
      const itemsConFlete = items.map(item => {
        const prop = subtotalArticulos > 0 ? item.subtotal / subtotalArticulos : 0
        const fleteItem = distribuirFlete ? fleteMonto * prop : 0
        const divisorIva = getDivisorIva(item.tasa_iva_id)
        const costoFinal = item.cant_recibida > 0
          ? (item.subtotal + fleteItem) / item.cant_recibida / divisorIva
          : item.precio_unitario / divisorIva
        return { ...item, flete_prorrateado: fleteItem, costo_final_unitario: costoFinal }
      })

      // Actualizar orden
      const { error: ordenUpdateError } = await supabase.from('ordenes_compra').update({
        proveedor_id: proveedorId,
        fecha_orden: fechaOrden,
        tipo_orden_compra_id: tieneComprobante ? 2 : 1,
        estado_orden_compra_id: confirmar ? 2 : 1,
        tiene_comprobante: tieneComprobante,
        numero_factura_proveedor: tieneComprobante ? nroFactura || null : null,
        numero_remito_proveedor: tieneComprobante ? nroRemito || null : null,
        fecha_factura: tieneComprobante ? fechaFactura || null : null,
        numero_pedido_externo: nroPedidoExterno || null,
        flete_monto: fleteMonto,
        flete_fecha: fleteMonto > 0 ? fleteFecha || null : null,
        flete_medio_pago_id: fleteMonto > 0 ? fleteMedioPagoId : null,
        flete_transportista_id: fleteMonto > 0 && fleteTransportistaId ? fleteTransportistaId : null,
        monto_comprobante: tieneComprobante && montoComprobante > 0 ? montoComprobante : null,
        subtotal: subtotalArticulos,
        total: montoAjustado !== undefined
          ? montoAjustado + fleteMonto
          : totalGeneral + (ajusteExistente?.subtotal || 0),
        observaciones: observaciones || null,
        usuario_id: usuarioData.id,
      }).eq('id', ordenId)

      if (ordenUpdateError) throw new Error('Error al actualizar la orden: ' + ordenUpdateError.message)

      // Insertar nuevos items (artículos reales)
      const { error: itemsInsertError } = await supabase.from('orden_compra_items').insert(
        itemsConFlete.map(it => ({
          orden_compra_id: ordenId,
          articulo_id: it.articulo_id,
          cantidad_facturada: it.cant_facturada,
          cantidad_recibida: it.cant_recibida,
          precio_unitario_sin_iva: it.precio_unitario / getDivisorIva(it.tasa_iva_id),
          flete_prorrateado: it.flete_prorrateado,
          costo_final_unitario: it.costo_final_unitario,
          subtotal: it.subtotal,
          es_ajuste_redondeo: false,
        }))
      )

      if (itemsInsertError) throw new Error('Error al guardar los artículos: ' + itemsInsertError.message)

      // Marcar como visible en salón todo artículo que quede en la orden,
      // sin importar si sigue en Borrador o se confirma — así no hace falta
      // ir a activarlo a mano en Artículos después de cada edición.
      const articuloIds = itemsConFlete.map(it => it.articulo_id).filter((id): id is number => id !== null)
      if (articuloIds.length > 0) {
        const { error: visibleError } = await supabase
          .from('articulos')
          .update({ disponible_local: true })
          .in('id', articuloIds)
          .eq('disponible_local', false)
        if (visibleError) console.error('Error al marcar artículos como visibles:', visibleError.message)
      }

      // Si hay ajuste de redondeo NUEVO (se acaba de resolver una diferencia
      // contra el comprobante en este guardado), insertar el ítem especial.
      // Si no hay uno nuevo pero YA existía uno de una edición anterior,
      // se reinserta tal cual — nunca se pierde silenciosamente.
      if (montoAjustado !== undefined && montoAjustado !== subtotalArticulos) {
        const ajuste = Math.round((montoAjustado - subtotalArticulos) * 100) / 100
        await supabase.from('orden_compra_items').insert({
          orden_compra_id: ordenId,
          articulo_id: null,
          cantidad_facturada: 1,
          cantidad_recibida: 0,
          precio_unitario_sin_iva: ajuste,
          flete_prorrateado: 0,
          costo_final_unitario: 0,
          subtotal: ajuste,
          es_ajuste_redondeo: true,
        })
      } else if (ajusteExistente) {
        await supabase.from('orden_compra_items').insert({
          orden_compra_id: ordenId,
          articulo_id: null,
          cantidad_facturada: 1,
          cantidad_recibida: 0,
          precio_unitario_sin_iva: ajusteExistente.subtotal,
          flete_prorrateado: 0,
          costo_final_unitario: 0,
          subtotal: ajusteExistente.subtotal,
          es_ajuste_redondeo: true,
        })
      }

      // Sincronizar movimiento de MERCADERÍA — siempre, sea Borrador o Confirmada.
      // Si el usuario eligió "Ajustar automáticamente" por diferencia de redondeo
      // contra el comprobante, se usa ese monto final en vez del subtotal calculado.
      const montoMercaderia = montoAjustado ?? subtotalArticulos
      const resMerc = await sincronizarMovimiento({
        supabase, subtipo: 'mercaderia',
        monto: montoMercaderia, fechaUtc: fechaOrden, medioPagoId,
        sucursalId, usuarioId: usuarioData.id,
        categoriaGastoId: 1, conceptoGastoId: 33,
        observacionesTexto: `Compra a proveedor - Orden #${ordenId}` +
          (montoAjustado !== undefined && montoAjustado !== subtotalArticulos
            ? ` (ajustado por redondeo vs. comprobante: $${(montoAjustado - subtotalArticulos).toFixed(2)})`
            : ''),
      })
      if (!resMerc.ok) { setLoading(false); return }

      // Sincronizar movimiento de FLETE — siempre, sea Borrador o Confirmada
      const transNombre = transportistas.find(t => t.id === fleteTransportistaId)?.nombre || ''
      const resFlete = await sincronizarMovimiento({
        supabase, subtipo: 'flete',
        monto: fleteMonto, fechaUtc: fleteFecha || fechaOrden, medioPagoId: fleteMedioPagoId,
        sucursalId, usuarioId: usuarioData.id,
        categoriaGastoId: 1, conceptoGastoId: 44,
        observacionesTexto: `Flete Orden #${ordenId}${transNombre ? ' - ' + transNombre : ''}`,
      })
      if (!resFlete.ok) { setLoading(false); return }

      // Stock + costo + histórico — SOLO si la orden queda Confirmada
      if (confirmar) {
        // Stock: un solo movimiento de Ingreso con origen en esta orden, para
        // que quede trazable en el historial y el trigger fn_aplicar_item_stock
        // haga la suma (antes se pisaba articulo_stock con un UPDATE directo,
        // sin dejar ningún rastro — bug encontrado el 22/07).
        const itemsConStock = itemsConFlete.filter(it => it.articulo_id !== null && it.cant_recibida > 0)

        if (itemsConStock.length > 0) {
          // El trigger solo hace UPDATE (no INSERT) sobre articulo_stock, así
          // que un artículo comprado por primera vez necesita la fila creada
          // de antemano con stock_actual=0 para que el trigger tenga qué sumar.
          const { data: stockExistente } = await supabase
            .from('articulo_stock').select('articulo_id')
            .eq('sucursal_id', sucursalId)
            .in('articulo_id', itemsConStock.map(it => it.articulo_id))
          const idsConFila = new Set((stockExistente || []).map((s: any) => s.articulo_id))
          const faltantes = itemsConStock.filter(it => !idsConFila.has(it.articulo_id))
          if (faltantes.length > 0) {
            await supabase.from('articulo_stock').insert(
              faltantes.map(it => ({
                articulo_id: it.articulo_id, sucursal_id: sucursalId,
                stock_actual: 0, stock_min: 0, stock_max: null,
              }))
            )
          }

          const { data: movIngreso, error: errMovIngreso } = await supabase
            .from('movimientos_stock')
            .insert({
              sucursal_id: sucursalId, tipo_movimiento_stock_id: 1, subtipo_movimiento_stock_id: null,
              origen_tipo: 'orden_compra', origen_id: ordenId,
              observaciones: `Compra Orden #${ordenId}`,
              fecha_utc: fechaOrden, creado_en: new Date().toISOString(),
            })
            .select('id').single()
          if (errMovIngreso) throw new Error('Error al aplicar stock: ' + errMovIngreso.message)

          const { error: errItemsIngreso } = await supabase.from('movimiento_stock_items').insert(
            itemsConStock.map(it => ({
              movimiento_stock_id: movIngreso.id,
              articulo_id: it.articulo_id,
              cantidad: it.cant_recibida,
            }))
          )
          if (errItemsIngreso) throw new Error('Error al aplicar stock: ' + errItemsIngreso.message)
        }

        for (const it of itemsConFlete) {
          const costoSinIva = it.costo_final_unitario
          const artPrevio = articulos.find(a => a.id === it.articulo_id)

          // ¿Existe ya un registro de historico_precios (tipo='costo') para esta orden+artículo?
          const { data: histDeEstaOrden } = await supabase
            .from('historico_precios')
            .select('id, fecha')
            .eq('articulo_id', it.articulo_id).eq('origen_id', ordenId).eq('tipo', 'costo')
            .maybeSingle()

          if (histDeEstaOrden) {
            // Edición de una orden ya confirmada antes: corregir el histórico siempre
            await supabase.from('historico_precios').update({
              costo_sin_iva: costoSinIva,
            }).eq('id', histDeEstaOrden.id)
          } else {
            await supabase.from('historico_precios').insert({
              articulo_id: it.articulo_id, fecha: fechaOrden, tipo: 'costo',
              costo_sin_iva: costoSinIva,
              precio_local: artPrevio?.precio_local, precio_web: artPrevio?.precio_web,
              precio_mayorista: artPrevio?.precio_mayorista, precio_oferta_web: artPrevio?.precio_oferta_web,
              tasa_iva_id: it.tasa_iva_id, origen_id: ordenId, usuario_id: usuarioData.id,
            })
          }

          // ¿Es esta orden la compra de costo MÁS RECIENTE para este artículo?
          // Si hay un historico_precios de tipo='costo' más nuevo (de otra orden), no tocar articulos.costo_sin_iva
          const { data: histMasReciente } = await supabase
            .from('historico_precios')
            .select('origen_id, fecha, creado_en')
            .eq('articulo_id', it.articulo_id).eq('tipo', 'costo')
            .order('fecha', { ascending: false })
            .order('creado_en', { ascending: false })
            .limit(1).maybeSingle()

          const esLaMasReciente = !histMasReciente || histMasReciente.origen_id === ordenId

          if (esLaMasReciente) {
            await supabase.from('articulos').update({ costo_sin_iva: costoSinIva }).eq('id', it.articulo_id)
          }
        }
      }

      router.push('/compras')
      router.refresh()
    } catch (e: any) {
      mostrarError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function parsearMonto(v: string): number {
    const raw = (v || '').trim()
    if (!raw) return 0
    const negativo = raw.startsWith('-')
    const s = negativo ? raw.slice(1) : raw
    const lastComma = s.lastIndexOf(',')
    const lastDot = s.lastIndexOf('.')
    const lastSep = Math.max(lastComma, lastDot)
    let n: number
    if (lastSep === -1) {
      n = parseFloat(s.replace(/[^\d]/g, ''))
    } else {
      const despuesDelSeparador = s.slice(lastSep + 1).replace(/[^\d]/g, '')
      if (despuesDelSeparador.length === 1 || despuesDelSeparador.length === 2) {
        const parteEntera = s.slice(0, lastSep).replace(/[.,]/g, '')
        n = parseFloat((parteEntera || '0') + '.' + despuesDelSeparador)
      } else {
        n = parseFloat(s.replace(/[.,]/g, ''))
      }
    }
    if (isNaN(n)) return 0
    return negativo ? -n : n
  }
  function fmtInput(n: number): string {
    if (!n) return ''
    return n.toLocaleString('es-AR', { maximumFractionDigits: 2 })
  }
  const fmt = (n: number) => '$' + n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const esAnulada = estadoOrdenId === 3

  // Compara el estado actual del formulario contra la foto de cuando se
  // cargó/confirmó la orden — si no hay diferencias reales, "Confirmar
  // orden" se deshabilita para no reprocesar stock/costo sin necesidad.
  const hayCambios = snapshotOriginal === null || snapshotOriginal !== construirFirma({
    proveedorId, fechaOrden, tieneComprobante, nroFactura, nroRemito, fechaFactura, nroPedidoExterno,
    medioPagoId, fleteMonto, fleteFecha, fleteMedioPagoId, fleteTransportistaId, montoComprobante, observaciones,
    items,
  })
  const confirmarDeshabilitado = loading || (estadoOrdenId === 2 && !hayCambios)

  if (loadingInicial) return <p className="text-sm text-gray-500 p-8">Cargando orden...</p>

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#3c3c3b]">Editar orden de compra #{ordenId}</h1>
          {esAnulada && (
            <p className="text-xs text-red-500 mt-1">Esta orden está anulada — solo lectura</p>
          )}
        </div>
        {!esAnulada && (
          <div className="flex gap-2">
            <button type="button" onClick={() => router.push('/compras')}
              className="px-4 py-2 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
              <X className="w-4 h-4" /> Cancelar
            </button>
            <button type="button" onClick={() => guardar(false)} disabled={loading}
              className="px-4 py-2 border border-[#00a19a] text-[#00a19a] rounded text-sm hover:bg-[#00a19a] hover:text-white flex items-center gap-2 disabled:opacity-50">
              <Save className="w-4 h-4" /> Guardar borrador
            </button>
            <button type="button" onClick={() => guardar(true)} disabled={confirmarDeshabilitado}
              title={estadoOrdenId === 2 && !hayCambios ? 'Esta orden ya está confirmada y no tiene cambios pendientes' : undefined}
              className="px-4 py-2 bg-[#00a19a] text-white rounded text-sm hover:bg-[#008f89] flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
              <FileCheck className="w-4 h-4" />
              {loading ? 'Procesando...' : confirmarDeshabilitado ? 'Confirmada' : 'Confirmar orden'}
            </button>
          </div>
        )}
        {esAnulada && (
          <button type="button" onClick={() => router.push('/compras')}
            className="px-4 py-2 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
            <X className="w-4 h-4" /> Volver
          </button>
        )}
      </div>

      {/* Notificación */}
      {notif && (
        <div className={`rounded-lg border px-4 py-3 flex items-center justify-between gap-3 ${
          notif.tipo === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'
        }`}>
          <p className="text-sm font-medium">{notif.msg}</p>
          <button onClick={() => setNotif(null)} className="opacity-50 hover:opacity-100 text-lg leading-none">✕</button>
        </div>
      )}

      {/* Aviso de diferencia chica contra el comprobante */}
      {diferenciaPendiente && (
        <div className="rounded-lg border px-4 py-3 bg-amber-50 border-amber-200 text-amber-800">
          <p className="text-sm font-medium mb-3">
            Hay una diferencia de ${Math.abs(diferenciaPendiente.diferencia).toLocaleString('es-AR', { minimumFractionDigits: 2 })} entre
            el monto del comprobante y la suma de los artículos cargados.
            ¿Generar un movimiento ajustado por redondeo, o preferís corregir manualmente algún ítem?
          </p>
          <div className="flex gap-2">
            <button type="button"
              onClick={() => {
                const conf = diferenciaPendiente.confirmarPendiente
                const monto = montoComprobante
                setDiferenciaPendiente(null)
                guardar(conf, monto)
              }}
              className="px-3 py-1.5 bg-amber-600 text-white rounded text-xs font-medium hover:bg-amber-700">
              Ajustar automáticamente
            </button>
            <button type="button" onClick={() => setDiferenciaPendiente(null)}
              className="px-3 py-1.5 border border-amber-300 text-amber-800 rounded text-xs font-medium hover:bg-amber-100">
              Volver a corregir un ítem (todavía no se guardó nada)
            </button>
          </div>
          <p className="text-xs text-amber-700 mt-2">
            Este segundo botón no guarda la orden — solo cierra este aviso para que corrijas algún precio o cantidad. Después tenés que volver a clickear "Confirmar orden" o "Guardar borrador".
          </p>
        </div>
      )}

      {/* Comprobante */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-3">
          <input type="checkbox" id="tiene_comprobante" checked={tieneComprobante}
            disabled={esAnulada}
            onChange={e => setTieneComprobante(e.target.checked)}
            className="w-4 h-4 text-[#00a19a] border-gray-300 rounded focus:ring-[#00a19a]" />
          <label htmlFor="tiene_comprobante" className="text-sm font-semibold text-gray-700">
            Tiene comprobante (factura / remito)
          </label>
        </div>
        {tieneComprobante && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-200">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nro. Factura</label>
              <input type="text" value={nroFactura} onChange={e => setNroFactura(e.target.value)}
                disabled={esAnulada} placeholder="0001-00001234"
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a] disabled:bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nro. Remito</label>
              <input type="text" value={nroRemito} onChange={e => setNroRemito(e.target.value)}
                disabled={esAnulada} placeholder="Opcional"
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a] disabled:bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fecha factura</label>
              <input type="date" value={fechaFactura} onChange={e => setFechaFactura(e.target.value)}
                disabled={esAnulada}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a] disabled:bg-gray-50" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Monto según comprobante</label>
              <input type="text" inputMode="decimal"
                value={montoComprobanteTexto !== null ? montoComprobanteTexto : fmtInput(montoComprobante)}
                disabled={esAnulada}
                onFocus={e => e.target.select()}
                onChange={e => {
                  const raw = e.target.value
                  setMontoComprobanteTexto(raw)
                  setMontoComprobante(parsearMonto(raw))
                }}
                onBlur={() => setMontoComprobanteTexto(null)}
                placeholder="Opcional — para validar contra los artículos"
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a] disabled:bg-gray-50" />
            </div>
          </div>
        )}
      </div>

      {/* Datos generales */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Datos de la orden</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Proveedor <span className="text-red-500">*</span></label>
            <select value={proveedorId} onChange={e => setProveedorId(Number(e.target.value))}
              disabled={esAnulada}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a] disabled:bg-gray-50">
              <option value="">Seleccionar proveedor</option>
              {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre_comercial}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Fecha (pedido / pago mercadería) <span className="text-red-500">*</span>
            </label>
            <input type="date" value={fechaOrden} onChange={e => setFechaOrden(e.target.value)}
              disabled={esAnulada}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a] disabled:bg-gray-50" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nro. Pedido externo</label>
            <input type="text" value={nroPedidoExterno} onChange={e => setNroPedidoExterno(e.target.value)}
              disabled={esAnulada} placeholder="Opcional"
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a] disabled:bg-gray-50" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Medio de pago (mercadería)</label>
            <select value={medioPagoId} onChange={e => setMedioPagoId(Number(e.target.value))}
              disabled={esAnulada}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a] disabled:bg-gray-50">
              {MEDIOS_PAGO.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Artículos */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Artículos</h2>
        {!esAnulada && (
          <div className="mb-4 relative">
            <label className="block text-xs font-medium text-gray-600 mb-1">Buscar artículo</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input ref={busquedaRef} type="text" value={busqueda}
                onChange={e => setBusqueda(e.target.value)} onKeyDown={handleKeyDown}
                placeholder="Nombre, código, rubro o marca — ej: 'creat ena'"
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]" />
            </div>
            {resultados.length > 0 && (
              <div className="absolute z-10 w-full mt-1 border border-gray-200 rounded bg-white shadow-lg max-h-64 overflow-y-auto">
                {resultados.map((art, i) => (
                  <button key={art.id} type="button" onClick={() => agregarArticulo(art)}
                    className={`w-full text-left px-3 py-2 border-b border-gray-100 last:border-0 text-sm ${
                      i === indiceSeleccionado ? 'bg-[#00a19a]/10' : 'hover:bg-gray-50'
                    }`}>
                    <div className="font-medium text-[#3c3c3b]">{art.nombre}</div>
                    <div className="text-xs text-gray-400">
                      {[art.rubro_nombre, art.marca_nombre, art.codigo_interno, art.codigo_barra].filter(Boolean).join(' · ')}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {items.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm border border-gray-200 rounded">
            {esAnulada ? 'Sin artículos' : 'Usá el buscador para agregar artículos'}
          </div>
        ) : (
          <div className="overflow-x-auto border border-gray-200 rounded">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-3 py-2 text-xs text-gray-600 font-semibold">Artículo</th>
                  <th className="text-center px-3 py-2 text-xs text-gray-600 font-semibold w-20">Cant. Fact.</th>
                  <th className="text-center px-3 py-2 text-xs text-gray-600 font-semibold w-20">Cant. Recib.</th>
                  <th className="text-right px-3 py-2 text-xs text-gray-600 font-semibold w-36">Precio Unit. (c/IVA)</th>
                  <th className="text-right px-3 py-2 text-xs text-gray-600 font-semibold w-28">Desc. %</th>
                  <th className="text-right px-3 py-2 text-xs text-gray-600 font-semibold w-32">Subtotal</th>
                  {distribuirFlete && fleteMonto > 0 && (
                    <th className="text-right px-3 py-2 text-xs text-gray-500 font-semibold w-32">Costo c/flete (c/IVA)</th>
                  )}
                  {!esAnulada && <th className="w-10"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item, index) => {
                  const cf = costoConFlete(item)
                  return (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-[#3c3c3b] font-medium text-xs">{item.articulo_nombre}</td>
                      <td className="px-3 py-2">
                        <input ref={index === items.length - 1 ? cantRef : undefined}
                          type="number" min="0" step="1" value={item.cant_facturada}
                          disabled={esAnulada}
                          onFocus={e => e.target.select()}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); busquedaRef.current?.focus() } }}
                          onChange={e => actualizarItem(index, 'cant_facturada', parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-center text-sm focus:outline-none focus:ring-1 focus:ring-[#00a19a] disabled:bg-gray-50" />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" min="0" step="1" value={item.cant_recibida}
                          disabled={esAnulada} onFocus={e => e.target.select()}
                          onChange={e => actualizarItem(index, 'cant_recibida', parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-center text-sm focus:outline-none focus:ring-1 focus:ring-[#00a19a] disabled:bg-gray-50" />
                      </td>
                      <td className="px-3 py-2">
                        <input type="text" inputMode="decimal"
                          value={precioTexto[index] !== undefined ? precioTexto[index] : fmtInput(item.precio_unitario)}
                          disabled={esAnulada} onFocus={e => e.target.select()}
                          onChange={e => {
                            const raw = e.target.value
                            setPrecioTexto(prev => ({ ...prev, [index]: raw }))
                            actualizarItem(index, 'precio_unitario', parsearMonto(raw))
                          }}
                          onBlur={() => setPrecioTexto(prev => {
                            const next = { ...prev }; delete next[index]; return next
                          })}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-right text-sm focus:outline-none focus:ring-1 focus:ring-[#00a19a] disabled:bg-gray-50" />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" min="0" max="100" step="0.01" value={item.descuento_pct}
                          disabled={esAnulada} onFocus={e => e.target.select()}
                          onChange={e => actualizarItem(index, 'descuento_pct', parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-right text-sm focus:outline-none focus:ring-1 focus:ring-[#00a19a] disabled:bg-gray-50" />
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-[#3c3c3b]">{fmt(item.subtotal)}</td>
                      {distribuirFlete && fleteMonto > 0 && (
                        <td className="px-3 py-2 text-right text-xs text-gray-500">
                          {cf !== null ? fmt(cf) : '—'}
                        </td>
                      )}
                      {!esAnulada && (
                        <td className="px-3 py-2 text-center">
                          <button type="button" onClick={() => eliminarItem(index)}
                            className="text-red-400 hover:text-red-600 p-1">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Flete */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Flete</h2>
        <p className="text-xs text-gray-400 -mt-2 mb-4">
          Cargar solo cuando el flete ya fue pagado. Si todavía no se pagó, dejar en $0.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Monto</label>
            <input type="text" inputMode="decimal"
              value={fleteMontoTexto !== null ? fleteMontoTexto : fmtInput(fleteMonto)}
              disabled={esAnulada}
              onFocus={e => e.target.select()}
              onChange={e => {
                const raw = e.target.value
                setFleteMontoTexto(raw)
                setFleteMonto(parsearMonto(raw))
              }}
              onBlur={() => setFleteMontoTexto(null)}
              placeholder="0,00"
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a] disabled:bg-gray-50" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Fecha de pago del flete</label>
            <input type="date" value={fleteFecha} onChange={e => setFleteFecha(e.target.value)}
              disabled={esAnulada || fleteMonto === 0}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a] disabled:bg-gray-50" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Transportista</label>
            <select value={fleteTransportistaId} onChange={e => setFleteTransportistaId(Number(e.target.value) || '')}
              disabled={esAnulada}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a] disabled:bg-gray-50">
              <option value="">Seleccionar</option>
              {transportistas.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Medio de pago (flete)</label>
            <select value={fleteMedioPagoId} onChange={e => setFleteMedioPagoId(Number(e.target.value))}
              disabled={esAnulada}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a] disabled:bg-gray-50">
              {MEDIOS_PAGO.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
            </select>
          </div>
        </div>
        {!esAnulada && (
          <div className="flex items-center gap-2">
            <input type="checkbox" id="distribuir_flete" checked={distribuirFlete}
              onChange={e => setDistribuirFlete(e.target.checked)}
              className="w-4 h-4 text-[#00a19a] border-gray-300 rounded focus:ring-[#00a19a]" />
            <label htmlFor="distribuir_flete" className="text-xs text-gray-600">
              Distribuir en costo de artículos (proporcional al subtotal de cada uno)
            </label>
          </div>
        )}
      </div>

      {/* Resumen */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Resumen</h2>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Subtotal artículos:</span>
            <span className="font-semibold text-[#3c3c3b]">{fmt(subtotalArticulos)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Flete:</span>
            <span className="font-semibold text-[#3c3c3b]">{fmt(fleteMonto)}</span>
          </div>
          {ajusteExistente && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 italic">Ajuste por redondeo:</span>
              <span className="font-semibold text-amber-600 italic">{fmt(ajusteExistente.subtotal)}</span>
            </div>
          )}
          <div className="flex justify-between text-lg pt-2 border-t border-gray-200">
            <span className="font-bold text-[#3c3c3b]">Total:</span>
            <span className="font-bold text-[#00a19a]">{fmt(totalGeneral + (ajusteExistente?.subtotal || 0))}</span>
          </div>
        </div>
      </div>

      {/* Observaciones */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <label className="block text-xs font-medium text-gray-600 mb-2">Observaciones</label>
        <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)}
          disabled={esAnulada} rows={3} placeholder="Información adicional (opcional)"
          className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a] disabled:bg-gray-50" />
      </div>
    </div>
  )
}
