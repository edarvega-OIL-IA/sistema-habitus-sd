// Ruta destino: C:\Users\Usuario\Documents\sistema-habitus-sd\src\components\tienda\CarritoContext.tsx
'use client'

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'

export interface ItemCarrito {
  articuloId: number
  nombreBase: string
  sabor: string | null
  marca: string | null
  rubro: string | null
  precio: number
  cantidad: number
  imagenUrl: string | null
  stockDisponible: number
}

interface CarritoContextType {
  items: ItemCarrito[]
  cargado: boolean
  agregar: (item: Omit<ItemCarrito, 'cantidad'>, cantidad: number) => void
  quitar: (articuloId: number) => void
  actualizarCantidad: (articuloId: number, cantidad: number) => void
  vaciar: () => void
  cantidadTotal: number
  totalPrecio: number
}

const CarritoContext = createContext<CarritoContextType | undefined>(undefined)
const STORAGE_KEY = 'habitus_carrito_web'

export function CarritoProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ItemCarrito[]>([])
  // No hay usuario/sesión en la vitrina pública — el carrito vive en el
  // navegador del cliente. "cargado" evita pisar el localStorage con un
  // array vacío antes de haber terminado de leerlo (efecto de montaje).
  const [cargado, setCargado] = useState(false)

  useEffect(() => {
    try {
      const guardado = localStorage.getItem(STORAGE_KEY)
      if (guardado) setItems(JSON.parse(guardado))
    } catch {
      // localStorage corrupto o inaccesible — arrancamos con carrito vacío
    }
    setCargado(true)
  }, [])

  useEffect(() => {
    if (!cargado) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [items, cargado])

  const agregar = useCallback((item: Omit<ItemCarrito, 'cantidad'>, cantidad: number) => {
    setItems(prev => {
      const existente = prev.find(i => i.articuloId === item.articuloId)
      if (existente) {
        const nuevaCantidad = Math.min(existente.cantidad + cantidad, item.stockDisponible)
        return prev.map(i => i.articuloId === item.articuloId ? { ...i, cantidad: nuevaCantidad } : i)
      }
      return [...prev, { ...item, cantidad: Math.min(cantidad, item.stockDisponible) }]
    })
  }, [])

  const quitar = useCallback((articuloId: number) => {
    setItems(prev => prev.filter(i => i.articuloId !== articuloId))
  }, [])

  const actualizarCantidad = useCallback((articuloId: number, cantidad: number) => {
    setItems(prev => prev.map(i => {
      if (i.articuloId !== articuloId) return i
      const clamped = Math.max(1, Math.min(cantidad, i.stockDisponible))
      return { ...i, cantidad: clamped }
    }))
  }, [])

  const vaciar = useCallback(() => setItems([]), [])

  const cantidadTotal = items.reduce((s, i) => s + i.cantidad, 0)
  const totalPrecio = items.reduce((s, i) => s + i.precio * i.cantidad, 0)

  return (
    <CarritoContext.Provider value={{ items, cargado, agregar, quitar, actualizarCantidad, vaciar, cantidadTotal, totalPrecio }}>
      {children}
    </CarritoContext.Provider>
  )
}

export function useCarrito() {
  const ctx = useContext(CarritoContext)
  if (!ctx) throw new Error('useCarrito debe usarse dentro de <CarritoProvider>')
  return ctx
}
