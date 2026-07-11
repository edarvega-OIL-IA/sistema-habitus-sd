'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

interface ItemPrecio {
  orden_item_id: number
  articulo_id: number
  nombre: string
  costoFinalSinIva: number
  tasaIvaId: number | null
  ivaPct: number
  costoConIva: number
  precioActual: number
  margenActual: number
  precioNuevoTexto: string
  margenNuevoTexto: string
}

// Parseo de montos: coma o punto se interpreta como separador DECIMAL si
// hay 1-2 dígitos después; como separador de MILES si hay 3 o más, o si
// no es el último separador del texto. Mismo criterio usado en el resto
// del sistema (ArticuloForm, Compras, Movimientos).
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

function calcularMargen(precio: number, costoConIva: number): number {
  if (!precio) return 0
  return ((precio - costoConIva) / precio) * 100
}

function calcularPrecioDesdeMargen(margenPct: number, costoConIva: number): number {
  if (margenPct >= 100) return 0 // margen inválido, evita división por 0/negativo
  return costoConIva / (1 - margenPct / 100)
}

export default function RevisionPreciosPage() {
  const params = useParams()
  const ordenId = Number(params.id)

  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [accesoDenegado, setAccesoDenegado] = useState(false)
  const [ordenInfo, setOrdenInfo] = useState<{ fecha: string; proveedor: string } | null>(null)
  const [items, setItems] = useState<ItemPrecio[]>([])
  const [usuarioId, setUsuarioId] = useState<string | null>(null)
  const [guardando, setGuardando] = useState<Set<number>>(new Set())
  const [notif, setNotif] = useState<{ tipo: 'error' | 'ok'; msg: string } | null>(null)

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    const supabase = createClient()
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')

      const { data: usuarioData, error: usuarioError } = await supabase
        .from('usuarios').select('id, rol_id').eq('id', user.id).single()
      if (usuarioError) throw usuarioError

      // Esta pantalla muestra costos — restringida a Admin (rol_id=1).
      if (usuarioData.rol_id !== 1) {
        setAccesoDenegado(true)
        setCargando(false)
        return
      }
      setUsuarioId(usuarioData.id)

      const { data: ordenData, error: ordenError } = await supabase
        .from('ordenes_compra')
        .select('id, fecha_orden, proveedor_id, proveedores ( nombre_comercial )')
        .eq('id', ordenId)
        .single()
      if (ordenError) throw ordenError
      setOrdenInfo({
        fecha: ordenData.fecha_orden?.split('-').reverse().join('/') || '',
        proveedor: (ordenData as any).proveedores?.nombre_comercial || '—',
      })

      const { data: itemsData, error: itemsError } = await supabase
        .from('orden_compra_items')
        .select('id, articulo_id, costo_final_unitario, es_ajuste_redondeo')
        .eq('orden_compra_id', ordenId)
        .eq('es_ajuste_redondeo', false)
        .not('articulo_id', 'is', null)
      if (itemsError) throw itemsError

      const articuloIds = (itemsData || []).map(it => it.articulo_id).filter(Boolean) as number[]

      // Queries separadas + merge por Map — nunca join anidado (RLS).
      const { data: articulosData, error: articulosError } = await supabase
        .from('articulos')
        .select('id, nombre, precio_local, tasa_iva_id')
        .in('id', articuloIds)
      if (articulosError) throw articulosError

      const tasaIds = [...new Set((articulosData || []).map(a => a.tasa_iva_id).filter(Boolean))]
      const { data: tasasData, error: tasasError } = await supabase
        .from('tasas_iva')
        .select('id, porcentaje')
        .in('id', tasaIds as number[])
      if (tasasError) throw tasasError

      const mapArticulos = new Map<number, { id: number; nombre: string; precio_local: number; tasa_iva_id: number | null }>(
        (articulosData || []).map(a => [a.id, a])
      )
      const mapTasas = new Map<number, number>((tasasData || []).map(t => [t.id, t.porcentaje]))

      const itemsArmados: ItemPrecio[] = (itemsData || [])
        .filter(it => it.articulo_id && mapArticulos.has(it.articulo_id))
        .map(it => {
          const art = mapArticulos.get(it.articulo_id!)!
          const ivaPct = mapTasas.get(art.tasa_iva_id) ?? 0
          const costoConIva = (it.costo_final_unitario || 0) * (1 + ivaPct / 100)
          const precioActual = art.precio_local || 0
          const margenActual = calcularMargen(precioActual, costoConIva)
          return {
            orden_item_id: it.id,
            articulo_id: it.articulo_id!,
            nombre: art.nombre,
            costoFinalSinIva: it.costo_final_unitario || 0,
            tasaIvaId: art.tasa_iva_id,
            ivaPct,
            costoConIva,
            precioActual,
            margenActual,
            precioNuevoTexto: fmtMonto(precioActual),
            margenNuevoTexto: margenActual.toFixed(1),
          }
        })

      setItems(itemsArmados)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }

  function actualizarDesdePrecio(idx: number, texto: string) {
    setItems(prev => prev.map((it, i) => {
      if (i !== idx) return it
      const precio = parsearMonto(texto)
      const margen = calcularMargen(precio, it.costoConIva)
      return { ...it, precioNuevoTexto: texto, margenNuevoTexto: precio > 0 ? margen.toFixed(1) : it.margenNuevoTexto }
    }))
  }

  function actualizarDesdeMargen(idx: number, texto: string) {
    setItems(prev => prev.map((it, i) => {
      if (i !== idx) return it
      const margen = parseFloat(texto.replace(',', '.'))
      if (isNaN(margen)) return { ...it, margenNuevoTexto: texto }
      const precio = calcularPrecioDesdeMargen(margen, it.costoConIva)
      return { ...it, margenNuevoTexto: texto, precioNuevoTexto: precio > 0 ? fmtMonto(Math.round(precio)) : it.precioNuevoTexto }
    }))
  }

  async function guardarPrecio(idx: number) {
    const item = items[idx]
    const nuevoPrecio = parsearMonto(item.precioNuevoTexto)
    if (nuevoPrecio <= 0) {
      setNotif({ tipo: 'error', msg: 'El precio debe ser mayor a $0.' })
      return
    }
    setGuardando(prev => new Set(prev).add(item.articulo_id))
    const supabase = createClient()
    try {
      const { error: updError } = await supabase
        .from('articulos')
        .update({ precio_local: nuevoPrecio })
        .eq('id', item.articulo_id)
      if (updError) throw updError

      const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
      // tipo='precio_manual' distingue este origen del 'costo' que genera
      // Compras automáticamente al confirmar una orden — mismo campo,
      // nunca texto libre, para no perder trazabilidad de por qué cambió.
      const { error: histError } = await supabase
        .from('historico_precios')
        .insert({
          articulo_id: item.articulo_id,
          fecha: hoy,
          tipo: 'precio_manual',
          precio_local: nuevoPrecio,
          tasa_iva_id: item.tasaIvaId,
          origen_id: ordenId,
          usuario_id: usuarioId,
        })
      if (histError) throw histError

      setItems(prev => prev.map((it, i) => i === idx
        ? { ...it, precioActual: nuevoPrecio, margenActual: calcularMargen(nuevoPrecio, it.costoConIva) }
        : it))
      setNotif({ tipo: 'ok', msg: `Precio de "${item.nombre}" actualizado a ${fmtMonto(nuevoPrecio)}.` })
    } catch (err: any) {
      setNotif({ tipo: 'error', msg: 'Error al guardar: ' + err.message })
    } finally {
      setGuardando(prev => { const s = new Set(prev); s.delete(item.articulo_id); return s })
    }
  }

  const hayModificados = items.some(it => parsearMonto(it.precioNuevoTexto) !== it.precioActual)

  async function guardarTodosLosModificados() {
    const indices = items
      .map((it, idx) => ({ it, idx }))
      .filter(({ it }) => parsearMonto(it.precioNuevoTexto) !== it.precioActual)
      .map(({ idx }) => idx)
    for (const idx of indices) {
      await guardarPrecio(idx)
    }
  }

  if (cargando) return <p className="text-sm text-gray-500">Cargando revisión de precios...</p>
  if (accesoDenegado) return <p className="text-sm text-red-500">No tenés permiso para ver esta pantalla.</p>
  if (error) return <p className="text-sm text-red-500">Error: {error}</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/compras" className="text-xs text-gray-400 hover:text-[#00a19a] flex items-center gap-1 mb-1">
            <ArrowLeft className="w-3 h-3" /> Volver a Compras
          </Link>
          <h1 className="text-xl font-semibold text-[#3c3c3b]">
            Revisión de precios — Orden #{ordenId}
          </h1>
          <p className="text-xs text-gray-500">
            {ordenInfo?.proveedor} · {ordenInfo?.fecha}
          </p>
        </div>
        {hayModificados && (
          <button
            onClick={guardarTodosLosModificados}
            disabled={guardando.size > 0}
            className="bg-[#00a19a] text-white px-4 py-2 rounded text-sm hover:bg-[#008f89] disabled:opacity-50"
          >
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

      <p className="text-xs text-gray-500 mb-3">
        Por ahora solo se actualiza el precio local (mostrador). Precio web y mayorista se suman más adelante.
      </p>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs text-gray-600 font-semibold">Artículo</th>
              <th className="text-right px-4 py-3 text-xs text-gray-600 font-semibold">Costo c/IVA</th>
              <th className="text-right px-4 py-3 text-xs text-gray-600 font-semibold">Precio actual</th>
              <th className="text-right px-4 py-3 text-xs text-gray-600 font-semibold">Margen actual</th>
              <th className="text-right px-4 py-3 text-xs text-gray-600 font-semibold w-32">Precio nuevo</th>
              <th className="text-right px-4 py-3 text-xs text-gray-600 font-semibold w-24">Margen %</th>
              <th className="px-4 py-3 w-24"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((it, idx) => {
              const precioParsed = parsearMonto(it.precioNuevoTexto)
              const modificado = precioParsed !== it.precioActual
              return (
                <tr key={it.orden_item_id} className={modificado ? 'bg-amber-50' : ''}>
                  <td className="px-4 py-3 text-gray-700">{it.nombre}</td>
                  <td className="px-4 py-3 text-right text-gray-500">${fmtMonto(it.costoConIva)}</td>
                  <td className="px-4 py-3 text-right text-gray-500">${fmtMonto(it.precioActual)}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{it.margenActual.toFixed(1)}%</td>
                  <td className="px-4 py-3 text-right">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={it.precioNuevoTexto}
                      onChange={e => actualizarDesdePrecio(idx, e.target.value)}
                      className="w-28 px-2 py-1 border border-gray-300 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-[#00a19a]"
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={it.margenNuevoTexto}
                      onChange={e => actualizarDesdeMargen(idx, e.target.value)}
                      className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-[#00a19a]"
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => guardarPrecio(idx)}
                      disabled={!modificado || guardando.has(it.articulo_id)}
                      className="text-xs bg-[#00a19a] text-white px-3 py-1.5 rounded hover:bg-[#008f89] disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      {guardando.has(it.articulo_id) ? '...' : 'Guardar'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
