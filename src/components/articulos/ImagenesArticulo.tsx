// Ruta destino: C:\Users\Usuario\Documents\sistema-habitus-sd\src\components\articulos\ImagenesArticulo.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Star, Trash2, Upload } from 'lucide-react'

interface Imagen {
  id: number
  url: string
  orden: number
  es_principal: boolean
}

const BUCKET = 'articulo-imagenes'

export default function ImagenesArticulo({ articuloId }: { articuloId: number }) {
  const [imagenes, setImagenes] = useState<Imagen[]>([])
  const [cargando, setCargando] = useState(true)
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { cargarImagenes() }, [articuloId])

  async function cargarImagenes() {
    setCargando(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('articulo_imagenes')
      .select('id, url, orden, es_principal')
      .eq('articulo_id', articuloId)
      .order('es_principal', { ascending: false })
      .order('orden', { ascending: true })
    setImagenes(data || [])
    setCargando(false)
  }

  async function subirArchivos(files: FileList | null) {
    if (!files || files.length === 0) return
    setSubiendo(true)
    setError(null)
    const supabase = createClient()

    for (const file of Array.from(files)) {
      const extension = file.name.split('.').pop()
      const nombreArchivo = `${articuloId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(nombreArchivo, file, { cacheControl: '3600', upsert: false })

      if (uploadError) {
        setError('Error al subir ' + file.name + ': ' + uploadError.message)
        continue
      }

      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(nombreArchivo)

      await supabase.from('articulo_imagenes').insert({
        articulo_id: articuloId,
        url: urlData.publicUrl,
        orden: imagenes.length,
        es_principal: imagenes.length === 0, // la primera que se sube queda como principal
      })
    }

    setSubiendo(false)
    if (inputRef.current) inputRef.current.value = ''
    cargarImagenes()
  }

  async function marcarPrincipal(id: number) {
    const supabase = createClient()
    // Solo puede haber una principal por artículo
    await supabase.from('articulo_imagenes').update({ es_principal: false }).eq('articulo_id', articuloId)
    await supabase.from('articulo_imagenes').update({ es_principal: true }).eq('id', id)
    cargarImagenes()
  }

  async function eliminar(imagen: Imagen) {
    if (!window.confirm('¿Eliminar esta foto?')) return
    const supabase = createClient()
    // Path dentro del bucket = todo lo que sigue a "/articulo-imagenes/" en la URL pública
    const marcador = `/${BUCKET}/`
    const idx = imagen.url.indexOf(marcador)
    if (idx !== -1) {
      const path = imagen.url.slice(idx + marcador.length)
      await supabase.storage.from(BUCKET).remove([path])
    }
    await supabase.from('articulo_imagenes').delete().eq('id', imagen.id)
    cargarImagenes()
  }

  if (cargando) return <p className="text-xs text-gray-400">Cargando fotos...</p>

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">Fotos</label>

      {imagenes.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mb-3">
          {imagenes.map(img => (
            <div key={img.id} className="relative group border border-gray-200 rounded-lg overflow-hidden aspect-square bg-gray-50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt="" className="w-full h-full object-cover" />
              {img.es_principal && (
                <span className="absolute top-1 left-1 bg-[#00a19a] text-white text-[9px] font-semibold px-1.5 py-0.5 rounded">
                  Principal
                </span>
              )}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                {!img.es_principal && (
                  <button
                    type="button"
                    onClick={() => marcarPrincipal(img.id)}
                    title="Marcar como principal"
                    className="bg-white rounded-full p-1.5 hover:bg-[#00a19a] hover:text-white transition-colors"
                  >
                    <Star className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => eliminar(img)}
                  title="Eliminar"
                  className="bg-white rounded-full p-1.5 hover:bg-red-500 hover:text-white transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <label className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-lg py-4 text-sm text-gray-500 hover:border-[#00a19a] hover:text-[#00a19a] cursor-pointer transition-colors">
        <Upload className="w-4 h-4" />
        {subiendo ? 'Subiendo...' : 'Subir foto (podés elegir varias)'}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          disabled={subiendo}
          onChange={e => subirArchivos(e.target.files)}
          className="hidden"
        />
      </label>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      <p className="text-xs text-gray-400 mt-1">La primera foto que subas queda como principal — después podés cambiarla pasando el mouse por encima y tocando la estrella.</p>
    </div>
  )
}
