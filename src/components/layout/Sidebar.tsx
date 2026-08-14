'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Menu, X, ChevronDown } from 'lucide-react'

const nav = [
  { label: 'Dashboard', href: '/dashboard', icon: '⊞' },
  { label: 'Caja', href: '/cierre-turno', icon: '🔒' },
  { label: 'Ventas', href: '/ventas', icon: '🛒' },
  { label: 'Registro Ventas', href: '/ventas/registro', icon: '🧾' },
  { label: 'Pedidos Web', href: '/pedidos-web', icon: '🌐' },
  { label: 'Fiscalización', href: '/fiscalizacion', icon: '⚠️' },
  { label: 'Movimientos', href: '/movimientos', icon: '💰' },
  { label: 'Obligaciones', href: '/obligaciones', icon: '📇' },
  {
    label: 'Artículos',
    icon: '📦',
    children: [
      { label: 'Administrar Artículos', href: '/articulos' },
      { label: 'Actualizar Precios', href: '/articulos/precios' },
      { label: 'Actualizar Fotos', href: '/articulos/fotos' },
      { label: 'Historial de Artículos', href: '/articulos/historial' },
      { label: 'Movimientos de Stock', href: '/stock' },
    ],
  },
  { label: 'Compras', href: '/compras', icon: '🚚' },
  { label: 'Reportes', href: '/reportes', icon: '📊' },
  { label: 'Configuración', href: '/configuracion', icon: '⚙️' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [abierto, setAbierto] = useState(false)

  // Grupo "Artículos" arranca abierto si la ruta actual pertenece a él
  const grupoArticulosActivo = ['/articulos', '/stock'].some(h => pathname.startsWith(h))
  const [grupoArticulosAbierto, setGrupoArticulosAbierto] = useState(grupoArticulosActivo)

  // Cierra el menú mobile automáticamente al navegar a otra pantalla
  useEffect(() => {
    setAbierto(false)
  }, [pathname])

  function esActivo(href: string) {
    // Prefijo más largo entre todas las rutas del menú que matchea el
    // pathname actual — evita que, por ej., "/articulos" quede resaltado
    // al mismo tiempo que "/articulos/precios".
    const todasLasRutas = nav.flatMap(item => item.children ? item.children.map(c => c.href) : [item.href])
    let mejor: string | null = null
    for (const h of todasLasRutas) {
      if (pathname === h || pathname.startsWith(h + '/')) {
        if (!mejor || h.length > mejor.length) mejor = h
      }
    }
    return href === mejor
  }

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

      {/* Fijo siempre (mobile y desktop) — antes en desktop era "static" y
          hacía scroll junto con el contenido de la página. El layout
          (SistemaLayout) compensa este cambio con un margen izquierdo en el
          contenido (md:ml-56) para que no quede tapado. */}
      <aside
        className={`w-56 h-screen bg-[#3c3c3b] flex flex-col fixed inset-y-0 left-0 z-50 transition-transform duration-200 ease-in-out ${
          abierto ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="px-4 py-5 border-b border-white/10 flex items-center justify-between shrink-0">
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
            if (item.children) {
              const activo = grupoArticulosActivo
              return (
                <div key={item.label}>
                  <button
                    onClick={() => setGrupoArticulosAbierto(prev => !prev)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                      activo ? 'text-white' : 'text-white/70 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <span>{item.icon}</span>
                    <span className="flex-1 text-left">{item.label}</span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${grupoArticulosAbierto ? 'rotate-180' : ''}`} />
                  </button>
                  {grupoArticulosAbierto && (
                    <div className="pb-1">
                      {item.children.map(child => (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={`flex items-center gap-3 pl-11 pr-4 py-2 text-sm transition-colors ${
                            esActivo(child.href)
                              ? 'bg-[#00a19a] text-white'
                              : 'text-white/60 hover:text-white hover:bg-white/5'
                          }`}
                        >
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                  esActivo(item.href)
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
