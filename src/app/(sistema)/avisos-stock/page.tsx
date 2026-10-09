// Ruta destino: C:\Users\Usuario\Documents\sistema-habitus-sd\src\app\(sistema)\avisos-stock\page.tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { armarSlugProducto } from '@/lib/slug'
import { normalizarWhatsapp } from '@/lib/whatsapp'
import { MessageCircle, Mail, Check, Trash2, Undo2 } from 'lucide-react'

interface Aviso {
  id: number
  articulo_id: number
  medio_preferido: 'whatsapp' | 'email' | 'ambos'
  whatsapp: string | null
  email: string | null
  creado_en: string
  avisado: boolean
  avisado_en: string | null
}

interface Articulo {
  id: number
  nombre: string
  nombre_base: string | null
}

interface Grupo {
  articuloId: number
  articulo: Articulo | undefined
  stock: number
  avisos: Aviso[]
  ultimoAvisoEn: string // solo se usa para ordenar la solapa Avisados
}

type Solapa = 'pendientes' | 'avisados'

const URL_TIENDA = 'https://www.habitussd.com'

function soloDigitos(s: string): string {
  return s.replace(/\D/g, '')
}

// Mismo criterio de búsqueda que el resto del sistema: tokenizada, sin
// acentos/mayúsculas (ver Artículos, Actualizar Precios, tienda/page.tsx)
function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function fmtFecha(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })
}

export default function AvisosStockPage() {
  const [loading, setLoading] = useState(true)
  const [avisos, setAvisos] = useState<Aviso[]>([])
  const [articulosMap, setArticulosMap] = useState<Map<number, Articulo>>(new Map())
  const [stockMap, setStockMap] = useState<Map<number, number>>(new Map())
  const [trabajando, setTrabajando] = useState<number | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [orden, setOrden] = useState<'stock' | 'cantidad'>('stock')
  const [solapa, setSolapa] = useState<Solapa>('pendientes')
  const [esAdmin, setEsAdmin] = useState(false)
  const [notif, setNotif] = useState<{ tipo: 'error' | 'ok'; msg: string } | null>(null)

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    setLoading(true)
    const supabase = createClient()

    // Borrar es solo para el Admin (rol_id = 1, mismo criterio que
    // Actualizar Precios). Mientras no haya permisos por pantalla/acción,
    // Agustín también figura como Admin.
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: usuarioData } = await supabase
        .from('usuarios').select('rol_id').eq('id', user.id).single()
      setEsAdmin(usuarioData?.rol_id === 1)
    }

    const { data: avisosData } = await supabase
      .from('avisos_stock')
      .select('id, articulo_id, medio_preferido, whatsapp, email, creado_en, avisado, avisado_en')
      .order('creado_en', { ascending: true })
    setAvisos(avisosData || [])

    if (avisosData && avisosData.length > 0) {
      const articuloIds = [...new Set(avisosData.map(a => a.articulo_id))]

      const { data: articulosData } = await supabase
        .from('articulos')
        .select('id, nombre, nombre_base')
        .in('id', articuloIds)
      setArticulosMap(new Map((articulosData || []).map(a => [a.id, a])))

      // Stock separado (tabla articulo_stock, no una columna en articulos) —
      // sumado por las dudas de que en algún momento haya más de una sucursal.
      const { data: stockData } = await supabase
        .from('articulo_stock')
        .select('articulo_id, stock_actual')
        .in('articulo_id', articuloIds)
      const nuevoStockMap = new Map<number, number>()
      for (const fila of stockData || []) {
        nuevoStockMap.set(fila.articulo_id, (nuevoStockMap.get(fila.articulo_id) || 0) + (fila.stock_actual || 0))
      }
      setStockMap(nuevoStockMap)
    }

    setLoading(false)
  }

  async function marcarAvisado(avisoId: number) {
    setTrabajando(avisoId)
    const supabase = createClient()
    const ahora = new Date().toISOString()
    const { error } = await supabase
      .from('avisos_stock')
      .update({ avisado: true, avisado_en: ahora })
      .eq('id', avisoId)
    if (error) {
      setNotif({ tipo: 'error', msg: 'No se pudo marcar como avisado: ' + error.message })
    } else {
      setAvisos(prev => prev.map(a => a.id === avisoId ? { ...a, avisado: true, avisado_en: ahora } : a))
    }
    setTrabajando(null)
  }

  async function marcarTodosDelGrupo(grupo: Grupo) {
    const supabase = createClient()
    const ids = grupo.avisos.map(a => a.id)
    const ahora = new Date().toISOString()
    const { error } = await supabase
      .from('avisos_stock')
      .update({ avisado: true, avisado_en: ahora })
      .in('id', ids)
    if (error) {
      setNotif({ tipo: 'error', msg: 'No se pudo marcar como avisados: ' + error.message })
      return
    }
    setAvisos(prev => prev.map(a => ids.includes(a.id) ? { ...a, avisado: true, avisado_en: ahora } : a))
  }

  async function volverAPendiente(aviso: Aviso) {
    setTrabajando(aviso.id)
    const supabase = createClient()
    const { error } = await supabase
      .from('avisos_stock')
      .update({ avisado: false, avisado_en: null })
      .eq('id', aviso.id)
    if (error) {
      // 23505 = índice único parcial: esa persona ya tiene otro aviso
      // pendiente para el mismo producto (volvió a pedirlo después de ser avisada).
      if (error.code === '23505') {
        setNotif({
          tipo: 'error',
          msg: 'Esa persona ya tiene un aviso pendiente para este producto (volvió a pedirlo). Podés eliminar este aviso viejo.',
        })
      } else {
        setNotif({ tipo: 'error', msg: 'No se pudo volver a pendiente: ' + error.message })
      }
    } else {
      setAvisos(prev => prev.map(a => a.id === aviso.id ? { ...a, avisado: false, avisado_en: null } : a))
      setNotif({ tipo: 'ok', msg: 'El aviso volvió a Pendientes.' })
    }
    setTrabajando(null)
  }

  // Borrado definitivo. Solo Admin (el botón no se muestra a otros, y
  // además se vuelve a chequear acá). .select('id') para detectar si RLS
  // dejó 0 filas borradas sin dar error.
  async function eliminarAvisos(ids: number[], descripcion: string) {
    if (!esAdmin || ids.length === 0) return
    const ok = window.confirm(`¿Eliminar definitivamente ${descripcion}?\n\nEsta acción no se puede deshacer.`)
    if (!ok) return

    const supabase = createClient()
    const { data, error } = await supabase
      .from('avisos_stock')
      .delete()
      .in('id', ids)
      .select('id')
    if (error) {
      setNotif({ tipo: 'error', msg: 'No se pudo eliminar: ' + error.message })
      return
    }
    const borrados = new Set((data || []).map(d => d.id))
    if (borrados.size === 0) {
      setNotif({ tipo: 'error', msg: 'No se eliminó nada (sin permiso o el aviso ya no existe).' })
      return
    }
    setAvisos(prev => prev.filter(a => !borrados.has(a.id)))
    setNotif({ tipo: 'ok', msg: borrados.size === 1 ? 'Aviso eliminado.' : `${borrados.size} avisos eliminados.` })
  }

  function linkProducto(articulo: Articulo): string {
    const titulo = articulo.nombre
    return `${URL_TIENDA}/tienda/producto/${armarSlugProducto(articulo.id, titulo)}`
  }

  function mensajeWhatsapp(articulo: Articulo): string {
    const titulo = articulo.nombre
    return `Hola! Te escribimos porque nos pediste que te avisemos cuando tengamos stock de *${titulo}*\n\nPodés adquirirlo en Av. Roca 54 - Cinco Saltos o en nuestra página web\n${linkProducto(articulo)}\n\nGracias por elegirnos\n*Hábitus SD* - *Presentes en tu proceso*`
  }

  function linkWhatsapp(whatsapp: string, articulo: Articulo): string {
    // Los números se guardan normalizados ("+5492995741735", ver src/lib/whatsapp.ts),
    // así que NO hay que volver a anteponer 549 (bug 08/10/2026: generaba
    // 5495492996204144). normalizarWhatsapp respeta lo que ya viene con "+" y
    // además arregla los números viejos guardados sin código de país.
    // wa.me quiere solo dígitos, sin "+".
    const normalizado = normalizarWhatsapp(whatsapp)
    const numero = soloDigitos(normalizado ?? whatsapp)
    return `https://wa.me/${numero}?text=${encodeURIComponent(mensajeWhatsapp(articulo))}`
  }

  // Compose web de Gmail en vez de mailto: — mailto: depende de cuál sea el
  // cliente de mail predeterminado de Windows (en la práctica, Outlook sin
  // configurar, que tira error). Esto abre directo en el navegador.
  function linkMailtoGrupo(grupo: Grupo): string {
    const emails = grupo.avisos.filter(a => a.email).map(a => a.email as string)
    const titulo = grupo.articulo ? grupo.articulo.nombre : ''
    const asunto = `¡Ya hay stock de ${titulo}! — Hábitus SD`
    const cuerpo = grupo.articulo
      ? `Hola!\n\nTe escribimos porque nos pediste que te avisemos cuando tengamos stock de ${titulo}\n\nPodés adquirirlo en Av. Roca 54 - Cinco Saltos o en nuestra página web\n${linkProducto(grupo.articulo)}\n\nGracias por elegirnos\nHábitus SD - Presentes en tu proceso`
      : ''
    const params = new URLSearchParams({ view: 'cm', fs: '1', bcc: emails.join(','), su: asunto, body: cuerpo })
    return `https://mail.google.com/mail/?${params.toString()}`
  }

  const cantPendientes = avisos.filter(a => !a.avisado).length
  const cantAvisados = avisos.filter(a => a.avisado).length
  const enPendientes = solapa === 'pendientes'

  const grupos: Grupo[] = (() => {
    const mapa = new Map<number, Grupo>()
    for (const aviso of avisos) {
      if (aviso.avisado === enPendientes) continue // pendientes: avisado=false; avisados: avisado=true
      const existente = mapa.get(aviso.articulo_id)
      if (existente) {
        existente.avisos.push(aviso)
      } else {
        mapa.set(aviso.articulo_id, {
          articuloId: aviso.articulo_id,
          articulo: articulosMap.get(aviso.articulo_id),
          stock: stockMap.get(aviso.articulo_id) ?? 0,
          avisos: [aviso],
          ultimoAvisoEn: '',
        })
      }
    }

    let lista = [...mapa.values()]

    for (const g of lista) {
      if (!enPendientes) {
        // Avisados: el último en ser avisado primero
        g.avisos.sort((a, b) => (b.avisado_en || '').localeCompare(a.avisado_en || ''))
        g.ultimoAvisoEn = g.avisos[0]?.avisado_en || ''
      }
    }

    if (busqueda.trim()) {
      const textoBuscado = normalizar(busqueda.trim())
      lista = lista.filter(g => {
        const nombre = g.articulo ? (g.articulo.nombre) : ''
        return normalizar(nombre).includes(textoBuscado)
      })
    }

    return lista.sort((a, b) => {
      const nombreA = a.articulo ? (a.articulo.nombre) : ''
      const nombreB = b.articulo ? (b.articulo.nombre) : ''

      if (!enPendientes) {
        // Avisados: los avisados más recientemente arriba
        if (a.ultimoAvisoEn !== b.ultimoAvisoEn) return b.ultimoAvisoEn.localeCompare(a.ultimoAvisoEn)
        return nombreA.localeCompare(nombreB)
      }

      if (orden === 'cantidad') {
        if (a.avisos.length !== b.avisos.length) return b.avisos.length - a.avisos.length
        return nombreA.localeCompare(nombreB)
      }

      // orden === 'stock': con stock disponible primero
      const listoA = a.stock > 0 ? 0 : 1
      const listoB = b.stock > 0 ? 0 : 1
      if (listoA !== listoB) return listoA - listoB
      return nombreA.localeCompare(nombreB)
    })
  })()

  if (loading) return <div className="p-6 text-sm text-gray-500">Cargando...</div>

  const botonSolapa = (id: Solapa, texto: string, cant: number) => (
    <button
      type="button"
      onClick={() => setSolapa(id)}
      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
        solapa === id
          ? 'border-[#00a19a] text-[#00a19a]'
          : 'border-transparent text-gray-500 hover:text-gray-700'
      }`}
    >
      {texto} <span className="text-xs opacity-70">({cant})</span>
    </button>
  )

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-[#3c3c3b]">Avisos de Stock</h1>
        <p className="text-sm text-gray-500 mt-1">
          {enPendientes
            ? 'Gente que pidió que le avisemos cuando vuelva a haber stock de un producto. Los que ya tienen stock disponible aparecen primero.'
            : 'Gente a la que ya se le avisó. Quedan acá como historial, agrupados por producto.'}
        </p>
      </div>

      {notif && (
        <div className={`rounded-lg border px-4 py-3 flex items-center justify-between gap-3 mb-4 ${
          notif.tipo === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'
        }`}>
          <p className="text-sm font-medium">{notif.msg}</p>
          <button onClick={() => setNotif(null)} className="opacity-50 hover:opacity-100 text-lg leading-none">✕</button>
        </div>
      )}

      <div className="flex border-b border-gray-200 mb-4">
        {botonSolapa('pendientes', 'Pendientes', cantPendientes)}
        {botonSolapa('avisados', 'Avisados', cantAvisados)}
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Buscar producto..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]"
        />
        {enPendientes && (
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setOrden('stock')}
              className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
                orden === 'stock' ? 'bg-[#00a19a] text-white border-[#00a19a]' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
            >
              Con stock primero
            </button>
            <button
              type="button"
              onClick={() => setOrden('cantidad')}
              className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
                orden === 'cantidad' ? 'bg-[#00a19a] text-white border-[#00a19a]' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
            >
              Más gente esperando
            </button>
          </div>
        )}
      </div>

      {grupos.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-sm text-gray-500">
          {busqueda.trim()
            ? 'No hay productos que coincidan con la búsqueda.'
            : enPendientes
              ? 'No hay avisos pendientes. 🎉'
              : 'Todavía no hay avisos marcados como avisados.'}
        </div>
      ) : (
        <div className="space-y-4">
          {grupos.map(grupo => {
            const stock = grupo.stock
            const hayStock = stock > 0
            const titulo = grupo.articulo ? (grupo.articulo.nombre) : `Artículo #${grupo.articuloId}`
            const tieneEmails = grupo.avisos.some(a => a.email)
            const idsGrupo = grupo.avisos.map(a => a.id)

            return (
              <div key={grupo.articuloId} className={`bg-white rounded-lg border p-4 ${enPendientes && hayStock ? 'border-[#00a19a]' : 'border-gray-200'}`}>
                <div className="flex items-start justify-between flex-wrap gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[#3c3c3b]">{titulo}</span>
                      {enPendientes && (hayStock ? (
                        <span className="text-xs bg-[#00a19a]/10 text-[#00a19a] px-2 py-0.5 rounded-full font-medium">
                          Hay stock ({stock})
                        </span>
                      ) : (
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Todavía sin stock</span>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {enPendientes
                        ? `${grupo.avisos.length} ${grupo.avisos.length === 1 ? 'persona esperando' : 'personas esperando'}`
                        : `${grupo.avisos.length} ${grupo.avisos.length === 1 ? 'persona avisada' : 'personas avisadas'}`}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    {enPendientes && tieneEmails && (
                      <a
                        href={linkMailtoGrupo(grupo)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-700 px-3 py-1.5 rounded text-xs font-medium hover:bg-gray-200 transition-colors border border-gray-300"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        Mail a todos
                      </a>
                    )}
                    {enPendientes && (
                      <button
                        type="button"
                        onClick={() => marcarTodosDelGrupo(grupo)}
                        className="inline-flex items-center gap-1.5 bg-[#00a19a] text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-[#008f89] transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Marcar todos avisados
                      </button>
                    )}
                    {esAdmin && (
                      <button
                        type="button"
                        onClick={() => eliminarAvisos(
                          idsGrupo,
                          `los ${idsGrupo.length} ${enPendientes ? 'avisos pendientes' : 'avisos'} de "${titulo}"`
                        )}
                        className="inline-flex items-center gap-1.5 bg-white text-red-600 px-3 py-1.5 rounded text-xs font-medium border border-red-200 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Eliminar todos
                      </button>
                    )}
                  </div>
                </div>

                <div className="divide-y divide-gray-100 border-t border-gray-100">
                  {grupo.avisos.map(aviso => {
                    const contacto = [aviso.whatsapp, aviso.email].filter(Boolean).join(' · ') || 'sin datos'
                    return (
                      <div key={aviso.id} className="flex items-center justify-between flex-wrap gap-2 py-2">
                        <div className="text-sm text-gray-600">
                          {aviso.whatsapp && <span>{aviso.whatsapp}</span>}
                          {aviso.whatsapp && aviso.email && <span className="text-gray-300 mx-1.5">·</span>}
                          {aviso.email && <span>{aviso.email}</span>}
                          <span className="text-gray-400 text-xs ml-2">
                            pidió el {fmtFecha(aviso.creado_en)}
                            {!enPendientes && <> · avisado el {fmtFecha(aviso.avisado_en)}</>}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          {enPendientes && aviso.whatsapp && grupo.articulo && (
                            <a
                              href={linkWhatsapp(aviso.whatsapp, grupo.articulo)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-[#25D366] hover:underline font-medium"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              WhatsApp
                            </a>
                          )}
                          {enPendientes ? (
                            <button
                              type="button"
                              onClick={() => marcarAvisado(aviso.id)}
                              disabled={trabajando === aviso.id}
                              className="text-xs text-gray-400 hover:text-[#00a19a] transition-colors disabled:opacity-40"
                            >
                              Marcar avisado
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => volverAPendiente(aviso)}
                              disabled={trabajando === aviso.id}
                              className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-[#00a19a] transition-colors disabled:opacity-40"
                            >
                              <Undo2 className="w-3.5 h-3.5" />
                              Volver a pendiente
                            </button>
                          )}
                          {esAdmin && (
                            <button
                              type="button"
                              onClick={() => eliminarAvisos([aviso.id], `el aviso de ${contacto} para "${titulo}"`)}
                              title="Eliminar definitivamente"
                              className="text-gray-300 hover:text-red-600 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
