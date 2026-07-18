'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Menu, X } from 'lucide-react'

const nav = [
  { label: 'Dashboard', href: '/dashboard', icon: '⊞' },
  { label: 'Caja', href: '/cierre-turno', icon: '🔒' },
  { label: 'Ventas', href: '/ventas', icon: '🛒' },
  { label: 'Registro Ventas', href: '/ventas/registro', icon: '🧾' },
  { label: 'Movimientos', href: '/movimientos', icon: '💰' },
  { label: 'Stock', href: '/stock', icon: '🔄' },
  { label: 'Compras', href: '/compras', icon: '🚚' },
  { label: 'Artículos', href: '/articulos', icon: '📦' },
  { label: 'Reportes', href: '/reportes', icon: '📊' },
  { label: 'Configuración', href: '/configuracion', icon: '⚙️' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [abierto, setAbierto] = useState(false)

  // Cierra el menú mobile automáticamente al navegar a otra pantalla
  useEffect(() => {
    setAbierto(false)
  }, [pathname])

  return (
    <>
      {/* Botón hamburguesa — solo visible en mobile, oculto cuando el menú ya está abierto */}
      <button
        onClick={() => setAbierto(true)}
        className={`md:hidden fixed top-3 left-3 z-40 w-10 h-10 rounded-lg bg-[#3c3c3b] text-white flex items-center justify-center shadow-lg transition-opacity ${
          abierto ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
        aria-label="Abrir menú"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Fondo oscuro al abrir el menú en mobile */}
      {abierto && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setAbierto(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`w-56 min-h-screen bg-[#3c3c3b] flex flex-col fixed md:static inset-y-0 left-0 z-50 transition-transform duration-200 ease-in-out ${
          abierto ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="px-4 py-5 border-b border-white/10 flex items-center justify-between">
          <span className="text-white font-bold text-lg tracking-widest">HÁBITUS SD</span>
          <button
            onClick={() => setAbierto(false)}
            className="md:hidden text-white/70 hover:text-white"
            aria-label="Cerrar menú"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="flex-1 py-4 overflow-y-auto">
          {nav.map(item => {
            const active = item.href === '/ventas' ? pathname === '/ventas' : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                  active
                    ? 'bg-[#00a19a] text-white'
                    : 'text-white/70 hover:text-white hover:bg-white/5'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </aside>
    </>
  )
}
