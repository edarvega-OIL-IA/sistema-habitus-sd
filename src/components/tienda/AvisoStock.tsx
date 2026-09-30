// Ruta destino: C:\Users\Usuario\Documents\sistema-habitus-sd\src\components\tienda\AvisoStock.tsx
'use client'

import { useState } from 'react'
import { Check, Bell } from 'lucide-react'

interface Props {
  articuloId: number
}

type Medio = 'whatsapp' | 'email' | 'ambos'

// Bastante permisivo a propósito (no es para validar contra ARCA ni nada
// fiscal, solo para evitar el típico "se me chingó un número/letra").
// Whatsapp: al menos 8 dígitos, puede tener espacios/guiones/+ en el medio.
const WHATSAPP_VALIDO = /^[\d+\s-]{8,}$/
const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function AvisoStock({ articuloId }: Props) {
  const [medio, setMedio] = useState<Medio>('whatsapp')
  const [whatsapp, setWhatsapp] = useState('')
  const [email, setEmail] = useState('')
  const [whatsappTocado, setWhatsappTocado] = useState(false)
  const [emailTocado, setEmailTocado] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const necesitaWhatsapp = medio === 'whatsapp' || medio === 'ambos'
  const necesitaEmail = medio === 'email' || medio === 'ambos'
  const whatsappValido = !necesitaWhatsapp || WHATSAPP_VALIDO.test(whatsapp.trim())
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
          whatsapp: necesitaWhatsapp ? whatsapp.trim() : null,
          email: necesitaEmail ? email.trim() : null,
        }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.mensaje || 'No se pudo guardar el aviso')
      setEnviado(true)
    } catch (err: any) {
      setError(err.message || 'Error de conexión')
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
          <input
            type="tel"
            inputMode="tel"
            placeholder="Tu WhatsApp (ej. 299 123-4567)"
            value={whatsapp}
            onChange={e => { setWhatsapp(e.target.value); setError(null) }}
            onBlur={() => setWhatsappTocado(true)}
            className={`w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 ${
              whatsappTocado && !whatsappValido ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 focus:ring-offer-teal'
            }`}
          />
          {whatsappTocado && !whatsappValido && (
            <p className="text-xs text-red-600 mt-1">Ingresá un WhatsApp válido (al menos 8 dígitos)</p>
          )}
        </div>
      )}
      {necesitaEmail && (
        <div>
          <input
            type="email"
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
