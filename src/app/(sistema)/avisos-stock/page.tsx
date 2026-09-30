// Ruta destino: C:\Users\Usuario\Documents\sistema-habitus-sd\src\app\(sistema)\avisos-stock\page.tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { armarSlugProducto } from '@/lib/slug'
import { MessageCircle, Mail, Check } from 'lucide-react'

interface Aviso {
  id: number
  articulo_id: number
  medio_preferido: 'whatsapp' | 'email' | 'ambos'
  whatsapp: string | null
  email: string | null
  creado_en: string
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
}

const URL_TIENDA = 'https://www.habitussd.com'

function soloDigitos(s: string): string {
  return s.replace(/\D/g, '')
}

export default function AvisosStockPage() {
  const [loading, setLoading] = useState(true)
  const [avisos, setAvisos] = useState<Aviso[]>([])
  const [articulosMap, setArticulosMap] = useState<Map<number, Articulo>>(new Map())
  const [stockMap, setStockMap] = useState<Map<number, number>>(new Map())
  const [marcando, setMarcando] = useState<number | null>(null)

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    setLoading(true)
    const supabase = createClient()

    const { data: avisosData } = await supabase
      .from('avisos_stock')
      .select('id, articulo_id, medio_preferido, whatsapp, email, creado_en')
      .eq('avisado', false)
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
    setMarcando(avisoId)
    const supabase = createClient()
    await supabase
      .from('avisos_stock')
      .update({ avisado: true, avisado_en: new Date().toISOString() })
      .eq('id', avisoId)
    setAvisos(prev => prev.filter(a => a.id !== avisoId))
    setMarcando(null)
  }

  async function marcarTodosDelGrupo(grupo: Grupo) {
    const supabase = createClient()
    const ids = grupo.avisos.map(a => a.id)
    await supabase
      .from('avisos_stock')
      .update({ avisado: true, avisado_en: new Date().toISOString() })
      .in('id', ids)
    setAvisos(prev => prev.filter(a => !ids.includes(a.id)))
  }

  function linkProducto(articulo: Articulo): string {
    const titulo = articulo.nombre_base || articulo.nombre
    return `${URL_TIENDA}/tienda/producto/${armarSlugProducto(articulo.id, titulo)}`
  }

  function mensajeWhatsapp(articulo: Articulo): string {
    const titulo = articulo.nombre_base || articulo.nombre
    return `Hola! Te escribimos de Hábitus SD porque nos pediste que te avisemos cuando vuelva a haber stock de "${titulo}" — ¡ya llegó! 🎉\n\nLo podés ver acá: ${linkProducto(articulo)}`
  }

  function linkWhatsapp(whatsapp: string, articulo: Articulo): string {
    // wa.me para Argentina necesita 54 9 <código de área><número>, sin el 0
    // ni el 15 que la gente suele anteponer al escribir su número a mano.
    let numero = soloDigitos(whatsapp)
    if (numero.startsWith('0')) numero = numero.slice(1)
    if (numero.startsWith('15')) numero = numero.slice(2)
    return `https://wa.me/549${numero}?text=${encodeURIComponent(mensajeWhatsapp(articulo))}`
  }

  function linkMailtoGrupo(grupo: Grupo): string {
    const emails = grupo.avisos.filter(a => a.email).map(a => a.email as string)
    const titulo = grupo.articulo ? (grupo.articulo.nombre_base || grupo.articulo.nombre) : ''
    const asunto = `¡Ya hay stock de ${titulo}! — Hábitus SD`
    const cuerpo = grupo.articulo
      ? `Hola!\n\nTe escribimos porque nos pediste que te avisemos cuando vuelva a haber stock de "${titulo}" — ¡ya llegó! 🎉\n\nLo podés ver acá: ${linkProducto(grupo.articulo)}\n\nSaludos,\nHábitus SD`
      : ''
    return `mailto:?bcc=${encodeURIComponent(emails.join(','))}&subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`
  }

  const grupos: Grupo[] = (() => {
    const mapa = new Map<number, Grupo>()
    for (const aviso of avisos) {
      const existente = mapa.get(aviso.articulo_id)
      if (existente) {
        existente.avisos.push(aviso)
      } else {
        mapa.set(aviso.articulo_id, {
          articuloId: aviso.articulo_id,
          articulo: articulosMap.get(aviso.articulo_id),
          stock: stockMap.get(aviso.articulo_id) ?? 0,
          avisos: [aviso],
        })
      }
    }
    return [...mapa.values()].sort((a, b) => {
      const listoA = a.stock > 0 ? 0 : 1
      const listoB = b.stock > 0 ? 0 : 1
      if (listoA !== listoB) return listoA - listoB
      const nombreA = a.articulo ? (a.articulo.nombre_base || a.articulo.nombre) : ''
      const nombreB = b.articulo ? (b.articulo.nombre_base || b.articulo.nombre) : ''
      return nombreA.localeCompare(nombreB)
    })
  })()

  if (loading) return <div className="p-6 text-sm text-gray-500">Cargando...</div>

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[#3c3c3b]">Avisos de Stock</h1>
        <p className="text-sm text-gray-500 mt-1">
          Gente que pidió que le avisemos cuando vuelva a haber stock de un producto. Los que ya tienen stock disponible aparecen primero.
        </p>
      </div>

      {grupos.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-sm text-gray-500">
          No hay avisos pendientes. 🎉
        </div>
      ) : (
        <div className="space-y-4">
          {grupos.map(grupo => {
            const stock = grupo.stock
            const hayStock = stock > 0
            const titulo = grupo.articulo ? (grupo.articulo.nombre_base || grupo.articulo.nombre) : `Artículo #${grupo.articuloId}`
            const tieneEmails = grupo.avisos.some(a => a.email)

            return (
              <div key={grupo.articuloId} className={`bg-white rounded-lg border p-4 ${hayStock ? 'border-[#00a19a]' : 'border-gray-200'}`}>
                <div className="flex items-start justify-between flex-wrap gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[#3c3c3b]">{titulo}</span>
                      {hayStock ? (
                        <span className="text-xs bg-[#00a19a]/10 text-[#00a19a] px-2 py-0.5 rounded-full font-medium">
                          Hay stock ({stock})
                        </span>
                      ) : (
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Todavía sin stock</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {grupo.avisos.length} {grupo.avisos.length === 1 ? 'persona esperando' : 'personas esperando'}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    {tieneEmails && (
                      <a
                        href={linkMailtoGrupo(grupo)}
                        className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-700 px-3 py-1.5 rounded text-xs font-medium hover:bg-gray-200 transition-colors border border-gray-300"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        Mail a todos
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => marcarTodosDelGrupo(grupo)}
                      className="inline-flex items-center gap-1.5 bg-[#00a19a] text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-[#008f89] transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Marcar todos avisados
                    </button>
                  </div>
                </div>

                <div className="divide-y divide-gray-100 border-t border-gray-100">
                  {grupo.avisos.map(aviso => (
                    <div key={aviso.id} className="flex items-center justify-between flex-wrap gap-2 py-2">
                      <div className="text-sm text-gray-600">
                        {aviso.whatsapp && <span>{aviso.whatsapp}</span>}
                        {aviso.whatsapp && aviso.email && <span className="text-gray-300 mx-1.5">·</span>}
                        {aviso.email && <span>{aviso.email}</span>}
                        <span className="text-gray-400 text-xs ml-2">
                          pidió el {new Date(aviso.creado_en).toLocaleDateString('es-AR')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {aviso.whatsapp && grupo.articulo && (
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
                        <button
                          type="button"
                          onClick={() => marcarAvisado(aviso.id)}
                          disabled={marcando === aviso.id}
                          className="text-xs text-gray-400 hover:text-[#00a19a] transition-colors disabled:opacity-40"
                        >
                          Marcar avisado
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
