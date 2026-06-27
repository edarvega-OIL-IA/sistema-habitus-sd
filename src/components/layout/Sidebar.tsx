'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

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

  return (
    <aside className="w-56 min-h-screen bg-[#3c3c3b] flex flex-col">
      <div className="px-4 py-5 border-b border-white/10">
        <span className="text-white font-bold text-lg tracking-widest">HÁBITUS SD</span>
      </div>
      <nav className="flex-1 py-4">
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
  )
}
