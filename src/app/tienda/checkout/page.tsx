// Ruta destino: C:\Users\Usuario\Documents\sistema-habitus-sd\src\app\tienda\checkout\page.tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Package, AlertTriangle, Loader2, Truck, Store } from 'lucide-react'
import { useCarrito } from '@/components/tienda/CarritoContext'

const fmt = (n: number) => '$' + n.toLocaleString('es-AR', { minimumFractionDigits: 2 })

type MetodoEnvio = 'retiro_local' | 'envio_cinco_saltos'

interface ConfigEnvios {
  tarifaCincoSaltos: number
  cincoSaltosActivo: boolean
  aclaracionesTexto: string | null
  aclaracionesActivo: boolean
}

export default function CheckoutPage() {
  const router = useRouter()
  const { items, cargado, totalPrecio, vaciar } = useCarrito()

  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')
  const [dni, setDni] = useState('')
  const [cuit, setCuit] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [medioElegido, setMedioElegido] = useState<'mercado_pago' | 'retiro_efectivo'>('mercado_pago')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [detalles, setDetalles] = useState<string[]>([])

  // Envíos
  const [configEnvios, setConfigEnvios] = useState<ConfigEnvios | null>(null)
  const [metodoEnvio, setMetodoEnvio] = useState<MetodoEnvio>('retiro_local')
  const [direccionCalle, setDireccionCalle] = useState('')
  const [direccionNumero, setDireccionNumero] = useState('')

  useEffect(() => {
    fetch('/api/tienda/configuracion-envios')
      .then(res => res.json())
      .then(data => {
        if (!data.error) setConfigEnvios(data)
      })
      .catch(() => {
        // Si falla, el checkout sigue funcionando solo con "Retiro en local"
        // (comportamiento previo a esta fase, sin bloquear la compra)
      })
  }, [])

  function elegirMetodoEnvio(metodo: MetodoEnvio) {
    setMetodoEnvio(metodo)
    // El envío a domicilio siempre se paga por adelantado — el pago en
    // efectivo al retirar solo tiene sentido cuando el cliente viene al local.
    if (metodo === 'envio_cinco_saltos') setMedioElegido('mercado_pago')
  }

  const costoEnvio = metodoEnvio === 'envio_cinco_saltos' && configEnvios ? configEnvios.tarifaCincoSaltos : 0
  const totalConEnvio = totalPrecio + costoEnvio

  if (cargado && items.length === 0) {
    return (
      <div className="min-h-screen bg-[#ededed] flex items-center justify-center px-4">
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-sm text-gray-400 mb-3">Tu carrito está vacío.</p>
          <Link href="/tienda" className="text-sm text-[#00a19a] font-medium hover:underline">Ver catálogo</Link>
        </div>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setDetalles([])

    if (!nombre.trim() || !telefono.trim()) {
      setError('Completá nombre y teléfono para continuar')
      return
    }

    if (metodoEnvio === 'envio_cinco_saltos' && (!direccionCalle.trim() || !direccionNumero.trim())) {
      setError('Completá la dirección de entrega en Cinco Saltos')
      return
    }

    if (metodoEnvio === 'envio_cinco_saltos' && medioElegido !== 'mercado_pago') {
      setError('El envío a domicilio se paga por adelantado con Mercado Pago')
      return
    }

    setEnviando(true)
    try {
      const res = await fetch('/api/tienda/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map(i => ({ articuloId: i.articuloId, cantidad: i.cantidad })),
          medioElegido,
          cliente: {
            nombre: nombre.trim(),
            telefono: telefono.trim(),
            email: email.trim() || undefined,
            dni: dni.trim() || undefined,
            cuit: cuit.trim() || undefined,
          },
          observaciones: observaciones.trim() || undefined,
          metodoEnvio,
          ...(metodoEnvio === 'envio_cinco_saltos' && {
            direccion: {
              calle: direccionCalle.trim(),
              numero: direccionNumero.trim(),
              localidad: 'Cinco Saltos',
              provincia: 'Río Negro',
              cp: '8303',
            },
          }),
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'No se pudo procesar el pedido')
        if (data.detalles) setDetalles(data.detalles)
        setEnviando(false)
        return
      }

      vaciar()

      if (medioElegido === 'mercado_pago' && data.redirectUrl) {
        window.location.href = data.redirectUrl
      } else {
        router.push(`/tienda/pedido-confirmado?pedido=${data.pedidoId}&medio=retiro`)
      }
    } catch {
      setError('Error de conexión — probá de nuevo en un momento')
      setEnviando(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#ededed]">
      <header className="bg-[#3c3c3b] text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
          <Link href="/tienda/carrito" className="text-xs text-white/60 hover:text-white flex items-center gap-1 mb-2">
            <ArrowLeft className="w-3 h-3" /> Volver al carrito
          </Link>
          <h1 className="text-xl font-bold">Finalizar pedido</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 grid gap-6 sm:grid-cols-[1fr_260px]">
        <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex gap-2 text-sm text-red-700">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">{error}</p>
                {detalles.length > 0 && (
                  <ul className="mt-1 space-y-0.5 text-xs">
                    {detalles.map((d, i) => <li key={i}>• {d}</li>)}
                  </ul>
                )}
                {detalles.length > 0 && (
                  <Link href="/tienda/carrito" className="text-xs underline mt-1 inline-block">Volver al carrito para ajustar</Link>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-gray-500">Nombre y apellido *</label>
            <p className="text-xs text-gray-400 mt-0.5">
              {metodoEnvio === 'retiro_local'
                ? 'Nombre de quien retira el pedido en el local — te vamos a pedir el DNI al momento de la entrega.'
                : 'Nombre de quien recibe el pedido en el domicilio.'}
            </p>
            <input
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00a19a]"
              required
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500">Teléfono *</label>
            <input
              value={telefono}
              onChange={e => setTelefono(e.target.value)}
              className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00a19a]"
              required
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500">Email (opcional)</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00a19a]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500">DNI (opcional)</label>
              <input
                value={dni}
                onChange={e => setDni(e.target.value)}
                className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00a19a]"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">CUIT (opcional)</label>
              <input
                value={cuit}
                onChange={e => setCuit(e.target.value)}
                className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00a19a]"
              />
            </div>
          </div>

          {/* Método de envío */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">Cómo querés recibirlo</p>
            <div className="space-y-2">
              <label className={`flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer text-sm ${metodoEnvio === 'retiro_local' ? 'border-[#00a19a] bg-[#00a19a]/5' : 'border-gray-300'}`}>
                <input
                  type="radio"
                  name="metodoEnvio"
                  checked={metodoEnvio === 'retiro_local'}
                  onChange={() => elegirMetodoEnvio('retiro_local')}
                />
                <Store className="w-4 h-4 text-gray-400 shrink-0" />
                <span>Retiro en local <span className="text-gray-400">— sin costo</span></span>
              </label>

              {configEnvios?.cincoSaltosActivo && (
                <label className={`flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer text-sm ${metodoEnvio === 'envio_cinco_saltos' ? 'border-[#00a19a] bg-[#00a19a]/5' : 'border-gray-300'}`}>
                  <input
                    type="radio"
                    name="metodoEnvio"
                    checked={metodoEnvio === 'envio_cinco_saltos'}
                    onChange={() => elegirMetodoEnvio('envio_cinco_saltos')}
                  />
                  <Truck className="w-4 h-4 text-gray-400 shrink-0" />
                  <span>Envío en Cinco Saltos <span className="text-gray-400">— {fmt(configEnvios.tarifaCincoSaltos)}</span></span>
                </label>
              )}
            </div>

            {configEnvios?.aclaracionesActivo && configEnvios.aclaracionesTexto && (
              <p className="text-xs text-gray-400 mt-2">{configEnvios.aclaracionesTexto}</p>
            )}
          </div>

          {/* Dirección — solo si eligió envío */}
          {metodoEnvio === 'envio_cinco_saltos' && (
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-500">Calle *</label>
                <input
                  value={direccionCalle}
                  onChange={e => setDireccionCalle(e.target.value)}
                  className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00a19a]"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">Número *</label>
                <input
                  value={direccionNumero}
                  onChange={e => setDireccionNumero(e.target.value)}
                  className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00a19a]"
                  required
                />
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">Cómo querés pagar</p>
            <div className="space-y-2">
              <label className={`flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer text-sm ${medioElegido === 'mercado_pago' ? 'border-[#00a19a] bg-[#00a19a]/5' : 'border-gray-300'}`}>
                <input
                  type="radio"
                  name="medio"
                  checked={medioElegido === 'mercado_pago'}
                  onChange={() => setMedioElegido('mercado_pago')}
                />
                Pagar ahora con Mercado Pago
              </label>
              {metodoEnvio === 'retiro_local' && (
                <label className={`flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer text-sm ${medioElegido === 'retiro_efectivo' ? 'border-[#00a19a] bg-[#00a19a]/5' : 'border-gray-300'}`}>
                  <input
                    type="radio"
                    name="medio"
                    checked={medioElegido === 'retiro_efectivo'}
                    onChange={() => setMedioElegido('retiro_efectivo')}
                  />
                  Retirar y pagar en el local
                </label>
              )}
            </div>
            {metodoEnvio === 'envio_cinco_saltos' && (
              <p className="text-xs text-gray-400 mt-2">El envío a domicilio se abona por adelantado.</p>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500">Observaciones (opcional)</label>
            <p className="text-xs text-gray-400 mt-0.5">Horario de retiro, alguna preferencia u otra cosa que quieras avisarnos.</p>
            <textarea
              value={observaciones}
              onChange={e => setObservaciones(e.target.value)}
              rows={2}
              maxLength={300}
              className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00a19a] resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={enviando}
            className="w-full bg-[#00a19a] text-white py-3 rounded-lg font-semibold text-sm hover:bg-[#008f89] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {enviando && <Loader2 className="w-4 h-4 animate-spin" />}
            {enviando ? 'Procesando...' : medioElegido === 'mercado_pago' ? 'Ir a pagar' : 'Confirmar pedido'}
          </button>
        </form>

        <aside className="bg-white rounded-lg border border-gray-200 p-5 h-fit">
          <p className="text-sm font-semibold text-[#3c3c3b] mb-3">Tu pedido</p>
          <div className="space-y-3">
            {items.map(it => (
              <div key={it.articuloId} className="flex gap-2 text-xs">
                <div className="w-10 h-10 rounded bg-[#f5f5f4] shrink-0 flex items-center justify-center overflow-hidden">
                  {it.imagenUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.imagenUrl} alt={it.nombreBase} className="w-full h-full object-cover" />
                  ) : (
                    <Package className="w-4 h-4 text-gray-300" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[#3c3c3b] leading-snug">{it.nombreBase}{it.sabor ? ` - ${it.sabor}` : ''}</p>
                  <p className="text-gray-400">{it.cantidad} x {fmt(it.precio)}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-100 mt-3 pt-3 space-y-1">
            <div className="flex justify-between text-xs text-gray-400">
              <span>Subtotal</span>
              <span>{fmt(totalPrecio)}</span>
            </div>
            <div className="flex justify-between text-xs text-gray-400">
              <span>Envío</span>
              <span>{costoEnvio > 0 ? fmt(costoEnvio) : 'Sin costo'}</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-[#3c3c3b] pt-1">
              <span>Total</span>
              <span>{fmt(totalConEnvio)}</span>
            </div>
          </div>
        </aside>
      </main>
    </div>
  )
}
