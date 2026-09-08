// Ruta destino: C:\Users\Usuario\Documents\sistema-habitus-sd\src\app\tienda\checkout\page.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Package, AlertTriangle, Loader2, Truck, Store } from 'lucide-react'
import { useCarrito } from '@/components/tienda/CarritoContext'
import { PROVINCIAS_MICORREO } from '@/lib/correoargentino/micorreo'

interface LocalidadConCP {
  localidad: string
  cp: string
}

const fmt = (n: number) => '$' + n.toLocaleString('es-AR', { minimumFractionDigits: 2 })

type MetodoEnvio = 'retiro_local' | 'envio_cinco_saltos' | 'envio_correo_argentino'

interface ConfigEnvios {
  tarifaCincoSaltos: number
  cincoSaltosActivo: boolean
  aclaracionesTexto: string | null
  aclaracionesActivo: boolean
}

interface OpcionEnvioCA {
  deliveredType: 'D' | 'S'
  productType: 'CP' | 'EP'
  productName: string
  price: number
  deliveryTimeMin?: string
  deliveryTimeMax?: string
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

  // Correo Argentino (MiCorreo) — solo domicilio por ahora, retiro en
  // sucursal queda para una iteración siguiente (necesita selector de
  // agencias, endpoint /agencies todavía no integrado).
  const [caCalle, setCaCalle] = useState('')
  const [caNumero, setCaNumero] = useState('')
  const [caLocalidad, setCaLocalidad] = useState('')
  const [caProvincia, setCaProvincia] = useState('Río Negro')
  const [caCp, setCaCp] = useState('')
  const [opcionesEnvioCA, setOpcionesEnvioCA] = useState<OpcionEnvioCA[]>([])
  const [envioProductoElegido, setEnvioProductoElegido] = useState<'CP' | 'EP' | null>(null)
  const [cotizandoEnvioCA, setCotizandoEnvioCA] = useState(false)
  const [errorCotizacionCA, setErrorCotizacionCA] = useState<string | null>(null)

  // Base Provincia → Localidades con su CP, generada desde la base oficial
  // de Correo Argentino (23.190 pares). Es la ÚNICA fuente para el
  // desplegable de Localidad — se activa siempre al elegir/tener una
  // Provincia, sepa el cliente su CP o no. Se carga bajo demanda (dynamic
  // import) recién al elegir esta opción de envío, ~960KB que no tiene
  // sentido cargar si el cliente nunca la usa.
  const [provinciaLocalidadesData, setProvinciaLocalidadesData] = useState<Record<string, LocalidadConCP[]> | null>(null)

  useEffect(() => {
    if (metodoEnvio === 'envio_correo_argentino' && !provinciaLocalidadesData) {
      import('@/lib/correoargentino/provincia-localidades.json').then(mod => {
        setProvinciaLocalidadesData((mod.default ?? mod) as unknown as Record<string, LocalidadConCP[]>)
      })
    }
  }, [metodoEnvio, provinciaLocalidadesData])

  const opcionesLocalidad = caProvincia ? provinciaLocalidadesData?.[caProvincia] ?? [] : []

  // Índice inverso CP → provincia(s), derivado en memoria de la misma
  // base — evita mantener un segundo archivo solo para esto. Se usa
  // únicamente como conveniencia: si el cliente escribe el CP a mano,
  // detecta la provincia cuando es inequívoca en esa provincia.
  const cpAProvincias = useMemo(() => {
    if (!provinciaLocalidadesData) return null
    const mapa: Record<string, Set<string>> = {}
    for (const [prov, lista] of Object.entries(provinciaLocalidadesData)) {
      for (const { cp } of lista) {
        if (!mapa[cp]) mapa[cp] = new Set()
        mapa[cp].add(prov)
      }
    }
    return mapa
  }, [provinciaLocalidadesData])

  // El cliente elige una Localidad del desplegable → completa el CP solo.
  function seleccionarLocalidad(valorCombinado: string) {
    const [localidad, cp] = valorCombinado.split('|')
    if (!localidad || !cp) {
      setCaLocalidad('')
      return
    }
    setCaLocalidad(localidad)
    setCaCp(cp)
  }

  // El cliente escribe el CP a mano → si es inequívoco, ajusta la
  // Provincia (Río Negro es solo el valor inicial, no una traba) y, si
  // hay una única Localidad de esa provincia con ese CP exacto, la
  // autoselecciona — si hay varias, el cliente elige del desplegable.
  useEffect(() => {
    if (metodoEnvio !== 'envio_correo_argentino') return
    if (!/^\d{4}$/.test(caCp) || !cpAProvincias) return
    const provincias = cpAProvincias[caCp]
    if (!provincias || provincias.size !== 1) return
    const provinciaDetectada = [...provincias][0]
    setCaProvincia(provinciaDetectada)
    const coincidencias = (provinciaLocalidadesData?.[provinciaDetectada] ?? []).filter(l => l.cp === caCp)
    if (coincidencias.length === 1) setCaLocalidad(coincidencias[0].localidad)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caCp, metodoEnvio, cpAProvincias])

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

  // Re-cotiza automáticamente al completar un CP de 4 dígitos válido —
  // debounce de 600ms para no pegarle a la API en cada tecla.
  useEffect(() => {
    if (metodoEnvio !== 'envio_correo_argentino') return
    if (!/^\d{4}$/.test(caCp)) {
      setOpcionesEnvioCA([])
      setEnvioProductoElegido(null)
      return
    }
    const timer = setTimeout(() => cotizarCorreoArgentino(caCp), 600)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caCp, metodoEnvio])

  async function cotizarCorreoArgentino(cpDestino: string) {
    setCotizandoEnvioCA(true)
    setErrorCotizacionCA(null)
    try {
      const res = await fetch('/api/tienda/cotizar-envio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map(i => ({ articuloId: i.articuloId, cantidad: i.cantidad })),
          cp: cpDestino,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorCotizacionCA(data.error || 'No se pudo cotizar el envío')
        setOpcionesEnvioCA([])
        return
      }
      // Solo domicilio (D) — sucursal queda pendiente para una iteración siguiente
      const opcionesDomicilio: OpcionEnvioCA[] = (data.opciones || []).filter(
        (o: OpcionEnvioCA) => o.deliveredType === 'D'
      )
      setOpcionesEnvioCA(opcionesDomicilio)
      setEnvioProductoElegido(null) // obliga a re-elegir si cambió la cotización
    } catch {
      setErrorCotizacionCA('Error de conexión al cotizar el envío')
      setOpcionesEnvioCA([])
    } finally {
      setCotizandoEnvioCA(false)
    }
  }

  function elegirMetodoEnvio(metodo: MetodoEnvio) {
    setMetodoEnvio(metodo)
    // El envío a domicilio siempre se paga por adelantado — el pago en
    // efectivo al retirar solo tiene sentido cuando el cliente viene al local.
    if (metodo === 'envio_cinco_saltos' || metodo === 'envio_correo_argentino') setMedioElegido('mercado_pago')
  }

  const opcionElegidaCA = opcionesEnvioCA.find(o => o.productType === envioProductoElegido) || null

  const costoEnvio =
    metodoEnvio === 'envio_cinco_saltos' && configEnvios
      ? configEnvios.tarifaCincoSaltos
      : metodoEnvio === 'envio_correo_argentino' && opcionElegidaCA
        ? opcionElegidaCA.price
        : 0
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

    if (metodoEnvio === 'envio_correo_argentino') {
      if (!email.trim()) {
        setError('El email es obligatorio para el envío por Correo Argentino')
        return
      }
      if (!caCalle.trim() || !caNumero.trim() || !caLocalidad.trim() || !caProvincia || !/^\d{4}$/.test(caCp)) {
        setError('Completá la dirección completa de envío')
        return
      }
      if (!envioProductoElegido) {
        setError('Elegí una opción de envío (Clásico o Expreso) antes de continuar')
        return
      }
      if (medioElegido !== 'mercado_pago') {
        setError('El envío por Correo Argentino se paga por adelantado con Mercado Pago')
        return
      }
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
          ...(metodoEnvio === 'envio_correo_argentino' && {
            envioProducto: envioProductoElegido,
            envioTipoEntrega: 'D',
            direccion: {
              calle: caCalle.trim(),
              numero: caNumero.trim(),
              localidad: caLocalidad.trim(),
              provincia: caProvincia,
              cp: caCp.trim(),
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
            <label className="text-xs font-medium text-gray-500">
              Email {metodoEnvio === 'envio_correo_argentino' ? '*' : '(opcional)'}
            </label>
            {metodoEnvio === 'envio_correo_argentino' && (
              <p className="text-xs text-gray-400 mt-0.5">Obligatorio para el envío por Correo Argentino.</p>
            )}
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required={metodoEnvio === 'envio_correo_argentino'}
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

              <label className={`flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer text-sm ${metodoEnvio === 'envio_correo_argentino' ? 'border-[#00a19a] bg-[#00a19a]/5' : 'border-gray-300'}`}>
                <input
                  type="radio"
                  name="metodoEnvio"
                  checked={metodoEnvio === 'envio_correo_argentino'}
                  onChange={() => elegirMetodoEnvio('envio_correo_argentino')}
                />
                <Truck className="w-4 h-4 text-gray-400 shrink-0" />
                <span>Envío a domicilio — <span className="text-gray-400">todo el país (Correo Argentino)</span></span>
              </label>
            </div>

            {configEnvios?.aclaracionesActivo && configEnvios.aclaracionesTexto && (
              <p className="text-xs text-gray-400 mt-2">{configEnvios.aclaracionesTexto}</p>
            )}
          </div>

          {/* Dirección — solo si eligió envío en Cinco Saltos */}
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

          {/* Dirección + cotización en vivo — Correo Argentino */}
          {metodoEnvio === 'envio_correo_argentino' && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-medium text-gray-500">Calle *</label>
                  <input
                    value={caCalle}
                    onChange={e => setCaCalle(e.target.value)}
                    className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00a19a]"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Número *</label>
                  <input
                    value={caNumero}
                    onChange={e => setCaNumero(e.target.value)}
                    className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00a19a]"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500">Código Postal *</label>
                <input
                  value={caCp}
                  onChange={e => setCaCp(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  inputMode="numeric"
                  placeholder="Si no lo sabés, completalo con Provincia y Localidad"
                  className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00a19a]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500">Provincia *</label>
                  <select
                    value={caProvincia}
                    onChange={e => { setCaProvincia(e.target.value); setCaLocalidad(''); setCaCp('') }}
                    className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00a19a] bg-white"
                    required
                  >
                    <option value="">Elegí una provincia</option>
                    {PROVINCIAS_MICORREO.map(p => (
                      <option key={p.codigo} value={p.nombre}>{p.nombre}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-500">Localidad *</label>
                  <select
                    value={caLocalidad && opcionesLocalidad.some(l => l.localidad === caLocalidad) ? `${caLocalidad}|${caCp}` : ''}
                    onChange={e => seleccionarLocalidad(e.target.value)}
                    disabled={!caProvincia || !provinciaLocalidadesData}
                    className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00a19a] bg-white disabled:bg-gray-100"
                    required
                  >
                    <option value="">
                      {!caProvincia ? 'Elegí una provincia primero' : !provinciaLocalidadesData ? 'Cargando localidades...' : 'Elegí tu localidad'}
                    </option>
                    {opcionesLocalidad.map(l => (
                      <option key={`${l.localidad}-${l.cp}`} value={`${l.localidad}|${l.cp}`}>
                        {l.localidad}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="text-xs text-gray-400">
                Al elegir tu localidad completamos el código postal — si ya lo sabés, podés escribirlo directo arriba.
              </p>

              {/* Estado de la cotización en vivo */}
              {cotizandoEnvioCA && (
                <p className="text-xs text-gray-400 flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" /> Cotizando envío...
                </p>
              )}

              {!cotizandoEnvioCA && errorCotizacionCA && (
                <p className="text-xs text-red-600">{errorCotizacionCA}</p>
              )}

              {!cotizandoEnvioCA && opcionesEnvioCA.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">Elegí el tipo de envío</p>
                  <div className="space-y-2">
                    {opcionesEnvioCA.map(op => (
                      <label
                        key={op.productType}
                        className={`flex items-center justify-between gap-2 border rounded-lg px-3 py-2 cursor-pointer text-sm ${envioProductoElegido === op.productType ? 'border-[#00a19a] bg-[#00a19a]/5' : 'border-gray-300'}`}
                      >
                        <span className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="envioProductoCA"
                            checked={envioProductoElegido === op.productType}
                            onChange={() => setEnvioProductoElegido(op.productType)}
                          />
                          <span>
                            {op.productType === 'EP' ? 'Expreso' : 'Clásico'}
                            {op.deliveryTimeMin && op.deliveryTimeMax && (
                              <span className="text-gray-400"> — {op.deliveryTimeMin} a {op.deliveryTimeMax} días hábiles</span>
                            )}
                          </span>
                        </span>
                        <span className="font-semibold text-[#3c3c3b]">{fmt(op.price)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {!cotizandoEnvioCA && !errorCotizacionCA && opcionesEnvioCA.length === 0 && /^\d{4}$/.test(caCp) && (
                <p className="text-xs text-gray-400">No se encontraron opciones de envío para ese código postal.</p>
              )}
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
            {(metodoEnvio === 'envio_cinco_saltos' || metodoEnvio === 'envio_correo_argentino') && (
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
