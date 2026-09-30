// Ruta destino: C:\Users\Usuario\Documents\sistema-habitus-sd\src\components\tienda\AvisoStock.tsx
'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'

interface Props {
  articuloId: number
}

type Medio = 'whatsapp' | 'email' | 'ambos'

export default function AvisoStock({ articuloId }: Props) {
  const [medio, setMedio] = useState<Medio>('whatsapp')
  const [whatsapp, setWhatsapp] = useState('')
  const [email, setEmail] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const necesitaWhatsapp = medio === 'whatsapp' || medio === 'ambos'
  const necesitaEmail = medio === 'email' || medio === 'ambos'
  const formularioValido =
    (!necesitaWhatsapp || whatsapp.trim().length >= 8) &&
    (!necesitaEmail || /\S+@\S+\.\S+/.test(email.trim()))

  async function enviar() {
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
      <div className="flex items-center gap-2 bg-offer-teal/10 text-offer-teal text-sm font-medium px-3 py-2 rounded-lg">
        <Check className="w-4 h-4 shrink-0" />
        Listo, te avisamos apenas vuelva a haber stock.
      </div>
    )
  }

  return (
    <div className="border border-border-gray rounded-lg p-3 space-y-2.5">
      <p className="text-sm font-medium text-charcoal">Avisame cuando haya stock</p>

      <div className="flex gap-1.5">
        {([
          ['whatsapp', 'WhatsApp'],
          ['email', 'Email'],
          ['ambos', 'Los dos'],
        ] as [Medio, string][]).map(([valor, etiqueta]) => (
          <button
            key={valor}
            type="button"
            onClick={() => setMedio(valor)}
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
        <input
          type="tel"
          inputMode="tel"
          placeholder="Tu WhatsApp (ej. 299 123-4567)"
          value={whatsapp}
          onChange={e => setWhatsapp(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-offer-teal"
        />
      )}
      {necesitaEmail && (
        <input
          type="email"
          placeholder="Tu email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-offer-teal"
        />
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      <button
        type="button"
        onClick={enviar}
        disabled={!formularioValido || enviando}
        className="w-full h-10 rounded-lg text-sm font-medium bg-charcoal text-white hover:bg-black disabled:opacity-40 transition-colors"
      >
        {enviando ? 'Guardando...' : 'Avisarme'}
      </button>
    </div>
  )
}
