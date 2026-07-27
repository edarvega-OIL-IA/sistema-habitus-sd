// Ruta destino: C:\Users\Usuario\Documents\sistema-habitus-sd\src\app\(sistema)\fiscalizacion\page.tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Venta {
  id: number
  numero_venta: number
  fecha_utc: string
  total: number
  cliente_id: number | null
  estado_venta_id: number
}

interface Comprobante {
  venta_id: number
  numero: number
  estado_fiscal_id: number
  mensaje_error: string | null
  fiscalizacion_intentos: number
}

interface Cliente {
  id: number
  nombre: string
  tiene_cuenta_corriente: boolean
  plazo_dias_cta_cte: number | null
}

const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]'

export default function FiscalizacionPage() {
  const [rolUsuario, setRolUsuario] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [ventas, setVentas] = useState<Venta[]>([])
  const [comprobantesPorVenta, setComprobantesPorVenta] = useState<Map<number, Comprobante>>(new Map())
  const [clientes, setClientes] = useState<Cliente[]>([])

  // Selección por fila: qué cliente y qué forma de pago elegir al fiscalizar
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Map<number, number>>(new Map())
  const [contadoSeleccionado, setContadoSeleccionado] = useState<Map<number, boolean>>(new Map())
  const [procesando, setProcesando] = useState<number | null>(null)
  const [resultados, setResultados] = useState<Map<number, { ok: boolean; mensaje: string }>>(new Map())

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    setLoading(true)
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: usuarioData } = await supabase.from('usuarios').select('rol_id').eq('id', user.id).single()
      if (usuarioData) setRolUsuario(usuarioData.rol_id)
    }

    // Ventas que necesitan atención: Fiscal pendiente/rechazada (1) o Guardada sin fiscalizar (2)
    const { data: ventasData } = await supabase
      .from('ventas')
      .select('id, numero_venta, fecha_utc, total, cliente_id, estado_venta_id')
      .in('estado_venta_id', [1, 2])
      .order('fecha_utc', { ascending: false })
      .order('id', { ascending: false })
      .limit(200)

    setVentas(ventasData || [])

    // Query separada + merge por Map (nunca join anidado, regla del proyecto)
    if (ventasData && ventasData.length > 0) {
      const ventaIds = ventasData.map(v => v.id)
      const { data: comprobantesData } = await supabase
        .from('comprobantes')
        .select('venta_id, numero, estado_fiscal_id, mensaje_error, fiscalizacion_intentos')
        .in('venta_id', ventaIds)

      setComprobantesPorVenta(new Map((comprobantesData || []).map(c => [c.venta_id, c])))
    }

    const { data: clientesData } = await supabase
      .from('clientes')
      .select('id, nombre, tiene_cuenta_corriente, plazo_dias_cta_cte')
      .eq('activo', true)
      .order('nombre')
    setClientes(clientesData || [])

    setLoading(false)
  }

  function clienteDeFila(ventaId: number, clienteIdActual: number | null): number {
    return clienteSeleccionado.get(ventaId) ?? clienteIdActual ?? 1 // 1 = Consumidor Final
  }

  function esContadoDeFila(ventaId: number): boolean {
    return contadoSeleccionado.get(ventaId) ?? true
  }

  async function fiscalizar(ventaId: number) {
    setProcesando(ventaId)
    const clienteId = clienteDeFila(ventaId, ventas.find(v => v.id === ventaId)?.cliente_id ?? null)
    const esContado = esContadoDeFila(ventaId)

    try {
      const res = await fetch('/api/fiscalizacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ venta_id: ventaId, cliente_id: clienteId, es_contado: esContado }),
      })
      const data = await res.json()
      setResultados(prev => new Map(prev).set(ventaId, { ok: data.ok, mensaje: data.mensaje }))
      if (data.ok) {
        // Éxito: recargar todo para que la venta salga de la lista
        await cargarDatos()
      }
    } catch (err: any) {
      setResultados(prev => new Map(prev).set(ventaId, { ok: false, mensaje: 'Error de conexión: ' + err.message }))
    } finally {
      setProcesando(null)
    }
  }

  if (loading) return <div className="p-6 text-sm text-gray-500">Cargando...</div>

  if (rolUsuario !== null && rolUsuario !== 1) {
    return <div className="p-6 text-sm text-red-600">Esta pantalla es solo para Admin.</div>
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[#3c3c3b]">Fiscalización</h1>
        <p className="text-sm text-gray-500 mt-1">
          Ventas Guardadas sin fiscalizar, o que se intentaron fiscalizar y ARCA/TusFacturasAPP rechazó.
        </p>
      </div>

      {ventas.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-sm text-gray-500">
          No hay ventas pendientes de fiscalización. 🎉
        </div>
      ) : (
        <div className="space-y-3">
          {ventas.map(venta => {
            const comprobante = comprobantesPorVenta.get(venta.id)
            const esRechazo = venta.estado_venta_id === 1
            const clienteId = clienteDeFila(venta.id, venta.cliente_id)
            const clienteActual = clientes.find(c => c.id === clienteId)
            const resultado = resultados.get(venta.id)

            return (
              <div key={venta.id} className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[#3c3c3b]">#{venta.numero_venta}</span>
                      <span className="text-sm text-gray-500">{venta.fecha_utc.split('-').reverse().join('/')}</span>
                      {esRechazo ? (
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Rechazada / Error</span>
                      ) : (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Sin fiscalizar</span>
                      )}
                    </div>
                    <div className="text-sm font-semibold text-[#3c3c3b] mt-1">
                      ${venta.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </div>
                    {comprobante?.mensaje_error && (
                      <p className="text-xs text-red-600 mt-2 max-w-xl">
                        Último intento ({comprobante.fiscalizacion_intentos}): {comprobante.mensaje_error}
                      </p>
                    )}
                  </div>

                  <div className="flex items-end gap-2 flex-wrap">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Cliente</label>
                      <select
                        value={clienteId}
                        onChange={e => setClienteSeleccionado(prev => new Map(prev).set(venta.id, Number(e.target.value)))}
                        className={inputClass + ' min-w-[220px]'}
                      >
                        {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                      </select>
                    </div>

                    {clienteActual?.tiene_cuenta_corriente && (
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Forma de pago</label>
                        <select
                          value={esContadoDeFila(venta.id) ? 'contado' : 'cta_cte'}
                          onChange={e => setContadoSeleccionado(prev => new Map(prev).set(venta.id, e.target.value === 'contado'))}
                          className={inputClass}
                        >
                          <option value="contado">Contado</option>
                          <option value="cta_cte">
                            Cuenta corriente{clienteActual.plazo_dias_cta_cte ? ` (${clienteActual.plazo_dias_cta_cte} días)` : ''}
                          </option>
                        </select>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => fiscalizar(venta.id)}
                      disabled={procesando === venta.id}
                      className="bg-[#00a19a] text-white px-4 py-2 rounded text-sm hover:bg-[#008f89] transition-colors disabled:opacity-50"
                    >
                      {procesando === venta.id ? 'Fiscalizando...' : esRechazo ? 'Reintentar' : 'Fiscalizar'}
                    </button>
                  </div>
                </div>

                {resultado && (
                  <p className={'text-xs mt-3 ' + (resultado.ok ? 'text-[#00a19a]' : 'text-red-600')}>
                    {resultado.ok ? '✓ ' : '✗ '}{resultado.mensaje}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
