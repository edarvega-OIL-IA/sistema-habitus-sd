'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Truck, Save, CheckCircle2 } from 'lucide-react'

interface ConfiguracionEnvios {
  id: number
  tarifa_cinco_saltos: number
  aclaraciones_texto: string | null
  aclaraciones_activo: boolean
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

export default function ConfiguracionPage() {
  const [config, setConfig] = useState<ConfiguracionEnvios | null>(null)
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [guardadoOk, setGuardadoOk] = useState(false)

  // Buffer de texto para el input de monto (tarifa Cinco Saltos)
  const [tarifaTexto, setTarifaTexto] = useState('')

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
      setTarifaTexto(fmtMonto(data.tarifa_cinco_saltos))
    }
    setLoading(false)
  }

  async function guardar() {
    if (!config) return
    setGuardando(true)
    setGuardadoOk(false)
    const supabase = createClient()
    const { error } = await supabase
      .from('configuracion_envios')
      .update({
        tarifa_cinco_saltos: parsearMonto(tarifaTexto),
        aclaraciones_texto: config.aclaraciones_texto,
        aclaraciones_activo: config.aclaraciones_activo,
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

      {/* Envíos */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <Truck className="w-4 h-4 text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-700">Envíos</h2>
        </div>

        {/* Aclaraciones sobre envíos */}
        <div className="border border-gray-200 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">Aclaraciones sobre envíos</label>
            <button
              onClick={() => setConfig({ ...config, aclaraciones_activo: !config.aclaraciones_activo })}
              className={`w-10 h-6 rounded-full transition-colors relative ${
                config.aclaraciones_activo ? 'bg-[#00a19a]' : 'bg-gray-300'
              }`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                  config.aclaraciones_activo ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </button>
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
          <p className="text-sm font-medium text-gray-700 mb-1">Envío en Cinco Saltos</p>
          <p className="text-xs text-gray-400 mb-3">
            Tarifa fija que ve el cliente al elegir este método en el checkout de la Vitrina.
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
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={guardar}
          disabled={guardando}
          className="flex items-center gap-2 px-4 py-2 bg-[#00a19a] text-white text-sm font-medium rounded hover:bg-[#008b85] transition-colors disabled:opacity-50"
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
