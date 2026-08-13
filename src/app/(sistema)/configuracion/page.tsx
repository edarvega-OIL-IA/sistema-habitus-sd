'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Truck, Save, CheckCircle2, ChevronDown, ChevronRight } from 'lucide-react'

interface ConfiguracionEnvios {
  id: number
  tarifa_cinco_saltos: number
  aclaraciones_texto: string | null
  aclaraciones_activo: boolean
  envio_cinco_saltos_activo: boolean
  correo_argentino_activo: boolean
  correo_argentino_cp_origen: string | null
  correo_argentino_recargo_pct: number
  correo_argentino_recargo_monto_fijo: number
}

// Mismo patrón que el resto del sistema: coma o punto como decimal si hay 1-2
// dígitos después, separador de miles si hay 3. Buffer de texto durante edición,
// reformateo en blur.
function parsearMonto(v: string): number {
  const limpio = v.replace(/[^\d.,-]/g, '')
  const ultimaComa = limpio.lastIndexOf(',')
  const ultimoPunto = limpio.lastIndexOf('.')
  const sep = Math.max(ultimaComa, ultimoPunto)
  if (sep === -1) return parseFloat(limpio) || 0
  const decimales = limpio.length - sep - 1
  if (decimales <= 2) {
    const entero = limpio.slice(0, sep).replace(/[.,]/g, '')
    const dec = limpio.slice(sep + 1)
    return parseFloat(`${entero}.${dec}`) || 0
  }
  return parseFloat(limpio.replace(/[.,]/g, '')) || 0
}

const fmtMonto = (n: number) =>
  n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Toggle reutilizable — <div> en vez de <button> a propósito: los estilos
// nativos del navegador sobre <button> distorsionaban el rounded-full.
function Toggle({ activo, onToggle, title }: { activo: boolean; onToggle: () => void; title?: string }) {
  return (
    <div
      role="switch"
      aria-checked={activo}
      onClick={onToggle}
      title={title}
      className={`relative inline-flex flex-shrink-0 h-6 w-11 items-center rounded-full cursor-pointer transition-colors ${
        activo ? 'bg-[#00a19a]' : 'bg-gray-300'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${
          activo ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </div>
  )
}

// Tarjeta colapsable reutilizable — cada sección futura de Configuración
// (Envíos, Datos del negocio, etc.) usa este mismo contenedor.
function SeccionConfig({
  icono,
  titulo,
  abiertaPorDefecto = true,
  children,
}: {
  icono: React.ReactNode
  titulo: string
  abiertaPorDefecto?: boolean
  children: React.ReactNode
}) {
  const [abierta, setAbierta] = useState(abiertaPorDefecto)
  return (
    <div className="bg-white rounded-lg border border-gray-200 mb-4 overflow-hidden">
      <button
        onClick={() => setAbierta(!abierta)}
        className="w-full flex items-center gap-2 p-4 hover:bg-gray-50 transition-colors text-left"
      >
        {abierta ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
        {icono}
        <h2 className="text-sm font-semibold text-gray-700">{titulo}</h2>
      </button>
      {abierta && <div className="px-4 pb-4">{children}</div>}
    </div>
  )
}

export default function ConfiguracionPage() {
  const [config, setConfig] = useState<ConfiguracionEnvios | null>(null)
  const [original, setOriginal] = useState<ConfiguracionEnvios | null>(null)
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [guardadoOk, setGuardadoOk] = useState(false)

  // Buffer de texto para el input de monto (tarifa Cinco Saltos)
  const [tarifaTexto, setTarifaTexto] = useState('')
  const [tarifaTextoOriginal, setTarifaTextoOriginal] = useState('')

  useEffect(() => {
    cargarConfig()
  }, [])

  async function cargarConfig() {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('configuracion_envios')
      .select('*')
      .eq('id', 1)
      .single()
    if (data) {
      setConfig(data as ConfiguracionEnvios)
      setOriginal(data as ConfiguracionEnvios)
      const tarifaFmt = fmtMonto(data.tarifa_cinco_saltos)
      setTarifaTexto(tarifaFmt)
      setTarifaTextoOriginal(tarifaFmt)
    }
    setLoading(false)
  }

  // Hay cambios reales si difiere cualquier campo editable contra lo cargado
  // de la base, o si el monto de la tarifa (ya parseado) cambió.
  const hayCambios =
    !!config &&
    !!original &&
    (config.aclaraciones_texto !== original.aclaraciones_texto ||
      config.aclaraciones_activo !== original.aclaraciones_activo ||
      config.envio_cinco_saltos_activo !== original.envio_cinco_saltos_activo ||
      parsearMonto(tarifaTexto) !== original.tarifa_cinco_saltos)

  async function guardar() {
    if (!config || !hayCambios) return
    setGuardando(true)
    setGuardadoOk(false)
    const supabase = createClient()
    const { error } = await supabase
      .from('configuracion_envios')
      .update({
        tarifa_cinco_saltos: parsearMonto(tarifaTexto),
        aclaraciones_texto: config.aclaraciones_texto,
        aclaraciones_activo: config.aclaraciones_activo,
        envio_cinco_saltos_activo: config.envio_cinco_saltos_activo,
        correo_argentino_activo: config.correo_argentino_activo,
        correo_argentino_cp_origen: config.correo_argentino_cp_origen,
        correo_argentino_recargo_pct: config.correo_argentino_recargo_pct,
        correo_argentino_recargo_monto_fijo: config.correo_argentino_recargo_monto_fijo,
        actualizado_en: new Date().toISOString(),
      })
      .eq('id', 1)

    if (error) {
      alert('Error al guardar: ' + error.message)
    } else {
      setGuardadoOk(true)
      setTimeout(() => setGuardadoOk(false), 2500)
      await cargarConfig()
    }
    setGuardando(false)
  }

  if (loading) {
    return <p className="text-sm text-gray-400 text-center py-8">Cargando configuración...</p>
  }

  if (!config) {
    return <p className="text-sm text-red-500 text-center py-8">No se encontró la configuración de envíos.</p>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-[#3c3c3b]">Configuración</h1>
      </div>

      <SeccionConfig icono={<Truck className="w-4 h-4 text-gray-500" />} titulo="Envíos">
        {/* Aclaraciones sobre envíos */}
        <div className="border border-gray-200 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">Aclaraciones sobre envíos</label>
            <Toggle
              activo={config.aclaraciones_activo}
              onToggle={() => setConfig({ ...config, aclaraciones_activo: !config.aclaraciones_activo })}
            />
          </div>
          <p className="text-xs text-gray-400 mb-2">
            Texto visible para el cliente en el checkout de la Vitrina, cuando está activo.
          </p>
          <textarea
            value={config.aclaraciones_texto || ''}
            onChange={e => setConfig({ ...config, aclaraciones_texto: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]"
            placeholder="Ej: Los tiempos de envío dependen del método seleccionado."
          />
        </div>

        {/* Retiro en local */}
        <div className="border border-gray-200 rounded-lg p-4 mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700">Retiro en local</p>
            <p className="text-xs text-gray-400">Av. Roca 54, Cinco Saltos — sin costo</p>
          </div>
          <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">Siempre activo</span>
        </div>

        {/* Envío en Cinco Saltos — tarifa fija */}
        <div className="border border-gray-200 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-medium text-gray-700">Envío en Cinco Saltos</p>
            <Toggle
              activo={config.envio_cinco_saltos_activo}
              onToggle={() => setConfig({ ...config, envio_cinco_saltos_activo: !config.envio_cinco_saltos_activo })}
              title={config.envio_cinco_saltos_activo ? 'Método habilitado en el checkout' : 'Método deshabilitado (no se muestra al cliente)'}
            />
          </div>
          <p className="text-xs text-gray-400 mb-3">
            Tarifa fija que ve el cliente al elegir este método en el checkout de la Vitrina.
            {!config.envio_cinco_saltos_activo && (
              <span className="text-orange-600"> Desactivado: no aparece como opción hasta que lo vuelvas a activar.</span>
            )}
          </p>
          <div className="max-w-xs">
            <label className="block text-xs font-medium text-gray-600 mb-1">Tarifa</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input
                type="text"
                inputMode="decimal"
                value={tarifaTexto}
                onChange={e => setTarifaTexto(e.target.value)}
                onBlur={() => setTarifaTexto(fmtMonto(parsearMonto(tarifaTexto)))}
                className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]"
              />
            </div>
          </div>
        </div>

        {/* Correo Argentino — placeholder hasta tener credenciales de API */}
        <div className="border border-gray-200 rounded-lg p-4 opacity-70">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-700">Envío a domicilio (Correo Argentino)</p>
            <span className="px-2 py-0.5 rounded-full text-xs bg-orange-100 text-orange-700">
              Pendiente credenciales de API
            </span>
          </div>
          <p className="text-xs text-gray-400 mb-3">
            Cotización automática vía API de MiCorreo para localidades fuera de Cinco Saltos.
            Se habilita cuando lleguen las credenciales del ambiente PROD.
          </p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">CP de origen</label>
              <input
                type="text"
                disabled
                value={config.correo_argentino_cp_origen || ''}
                className="w-full px-3 py-2 border border-gray-200 rounded text-sm bg-gray-50 text-gray-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Recargo %</label>
              <input
                type="text"
                disabled
                value={config.correo_argentino_recargo_pct}
                className="w-full px-3 py-2 border border-gray-200 rounded text-sm bg-gray-50 text-gray-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Recargo fijo $</label>
              <input
                type="text"
                disabled
                value={config.correo_argentino_recargo_monto_fijo}
                className="w-full px-3 py-2 border border-gray-200 rounded text-sm bg-gray-50 text-gray-400"
              />
            </div>
          </div>
        </div>
      </SeccionConfig>

      <div className="flex items-center gap-3">
        <button
          onClick={guardar}
          disabled={guardando || !hayCambios}
          className="flex items-center gap-2 px-4 py-2 bg-[#00a19a] text-white text-sm font-medium rounded hover:bg-[#008b85] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4" />
          {guardando ? 'Guardando...' : 'Guardar cambios'}
        </button>
        {guardadoOk && (
          <span className="flex items-center gap-1 text-sm text-green-600">
            <CheckCircle2 className="w-4 h-4" /> Guardado
          </span>
        )}
      </div>
    </div>
  )
}
