'use client'

import { useState } from 'react'

export interface ItemCarrito {
  articulo_id: number
  nombre: string
  precio_unitario: number
  cantidad: number
  descuento_pct: number
}

interface PopupItem {
  index: number
  item: ItemCarrito
}

interface CarritoItemsProps {
  items: ItemCarrito[]
  onActualizar: (index: number, cantidad: number, descuento_pct: number) => void
  onEliminar: (index: number) => void
}

export default function CarritoItems({ items, onActualizar, onEliminar }: CarritoItemsProps) {
  const [popup, setPopup] = useState<PopupItem | null>(null)
  const [cantidadEdit, setCantidadEdit] = useState(1)
  const [descuentoEdit, setDescuentoEdit] = useState(0)

  function abrirPopup(index: number) {
    const item = items[index]
    setCantidadEdit(item.cantidad)
    setDescuentoEdit(item.descuento_pct)
    setPopup({ index, item })
  }

  function confirmarPopup() {
    if (!popup) return
    onActualizar(popup.index, cantidadEdit, descuentoEdit)
    setPopup(null)
  }

  function subtotalItem(item: ItemCarrito) {
    return item.precio_unitario * item.cantidad * (1 - item.descuento_pct / 100)
  }

  if (items.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
        Escaneá un producto para comenzar
      </div>
    )
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
            <tr>
              <th className="text-left px-3 py-2 text-xs text-gray-500 font-medium">Producto</th>
              <th className="text-center px-3 py-2 text-xs text-gray-500 font-medium">Cant.</th>
              <th className="text-right px-3 py-2 text-xs text-gray-500 font-medium">Subtotal</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((item, index) => (
              <tr
                key={index}
                className="hover:bg-[#e8f7f6] cursor-pointer"
                onClick={() => abrirPopup(index)}
              >
                <td className="px-3 py-2">
                  <div className="font-medium text-[#3c3c3b] text-sm leading-tight">{item.nombre}</div>
                  <div className="text-xs text-gray-500">
                    ${item.precio_unitario.toLocaleString('es-AR')} c/u
                    {item.descuento_pct > 0 && (
                      <span className="ml-2 text-orange-500">−{item.descuento_pct}%</span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 text-center font-semibold text-[#3c3c3b]">
                  {item.cantidad}
                </td>
                <td className="px-3 py-2 text-right font-semibold text-[#3c3c3b]">
                  ${subtotalItem(item).toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                </td>
                <td className="px-3 py-2">
                  <button
                    onClick={e => { e.stopPropagation(); onEliminar(index) }}
                    className="text-gray-300 hover:text-red-500 transition-colors"
                  >✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Popup editar item */}
      {popup && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl p-6 w-80">
            <div className="text-sm font-medium text-[#3c3c3b] mb-4">{popup.item.nombre}</div>

            <div className="flex flex-col gap-4 mb-6">
              <div className="flex items-center gap-4">
                <label className="text-sm text-gray-600 w-24">Cantidad</label>
                <input
                  type="number"
                  min="1"
                  value={cantidadEdit}
                  onChange={e => setCantidadEdit(parseInt(e.target.value) || 1)}
                  className="w-24 h-10 text-center text-xl font-bold border-2 border-[#00a19a] rounded-lg focus:outline-none"
                  autoFocus
                />
              </div>
              <div className="flex items-center gap-4">
                <label className="text-sm text-gray-600 w-24">Descuento %</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={descuentoEdit || ''}
                  onChange={e => setDescuentoEdit(parseFloat(e.target.value.replace(/[^0-9,]/g, '').replace(',', '.')) || 0)}
                  className="w-24 h-10 text-center text-xl font-bold border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[#00a19a]"
                />
              </div>
            </div>

            <div className="text-sm text-gray-500 mb-4">
              Subtotal: <span className="font-semibold text-[#3c3c3b]">
                ${(popup.item.precio_unitario * cantidadEdit * (1 - descuentoEdit / 100))
                  .toLocaleString('es-AR', { minimumFractionDigits: 0 })}
              </span>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setPopup(null)}
                className="flex-1 h-10 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarPopup}
                className="flex-1 h-10 bg-[#00a19a] text-white rounded-lg text-sm hover:bg-[#008f89]"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}