// Ruta destino: C:\Users\Usuario\Documents\sistema-habitus-sd\src\components\tienda\CarruselCategorias.tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Categoria {
  rubro: string
  imagen: string
}

interface Props {
  categorias: Categoria[]
}

export default function CarruselCategorias({ categorias }: Props) {
  const [pausado, setPausado] = useState(false)
  const [reducirMovimiento, setReducirMovimiento] = useState(false)

  // Respeta la preferencia de accesibilidad del sistema operativo/navegador
  // (gente con problemas vestibulares configura esto para evitar mareos).
  // Si está activa, el carrusel no anima — se muestra como grilla estática.
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducirMovimiento(media.matches)
    const listener = (e: MediaQueryListEvent) => setReducirMovimiento(e.matches)
    media.addEventListener('change', listener)
    return () => media.removeEventListener('change', listener)
  }, [])

  if (categorias.length === 0) return null

  // Fila de arriba: A→Z, se mueve hacia la izquierda.
  // Fila de abajo: Z→A (mismo set, orden invertido), se mueve hacia la derecha.
  const filaArriba = [...categorias].sort((a, b) => a.rubro.localeCompare(b.rubro, 'es'))
  const filaAbajo = [...filaArriba].reverse()

  if (reducirMovimiento) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {filaArriba.map(c => (
          <BannerCategoria key={c.rubro} categoria={c} />
        ))}
      </div>
    )
  }

  return (
    <>
      <style>{`
        @keyframes carrusel-categorias {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .animate-carrusel {
          animation-name: carrusel-categorias;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
      `}</style>
      <div
        className="space-y-8 overflow-hidden"
        onMouseEnter={() => setPausado(true)}
        onMouseLeave={() => setPausado(false)}
        onTouchStart={() => setPausado(true)}
        onTouchEnd={() => setPausado(false)}
      >
        <FilaCarrusel categorias={filaArriba} direccion="izquierda" pausado={pausado} />
        <FilaCarrusel categorias={filaAbajo} direccion="derecha" pausado={pausado} />
      </div>
    </>
  )
}

function FilaCarrusel({
  categorias,
  direccion,
  pausado,
}: {
  categorias: Categoria[]
  direccion: 'izquierda' | 'derecha'
  pausado: boolean
}) {
  // Se duplica la tira para que el loop sea continuo: cuando la primera
  // copia termina de salir, la segunda ya está ocupando su lugar exacto,
  // sin salto visible al reiniciar la animación.
  const tira = [...categorias, ...categorias]
  const duracionSeg = Math.max(categorias.length * 9, 40)

  return (
    <div className="flex gap-3 w-max animate-carrusel"
      style={{
        animationDirection: direccion === 'derecha' ? 'reverse' : 'normal',
        animationDuration: `${duracionSeg}s`,
        animationPlayState: pausado ? 'paused' : 'running',
      }}
    >
      {tira.map((c, i) => (
        <BannerCategoria key={`${c.rubro}-${i}`} categoria={c} className="w-[260px] sm:w-[300px] shrink-0" />
      ))}
    </div>
  )
}

function BannerCategoria({ categoria, className = '' }: { categoria: Categoria; className?: string }) {
  return (
    <Link
      href={`/tienda?rubro=${encodeURIComponent(categoria.rubro)}`}
      className={`block rounded-lg overflow-hidden border border-border-gray hover:opacity-90 transition-opacity ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={categoria.imagen} alt={categoria.rubro} className="w-full h-auto block" loading="lazy" />
    </Link>
  )
}
