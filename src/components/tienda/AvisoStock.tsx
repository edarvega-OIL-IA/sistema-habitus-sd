// Ruta destino: C:\Users\Usuario\Documents\sistema-habitus-sd\src\components\tienda\AvisoStock.tsx
'use client'

import { useState } from 'react'
import { Check, Bell } from 'lucide-react'
import { CODIGO_PAIS_POR_DEFECTO, PAISES_WHATSAPP, normalizarWhatsapp } from '@/lib/whatsapp'

interface Props {
  articuloId: number
}

type Medio = 'whatsapp' | 'email' | 'ambos'

// WhatsApp: se normaliza con normalizarWhatsapp() (src/lib/whatsapp.ts). Si el
// usuario escribe solo el número, se le antepone el país elegido (Argentina +54
// por defecto); si escribe "+..." se respeta el número internacional tal cual.
const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function AvisoStock({ articuloId }: Props) {
  const [medio, setMedio] = useState<Medio>('whatsapp')
  const [whatsapp, setWhatsapp] = useState('')
  const [codigoPais, setCodigoPais] = useState(CODIGO_PAIS_POR_DEFECTO)
  const [email, setEmail] = useState('')
  const [whatsappTocado, setWhatsappTocado] = useState(false)
  const [emailTocado, setEmailTocado] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const necesitaWhatsapp = medio === 'whatsapp' || medio === 'ambos'
  const necesitaEmail = medio === 'email' || medio === 'ambos'
  const whatsappNormalizado = normalizarWhatsapp(whatsapp, codigoPais)
  const whatsappValido = !necesitaWhatsapp || whatsappNormalizado !== null
  const emailValido = !necesitaEmail || EMAIL_VALIDO.test(email.trim())
  const formularioValido = whatsappValido && emailValido

  function cambiarMedio(nuevo: Medio) {
    setMedio(nuevo)
    setError(null) // el error del intento anterior ya no aplica necesariamente al nuevo medio elegido
  }

  async function enviar() {
    setWhatsappTocado(necesitaWhatsapp)
    setEmailTocado(necesitaEmail)
    if (!formularioValido) return

    setEnviando(true)
    setError(null)
    try {
      const res = await fetch('/api/avisos-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articulo_id: articuloId,
          medio_preferido: medio,
          whatsapp: necesitaWhatsapp ? whatsappNormalizado : null,
          email: necesitaEmail ? email.trim() : null,
        }),
      })
      // Si el servidor falla sin devolver JSON (respuesta vacía), no mostramos el
      // error técnico del navegador sino un mensaje claro.
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        throw new Error(data?.mensaje || 'No pudimos guardar tu aviso. Probá de nuevo en unos minutos.')
      }
      setEnviado(true)
    } catch (err: unknown) {
      const esErrorDeRed = err instanceof TypeError
      setError(esErrorDeRed ? 'Error de conexión. Revisá tu internet y probá de nuevo.' : err instanceof Error ? err.message : 'No pudimos guardar tu aviso.')
    } finally {
      setEnviando(false)
    }
  }

  if (enviado) {
    return (
      <div className="flex items-center gap-2 border-2 border-offer-teal/30 bg-offer-teal/10 text-offer-teal text-sm font-medium px-4 py-3 rounded-lg">
        <Check className="w-5 h-5 shrink-0" />
        Listo, te avisamos apenas vuelva a haber stock.
      </div>
    )
  }

  return (
    <div className="border-2 border-offer-teal/30 bg-offer-teal/5 rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Bell className="w-5 h-5 text-offer-teal shrink-0" />
        <p className="text-base font-semibold text-charcoal">Avisame cuando haya stock</p>
      </div>

      <div className="flex gap-1.5">
        {([
          ['whatsapp', 'WhatsApp'],
          ['email', 'Email'],
          ['ambos', 'Los dos'],
        ] as [Medio, string][]).map(([valor, etiqueta]) => (
          <button
            key={valor}
            type="button"
            onClick={() => cambiarMedio(valor)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              medio === valor
                ? 'bg-offer-teal text-white border-offer-teal'
                : 'bg-white text-gray-600 border-gray-300 hover:border-offer-teal'
            }`}
          >
            {etiqueta}
          </button>
        ))}
      </div>

      {necesitaWhatsapp && (
        <div>
          <div className="flex gap-1.5">
            <select
              aria-label="País"
              value={codigoPais}
              onChange={e => { setCodigoPais(e.target.value); setError(null) }}
              className="shrink-0 px-2 py-2 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-offer-teal"
            >
              {PAISES_WHATSAPP.map(p => (
                <option key={p.codigo} value={p.codigo}>
                  {p.bandera} +{p.codigo}
                </option>
              ))}
            </select>
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              name="whatsapp-aviso-stock"
              placeholder="Tu WhatsApp (ej. 299 574-1735)"
              value={whatsapp}
              onChange={e => { setWhatsapp(e.target.value); setError(null) }}
              onBlur={() => setWhatsappTocado(true)}
              className={`min-w-0 flex-1 px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 ${
                whatsappTocado && !whatsappValido ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 focus:ring-offer-teal'
              }`}
            />
          </div>
          {whatsappTocado && !whatsappValido ? (
            <p className="text-xs text-red-600 mt-1">Ingresá tu número con código de área, sin 0 ni 15 (ej. 299 574-1735)</p>
          ) : (
            whatsappNormalizado && <p className="text-xs text-gray-500 mt-1">Te escribimos a {whatsappNormalizado}</p>
          )}
        </div>
      )}
      {necesitaEmail && (
        <div>
          <input
            type="email"
            autoComplete="email"
            name="email-aviso-stock"
            placeholder="Tu email"
            value={email}
            onChange={e => { setEmail(e.target.value); setError(null) }}
            onBlur={() => setEmailTocado(true)}
            className={`w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 ${
              emailTocado && !emailValido ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 focus:ring-offer-teal'
            }`}
          />
          {emailTocado && !emailValido && (
            <p className="text-xs text-red-600 mt-1">Ingresá un email válido</p>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      <button
        type="button"
        onClick={enviar}
        disabled={enviando}
        className="w-full h-10 rounded-lg text-sm font-medium bg-charcoal text-white hover:bg-black disabled:opacity-40 transition-colors"
      >
        {enviando ? 'Guardando...' : 'Avisarme'}
      </button>
    </div>
  )
}
