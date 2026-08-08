// Ruta destino: C:\Users\Usuario\Documents\sistema-habitus-sd\src\app\tienda\pedido-confirmado\page.tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Clock } from 'lucide-react'

export default function PedidoConfirmadoPage() {
  const [pedidoId, setPedidoId] = useState<string | null>(null)
  const [medio, setMedio] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    // window.location.search directo (no useSearchParams) — mismo criterio
    // que ArticuloForm.tsx para no forzar un Suspense boundary acá.
    const params = new URLSearchParams(window.location.search)
    setPedidoId(params.get('pedido'))
    setMedio(params.get('medio'))
    setStatus(params.get('status')) // viene de Mercado Pago cuando corresponde
  }, [])

  const esRetiro = medio === 'retiro'
  const pagoAprobado = status === 'approved'
  const pagoPendiente = status === 'in_process' || status === 'pending'

  return (
    <div className="min-h-screen bg-[#ededed] flex items-center justify-center px-4">
      <div className="bg-white rounded-lg border border-gray-200 p-8 max-w-md w-full text-center">
        {esRetiro || pagoAprobado ? (
          <CheckCircle2 className="w-12 h-12 text-[#00a19a] mx-auto mb-4" />
        ) : (
          <Clock className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        )}

        <h1 className="text-lg font-bold text-[#3c3c3b] mb-2">
          {esRetiro
            ? '¡Pedido registrado!'
            : pagoAprobado
            ? '¡Pago aprobado!'
            : pagoPendiente
            ? 'Pago en proceso'
            : 'Pedido recibido'}
        </h1>

        <p className="text-sm text-gray-500 mb-1">
          {esRetiro
            ? 'Tu pedido quedó registrado para retirar y pagar en el local.'
            : pagoAprobado
            ? 'Tu pago se acreditó correctamente. Estamos preparando tu pedido.'
            : pagoPendiente
            ? 'Todavía estamos esperando la confirmación de Mercado Pago. Te avisamos apenas se acredite.'
            : 'Ya recibimos tu pedido.'}
        </p>

        {pedidoId && (
          <p className="text-xs text-gray-400 mt-3">Pedido #{pedidoId}</p>
        )}

        <Link
          href="/tienda"
          className="inline-block mt-6 text-sm text-[#00a19a] font-medium hover:underline"
        >
          Volver a la tienda
        </Link>
      </div>
    </div>
  )
}
