'use client'

import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import BuscadorProductos from '@/components/ventas/BuscadorProductos'
import CarritoItems, { ItemCarrito } from '@/components/ventas/CarritoItems'
import PanelPagos from '@/components/ventas/PanelPagos'

export default function VentasPage() {
  const [items, setItems] = useState<ItemCarrito[]>([])
  const [descuento_pct, setDescuento_pct] = useState(0)
  const [cajaAbierta, setCajaAbierta] = useState<boolean | null>(null)
  const [cierreId, setCierreId] = useState<number | null>(null)
  const [ventasRecientes, setVentasRecientes] = useState<any[]>([])
  const router = useRouter()

  useEffect(() => {
    async function verificarCaja() {
      const supabase = createClient()
      const { data } = await supabase
        .from('cierres_turno')
        .select('id')
        .eq('sucursal_id', 1)
        .eq('estado_cierre_turno_id', 1)
        .maybeSingle()
      setCajaAbierta(!!data)
      if (data) {
        setCierreId(data.id)
        cargarVentasRecientes(data.id)
      }
    }
    verificarCaja()
  }, [])

  async function cargarVentasRecientes(cierreId: number) {
    const supabase = createClient()
    const { data } = await supabase
      .from('ventas')
      .select(`
        id, numero_venta, total, creado_en,
        venta_pagos ( medio_pago_id, monto, medios_pago(nombre) )
      `)
      .eq('cierre_turno_id', cierreId)
      .neq('estado_venta_id', 3)
      .order('id', { ascending: false })
      .limit(10)
    setVentasRecientes(data || [])
  }

  const agregarItem = useCallback((articulo: any, cantidad: number) => {
    setItems(prev => {
      const existente = prev.findIndex(i => i.articulo_id === articulo.id)
      if (existente >= 0) {
        // Si ya existe, suma la cantidad
        const nuevo = [...prev]
        nuevo[existente] = {
          ...nuevo[existente],
          cantidad: nuevo[existente].cantidad + cantidad,
        }
        return nuevo
      }
      return [...prev, {
        articulo_id: articulo.id,
        nombre: articulo.nombre,
        precio_unitario: articulo.precio_local,
        cantidad,
        descuento_pct: 0,
      }]
    })
  }, [])

  const actualizarItem = useCallback((index: number, cantidad: number, descuento_pct: number) => {
    setItems(prev => {
      const nuevo = [...prev]
      nuevo[index] = { ...nuevo[index], cantidad, descuento_pct }
      return nuevo
    })
  }, [])

  const eliminarItem = useCallback((index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index))
  }, [])

  const ventaConfirmada = useCallback(() => {
    setItems([])
    setDescuento_pct(0)
    if (cierreId) cargarVentasRecientes(cierreId)
  }, [cierreId])

  if (cajaAbierta === null) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-48px)]">
        <p className="text-sm text-gray-400">Verificando caja...</p>
      </div>
    )
  }

  if (!cajaAbierta) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-48px)]">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🔒</span>
          </div>
          <h2 className="text-lg font-semibold text-[#3c3c3b] mb-2">Caja cerrada</h2>
          <p className="text-sm text-gray-500 mb-6">
            Para registrar ventas es necesario abrir la caja primero.
          </p>
          <button
            onClick={() => router.push('/cierre-turno')}
            className="bg-[#00a19a] text-white px-6 py-2.5 rounded font-medium text-sm hover:bg-[#008f89] transition-colors"
          >
            Ir a Caja
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-48px)] -m-6 overflow-hidden">
      {/* Panel izquierdo — buscador + carrito */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Buscador siempre arriba */}
        <div className="p-4 border-b border-gray-200 bg-white">
          <BuscadorProductos onAgregarItem={agregarItem} />
        </div>

        {/* Lista de items o ventas recientes */}
        {items.length > 0 ? (
          <CarritoItems
            items={items}
            onActualizar={actualizarItem}
            onEliminar={eliminarItem}
          />
        ) : (
          <div className="flex-1 overflow-y-auto">
            {ventasRecientes.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-gray-400">Escaneá un producto para comenzar</p>
              </div>
            ) : (
              <div className="p-4">
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-3">Ventas del turno</p>
                <div className="space-y-2">
                  {ventasRecientes.map(v => {
                    const medios = (v.venta_pagos || []).map((p: any) => p.medios_pago?.nombre).filter(Boolean)
                    const mediosUnicos = [...new Set(medios)].join(' + ')
                    return (
                      <div key={v.id} className="bg-white rounded-lg border border-gray-200 px-4 py-3 flex items-center justify-between">
                        <div>
                          <span className="text-sm font-medium text-[#3c3c3b]">#{v.numero_venta}</span>
                          <span className="text-xs text-gray-400 ml-3">
                            {new Date(v.creado_en).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' })}
                          </span>
                          {mediosUnicos && (
                            <span className="text-xs text-gray-400 ml-3">{mediosUnicos}</span>
                          )}
                        </div>
                        <span className="text-sm font-bold text-[#3c3c3b]">
                          ${v.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Pie del carrito — solo con items */}
        {items.length > 0 && (
          <div className="p-3 border-t border-gray-200 bg-white text-xs text-gray-400 flex justify-between">
            <span>{items.length} líneas · {items.reduce((s, i) => s + i.cantidad, 0)} unidades</span>
            <button
              onClick={() => setItems([])}
              className="text-red-400 hover:text-red-600"
            >
              Cancelar venta (Ctrl+X)
            </button>
          </div>
        )}
      </div>

      {/* Panel derecho — pagos */}
      <PanelPagos
        items={items}
        descuento_pct={descuento_pct}
        onDescuentoChange={setDescuento_pct}
        onVentaConfirmada={ventaConfirmada}
      />
    </div>
  )
}