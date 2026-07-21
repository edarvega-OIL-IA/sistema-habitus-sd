'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Save, X } from 'lucide-react'

const articuloSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido'),
  nombre_base: z.string().nullable().optional(),
  rubro_id: z.number().min(1, 'El rubro es requerido'),
  marca_id: z.number().min(1, 'La marca es requerida'),
  codigo_interno: z.string().nullable().optional(),
  codigo_barra: z.string().nullable().optional(),
  sku: z.string().nullable().optional(),
  unidad_medida_id: z.number().nullable().optional(),
  costo_sin_iva: z.number().nullable().optional(),
  tasa_iva_id: z.number().nullable().optional(),
  precio_local: z.number().min(0).nullable().optional(),
  precio_web: z.number().min(0).nullable().optional(),
  precio_mayorista: z.number().min(0).nullable().optional(),
  precio_oferta_web: z.number().min(0).nullable().optional(),
  disponible_local: z.boolean(),
  disponible_web: z.boolean(),
  visible_en_tienda: z.boolean(),
  atributo_nombre: z.string().nullable().optional(),
  atributo_valor: z.string().nullable().optional(),
  peso_kg: z.number().min(0).nullable().optional(),
  descripcion: z.string().nullable().optional(),
})

type ArticuloFormData = z.infer<typeof articuloSchema>

interface ArticuloFormProps {
  articuloId?: number
}

export default function ArticuloForm({ articuloId }: ArticuloFormProps) {
  const router = useRouter()
  const [nombreOrigenDuplicado, setNombreOrigenDuplicado] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [solapaActiva, setSolapaActiva] = useState(0)
  const [rolUsuario, setRolUsuario] = useState<number | null>(null)
  const [rubros, setRubros] = useState<any[]>([])
  const [marcas, setMarcas] = useState<any[]>([])
  const [unidadesMedida, setUnidadesMedida] = useState<any[]>([])
  const [tasasIva, setTasasIva] = useState<any[]>([])
  const [utilidad, setUtilidad] = useState<string>('')
  const [diferenciaPorcentualWeb, setDiferenciaPorcentualWeb] = useState<number>(0)
  const [costoConIva, setCostoConIva] = useState<string>('')
  // Texto crudo en edición para inputs que muestran directamente el número
  // del formulario (sin esto, la coma/punto decimal se borra al tipear)
  const [costoSinIvaTexto, setCostoSinIvaTexto] = useState<string | null>(null)
  const [precioLocalTexto, setPrecioLocalTexto] = useState<string | null>(null)
  const [precioWebTexto, setPrecioWebTexto] = useState<string | null>(null)
  const [tasaPct, setTasaPct] = useState<number>(21)
  const [idTasa21, setIdTasa21] = useState<number | null>(null)
  const [idUnidadDefault, setIdUnidadDefault] = useState<number | null>(null)
  // Para saber si precio_local realmente cambió (y así decidir si hay que
  // dejar rastro en historico_precios) y quién hace el cambio.
  const [precioLocalOriginal, setPrecioLocalOriginal] = useState<number | null>(null)
  const [usuarioId, setUsuarioId] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors }, setValue, watch, reset } = useForm<ArticuloFormData>({
    resolver: zodResolver(articuloSchema),
    defaultValues: {
      disponible_local: true,
      disponible_web: false,
      visible_en_tienda: false,
    }
  })

  const costoSinIva = watch('costo_sin_iva')
  const precioLocal = watch('precio_local')
  const precioWeb = watch('precio_web')
  const tasaIvaId = watch('tasa_iva_id')

  useEffect(() => { cargarDatosIniciales() }, [])

  useEffect(() => {
    if (costoSinIva && precioLocal && costoSinIva > 0) {
      const precioSinIva = precioLocal / (1 + tasaPct / 100)
      setUtilidad(((precioSinIva - costoSinIva) / costoSinIva * 100).toFixed(2).replace('.', ','))
    } else {
      setUtilidad('')
    }
  }, [costoSinIva, precioLocal])

  useEffect(() => {
    if (costoSinIva && costoSinIva > 0) {
      setCostoConIva((costoSinIva * (1 + tasaPct / 100)).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
    } else {
      setCostoConIva('')
    }
  }, [costoSinIva, tasaPct])

  useEffect(() => {
    if (tasaIvaId && tasasIva.length > 0) {
      const tasa = tasasIva.find((t: any) => t.id === tasaIvaId)
      if (tasa) setTasaPct(tasa.porcentaje)
    }
  }, [tasaIvaId, tasasIva])

  useEffect(() => {
    if (articuloId && precioLocal && precioWeb && diferenciaPorcentualWeb === 0) {
      setDiferenciaPorcentualWeb(((precioWeb - precioLocal) / precioLocal) * 100)
    }
  }, [precioLocal, precioWeb, articuloId])

  async function cargarDatosIniciales() {
    const supabase = createClient()
    // Solo tiene sentido en el alta (no editando uno existente): ?duplicar=<id>
    // Se lee acá directo (no con useSearchParams) para no forzar un Suspense
    // boundary en la página que usa este formulario, y para evitar que quede
    // desactualizado por la carrera entre efectos que corren en el montaje.
    const duplicarDeId = !articuloId && typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('duplicar')
      : null
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUsuarioId(user.id)
        const { data: usuarioData } = await supabase
          .from('usuarios').select('rol_id').eq('id', user.id).single()
        if (usuarioData) setRolUsuario(usuarioData.rol_id)
      }

      const [rubrosRes, marcasRes, unidadesRes, ivasRes] = await Promise.all([
        supabase.from('rubros').select('id, nombre').eq('activo', true).order('nombre'),
        supabase.from('marcas').select('id, nombre').eq('activo', true).order('nombre'),
        supabase.from('unidades_medida').select('id, nombre, abreviatura').order('nombre'),
        supabase.from('tasas_iva').select('id, nombre, porcentaje').eq('activo', true).order('porcentaje'),
      ])

      setRubros(rubrosRes.data || [])
      setMarcas(marcasRes.data || [])
      setUnidadesMedida(unidadesRes.data || [])
      setTasasIva(ivasRes.data || [])

      if (ivasRes.data) {
        const tasa21 = ivasRes.data.find((t: any) => t.porcentaje === 21)
        if (tasa21) {
          setIdTasa21(tasa21.id)
          if (!articuloId) setValue('tasa_iva_id', tasa21.id)
        }
      }

      if (unidadesRes.data) {
        const unidad = unidadesRes.data.find((u: any) => u.abreviatura === 'u')
        if (unidad) {
          setIdUnidadDefault(unidad.id)
          if (!articuloId) setValue('unidad_medida_id', unidad.id)
        }
      }

      if (articuloId) {
        const { data: articulo, error } = await supabase
          .from('articulos').select('*').eq('id', articuloId).single()
        if (error) throw error
        if (articulo) {
          // Solo pasar los campos que están en el schema — evita que campos extra de BD rompan Zod
          reset({
            nombre: articulo.nombre ?? '',
            nombre_base: articulo.nombre_base ?? null,
            rubro_id: articulo.rubro_id ? Number(articulo.rubro_id) : 0,
            marca_id: articulo.marca_id ? Number(articulo.marca_id) : 0,
            codigo_interno: articulo.codigo_interno ?? null,
            codigo_barra: articulo.codigo_barra ?? null,
            sku: articulo.sku ?? null,
            unidad_medida_id: articulo.unidad_medida_id ? Number(articulo.unidad_medida_id) : null,
            costo_sin_iva: articulo.costo_sin_iva ? Number(articulo.costo_sin_iva) : null,
            tasa_iva_id: articulo.tasa_iva_id ? Number(articulo.tasa_iva_id) : null,
            precio_local: articulo.precio_local ? Number(articulo.precio_local) : null,
            precio_web: articulo.precio_web ? Number(articulo.precio_web) : null,
            precio_mayorista: articulo.precio_mayorista ? Number(articulo.precio_mayorista) : null,
            precio_oferta_web: articulo.precio_oferta_web ? Number(articulo.precio_oferta_web) : null,
            disponible_local: articulo.disponible_local ?? true,
            disponible_web: articulo.disponible_web ?? false,
            visible_en_tienda: articulo.visible_en_tienda ?? false,
            atributo_nombre: articulo.atributo_nombre ?? null,
            atributo_valor: articulo.atributo_valor ?? null,
            peso_kg: articulo.peso_kg ? Number(articulo.peso_kg) : null,
            descripcion: articulo.descripcion ?? null,
          })
          setPrecioLocalOriginal(articulo.precio_local ? Number(articulo.precio_local) : null)
        }
      } else if (duplicarDeId) {
        // Alta nueva a partir de un artículo existente: copia todo excepto
        // nombre, código interno y código de barras (deben ser únicos).
        const { data: origen, error } = await supabase
          .from('articulos').select('*').eq('id', duplicarDeId).single()
        if (error) throw error
        if (origen) {
          setNombreOrigenDuplicado(origen.nombre)
          reset({
            nombre: origen.nombre ?? '',
            nombre_base: null,
            rubro_id: origen.rubro_id ? Number(origen.rubro_id) : 0,
            marca_id: origen.marca_id ? Number(origen.marca_id) : 0,
            codigo_interno: null,
            codigo_barra: null,
            sku: null,
            unidad_medida_id: origen.unidad_medida_id ? Number(origen.unidad_medida_id) : null,
            costo_sin_iva: origen.costo_sin_iva ? Number(origen.costo_sin_iva) : null,
            tasa_iva_id: origen.tasa_iva_id ? Number(origen.tasa_iva_id) : null,
            precio_local: origen.precio_local ? Number(origen.precio_local) : null,
            precio_web: origen.precio_web ? Number(origen.precio_web) : null,
            precio_mayorista: origen.precio_mayorista ? Number(origen.precio_mayorista) : null,
            precio_oferta_web: origen.precio_oferta_web ? Number(origen.precio_oferta_web) : null,
            disponible_local: origen.disponible_local ?? true,
            disponible_web: origen.disponible_web ?? false,
            visible_en_tienda: origen.visible_en_tienda ?? false,
            atributo_nombre: null,
            atributo_valor: null,
            peso_kg: null,
            descripcion: null,
          })
        }
      }
    } catch (error) {}
  }

  // Interpreta texto tipeado como monto: si después del último separador
  // (coma o punto) hay 1 o 2 dígitos, es decimal; si hay 3, es separador de
  // miles. Acepta coma o punto indistintamente como decimal. (misma lógica
  // ya probada en Compras > Nueva orden)
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
  function fmtInput(n: number | null | undefined): string {
    if (n === null || n === undefined || n === 0) return ''
    return n.toLocaleString('es-AR', { maximumFractionDigits: 2 })
  }
  // Para costos: siempre 2 decimales, para que "Costo sin IVA" y
  // "Costo con IVA" se vean con el mismo formato (evita la mezcla
  // "9.917,8" / "12000.54" que resultaba confusa)
  function fmtMoney(n: number | null | undefined): string {
    if (n === null || n === undefined || n === 0) return ''
    return n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  function handleCostoSinIvaChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    setCostoSinIvaTexto(raw)
    setValue('costo_sin_iva', raw.trim() === '' ? null : parsearMonto(raw))
  }
  function handleCostoSinIvaBlur() {
    setCostoSinIvaTexto(null)
  }

  function handleCostoConIvaChange(e: React.ChangeEvent<HTMLInputElement>) {
    setCostoConIva(e.target.value)
  }

  function handleCostoConIvaBlur() {
    const val = parsearMonto(costoConIva)
    if (val > 0) {
      const sinIva = val / (1 + tasaPct / 100)
      setValue('costo_sin_iva', parseFloat(sinIva.toFixed(2)))
    }
  }

  function handleUtilidadChange(e: React.ChangeEvent<HTMLInputElement>) {
    setUtilidad(e.target.value)
  }

  function handleUtilidadBlur() {
    const nuevaUtilidad = parsearMonto(utilidad)
    if (costoSinIva && utilidad.trim() !== '') {
      const precioSinIva = costoSinIva * (1 + nuevaUtilidad / 100)
      const precioConIva = precioSinIva * (1 + tasaPct / 100)
      setValue('precio_local', parseFloat(precioConIva.toFixed(2)))
    }
  }

  function handlePrecioLocalChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    setPrecioLocalTexto(raw)
    const nuevoPrecioLocal = raw.trim() === '' ? null : parsearMonto(raw)
    setValue('precio_local', nuevoPrecioLocal)
    if (nuevoPrecioLocal && nuevoPrecioLocal > 0) {
      if (diferenciaPorcentualWeb !== 0) {
        setValue('precio_web', parseFloat((nuevoPrecioLocal * (1 + diferenciaPorcentualWeb / 100)).toFixed(2)))
      } else if (precioWeb && precioLocal) {
        const diferencia = ((precioWeb - precioLocal) / precioLocal) * 100
        setDiferenciaPorcentualWeb(diferencia)
        setValue('precio_web', parseFloat((nuevoPrecioLocal * (1 + diferencia / 100)).toFixed(2)))
      }
    }
  }
  function handlePrecioLocalBlur() {
    setPrecioLocalTexto(null)
  }

  function handlePrecioWebChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    setPrecioWebTexto(raw)
    const nuevoPrecioWeb = raw.trim() === '' ? null : parsearMonto(raw)
    setValue('precio_web', nuevoPrecioWeb)
    if (nuevoPrecioWeb && precioLocal && precioLocal > 0) {
      setDiferenciaPorcentualWeb(((nuevoPrecioWeb - precioLocal) / precioLocal) * 100)
    }
  }
  function handlePrecioWebBlur() {
    setPrecioWebTexto(null)
  }

  // Bloquea Enter en todo el formulario excepto en botones
  // Evita que el lector de código de barras dispare el guardado
  function handleFormKeyDown(e: React.KeyboardEvent<HTMLFormElement>) {
    if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'BUTTON') {
      e.preventDefault()
    }
  }

  async function onSubmit(data: ArticuloFormData) {
    if (nombreOrigenDuplicado && data.nombre.trim().toLowerCase() === nombreOrigenDuplicado.trim().toLowerCase()) {
      alert('Este artículo se duplicó desde "' + nombreOrigenDuplicado + '". Cambiá el nombre antes de guardar (por ejemplo, el sabor) para no crear un duplicado exacto.')
      return
    }
    setLoading(true)
    const supabase = createClient()
    try {
      const payload = {
        ...data,
        codigo_interno: data.codigo_interno?.trim() || null,
        codigo_barra: data.codigo_barra?.trim() || null,
        sku: data.sku?.trim() || null,
        precio_local: data.precio_local ?? 0,
        precio_web: data.precio_web ?? data.precio_local ?? 0,
        precio_mayorista: data.precio_mayorista || null,
        precio_oferta_web: data.precio_oferta_web || null,
        costo_sin_iva: data.costo_sin_iva ?? 0,
      }
      if (articuloId) {
        const { error } = await supabase.from('articulos').update(payload).eq('id', articuloId)
        if (error) throw error

        // Registrar en historico_precios solo si el precio local realmente
        // cambió — evita ensuciar el historial con guardados que tocaron
        // otros campos (nombre, disponibilidad, etc.) sin tocar el precio.
        if (payload.precio_local !== (precioLocalOriginal ?? 0)) {
          await registrarHistoricoPrecio(articuloId, payload.precio_local, data.tasa_iva_id ?? null)
        }
      } else {
        const { data: nuevoArticulo, error } = await supabase
          .from('articulos').insert([payload]).select('id').single()
        if (error) throw error

        // Snapshot inicial de precio para un artículo recién creado, así
        // "Actualizado" en la pantalla de precios no queda vacío desde el día 1.
        await registrarHistoricoPrecio(nuevoArticulo.id, payload.precio_local, data.tasa_iva_id ?? null)
      }
      router.push('/articulos')
      router.refresh()
    } catch (error: any) {
      alert('Error al guardar: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  // No bloquea el guardado del artículo si falla — el precio ya quedó
  // guardado en `articulos`; esto es solo el rastro de auditoría.
  async function registrarHistoricoPrecio(articuloIdDestino: number, precioLocal: number, tasaIvaId: number | null) {
    const supabase = createClient()
    try {
      const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
      const { error } = await supabase.from('historico_precios').insert({
        articulo_id: articuloIdDestino,
        fecha: hoy,
        tipo: 'precio_manual',
        precio_local: precioLocal,
        tasa_iva_id: tasaIvaId,
        origen_id: null,
        usuario_id: usuarioId,
      })
      if (error) console.error('Error al registrar historico_precios:', error.message)
    } catch (err: any) {
      console.error('Error al registrar historico_precios:', err.message)
    }
  }

  const solapas = [
    { id: 0, titulo: 'Identificación' },
    { id: 1, titulo: 'Precios' },
    { id: 2, titulo: 'Disponibilidad' },
    { id: 3, titulo: 'Stock' },
    { id: 4, titulo: 'Web y extras' },
  ]

  const inputClass = "w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]"

  return (
    <form onSubmit={handleSubmit(onSubmit)} onKeyDown={handleFormKeyDown} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#3c3c3b]">
            {articuloId ? 'Editar artículo' : 'Nuevo artículo'}
          </h1>
          {nombreOrigenDuplicado && (
            <p className="text-xs text-[#00a19a] mt-1">
              Duplicando desde: <span className="font-medium">{nombreOrigenDuplicado}</span> — cambiá el nombre (ej. el sabor) y completá los códigos
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => router.push('/articulos')}
            className="px-4 py-2 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
            <X className="w-4 h-4" /> Cancelar
          </button>
          <button type="submit" disabled={loading}
            className="px-4 py-2 bg-[#00a19a] text-white rounded text-sm hover:bg-[#008f89] flex items-center gap-2 disabled:opacity-50">
            <Save className="w-4 h-4" /> {loading ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>

      <div className="border-b border-gray-200">
        <div className="flex gap-4">
          {solapas.map(s => (
            <button key={s.id} type="button" onClick={() => setSolapaActiva(s.id)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                solapaActiva === s.id
                  ? 'border-b-2 border-[#00a19a] text-[#00a19a]'
                  : 'text-gray-500 hover:text-gray-700'
              }`}>{s.titulo}</button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">

        {/* SOLAPA 0: Identificación */}
        {solapaActiva === 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre <span className="text-red-500">*</span></label>
              <input {...register('nombre')} type="text" className={inputClass} />
              {errors.nombre && <p className="text-red-500 text-xs mt-1">{errors.nombre.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rubro <span className="text-red-500">*</span></label>
              <select {...register('rubro_id', { valueAsNumber: true })} className={inputClass}>
                <option value="">Seleccionar rubro</option>
                {rubros.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </select>
              {errors.rubro_id && <p className="text-red-500 text-xs mt-1">{errors.rubro_id.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Marca <span className="text-red-500">*</span></label>
              <select {...register('marca_id', { valueAsNumber: true })} className={inputClass}>
                <option value="">Seleccionar marca</option>
                {marcas.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
              </select>
              {errors.marca_id && <p className="text-red-500 text-xs mt-1">{errors.marca_id.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Código interno</label>
              <input {...register('codigo_interno')} type="text" className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Código de barras</label>
              <input {...register('codigo_barra')} type="text" className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
              <input {...register('sku')} type="text" className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unidad de medida</label>
              <select {...register('unidad_medida_id', { valueAsNumber: true })} className={inputClass}>
                <option value="">Seleccionar unidad</option>
                {unidadesMedida.map(u => (
                  <option key={u.id} value={u.id}>{u.nombre} ({u.abreviatura})</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* SOLAPA 1: Precios */}
        {solapaActiva === 1 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {rolUsuario === 1 && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tasa IVA</label>
                  <select {...register('tasa_iva_id', { valueAsNumber: true })} className={inputClass}>
                    <option value="">Sin IVA</option>
                    {tasasIva.map(t => (
                      <option key={t.id} value={t.id}>{t.nombre} ({t.porcentaje}%)</option>
                    ))}
                  </select>
                </div>
                <div />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Costo sin IVA</label>
                  <input
                    type="text" inputMode="decimal"
                    value={costoSinIvaTexto !== null ? costoSinIvaTexto : fmtMoney(costoSinIva)}
                    onFocus={e => e.target.select()}
                    onChange={handleCostoSinIvaChange}
                    onBlur={handleCostoSinIvaBlur}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Costo con IVA</label>
                  <input
                    type="text" inputMode="decimal"
                    value={costoConIva}
                    onFocus={e => e.target.select()}
                    onChange={handleCostoConIvaChange}
                    onBlur={handleCostoConIvaBlur}
                    className={inputClass}
                  />
                  <p className="text-xs text-gray-500 mt-1">Al salir del campo calcula el costo sin IVA</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Utilidad % (orientativo)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={utilidad}
                    onChange={handleUtilidadChange}
                    onBlur={handleUtilidadBlur}
                    disabled={!costoSinIva}
                    className={inputClass + (costoSinIva ? '' : ' bg-gray-100')}
                  />
                  <p className="text-xs text-gray-500 mt-1">Modificarlo actualiza el precio local</p>
                </div>
                <div />
              </>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Precio local</label>
              <input
                type="text" inputMode="decimal"
                value={precioLocalTexto !== null ? precioLocalTexto : fmtInput(precioLocal)}
                onFocus={e => e.target.select()}
                onChange={handlePrecioLocalChange}
                onBlur={handlePrecioLocalBlur}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Precio web</label>
              <input
                type="text" inputMode="decimal"
                value={precioWebTexto !== null ? precioWebTexto : fmtInput(precioWeb)}
                onFocus={e => e.target.select()}
                onChange={handlePrecioWebChange}
                onBlur={handlePrecioWebBlur}
                className={inputClass}
              />
              <p className="text-xs text-gray-500 mt-1">
                Se actualiza al cambiar precio local
                {diferenciaPorcentualWeb !== 0 && (
                  <span className="ml-1">({diferenciaPorcentualWeb > 0 ? '+' : ''}{diferenciaPorcentualWeb.toFixed(2).replace('.', ',')}%)</span>
                )}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Precio mayorista</label>
              <input {...register('precio_mayorista', { setValueAs: v => parsearMonto(String(v)) })}
                onFocus={e => e.target.select()}
                type="text" inputMode="decimal" className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Precio oferta web</label>
              <input {...register('precio_oferta_web', { setValueAs: v => parsearMonto(String(v)) })}
                onFocus={e => e.target.select()}
                type="text" inputMode="decimal" className={inputClass} />
            </div>
          </div>
        )}

        {/* SOLAPA 2: Disponibilidad */}
        {solapaActiva === 2 && (
          <div className="space-y-6">
            {[
              { field: 'disponible_local', label: 'Disponible en local' },
              { field: 'disponible_web', label: 'Disponible en web' },
              { field: 'visible_en_tienda', label: 'Visible en tienda online' },
            ].map(item => (
              <div key={item.field} className="flex items-center gap-3">
                <input {...register(item.field as any)} type="checkbox" id={item.field}
                  className="w-4 h-4 text-[#00a19a] border-gray-300 rounded focus:ring-[#00a19a]" />
                <label htmlFor={item.field} className="text-sm font-medium text-gray-700">{item.label}</label>
              </div>
            ))}
          </div>
        )}

        {/* SOLAPA 3: Stock */}
        {solapaActiva === 3 && (
          <div className="text-center py-8 text-gray-500">
            <p className="text-sm">Gestión de stock por sucursal — próximamente</p>
          </div>
        )}

        {/* SOLAPA 4: Web y extras */}
        {solapaActiva === 4 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre base</label>
              <input {...register('nombre_base')} type="text"
                placeholder="Nombre genérico (ej: Creatina Monohidrato)" className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Atributo nombre</label>
              <input {...register('atributo_nombre')} type="text" placeholder="ej: Sabor" className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Atributo valor</label>
              <input {...register('atributo_valor')} type="text" placeholder="ej: Frutilla" className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Peso (kg)</label>
              <input {...register('peso_kg', { setValueAs: v => parsearMonto(String(v)) })}
                type="text" inputMode="decimal" className={inputClass} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
              <textarea {...register('descripcion')} rows={4} className={inputClass} />
            </div>
            <div className="md:col-span-2">
              <p className="text-xs text-gray-500 italic">Gestión de imágenes — próximamente</p>
            </div>
          </div>
        )}
      </div>
    </form>
  )
}
