// Ruta destino: C:\Users\Usuario\Documents\sistema-habitus-sd\src\components\tienda\CarruselCategorias.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

interface Categoria {
  rubro: string
  imagen: string
}

interface Props {
  categorias: Categoria[]
}

export default function CarruselCategorias({ categorias }: Props) {
  const [reducirMovimiento, setReducirMovimiento] = useState(false)
  // Ref en vez de estado: se lee dentro de un loop de animación en cada
  // cuadro, y no necesita disparar un re-render de React al cambiar.
  const pausadoRef = useRef(false)

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
    <div
      className="space-y-8 overflow-hidden"
      onMouseEnter={() => { pausadoRef.current = true }}
      onMouseLeave={() => { pausadoRef.current = false }}
    >
      <FilaCarrusel categorias={filaArriba} direccion="izquierda" pausadoRef={pausadoRef} />
      <FilaCarrusel categorias={filaAbajo} direccion="derecha" pausadoRef={pausadoRef} />
    </div>
  )
}

function FilaCarrusel({
  categorias,
  direccion,
  pausadoRef,
}: {
  categorias: Categoria[]
  direccion: 'izquierda' | 'derecha'
  pausadoRef: React.RefObject<boolean>
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const posRef = useRef(0) // posición actual, siempre en (-loopWidth, 0]
  const loopWidthRef = useRef(0)
  const draggingRef = useRef(false)
  const dragStartXRef = useRef(0)
  const dragStartPosRef = useRef(0)
  const dragDistanciaRef = useRef(0)

  const duracionSeg = Math.max(categorias.length * 9, 40)
  // Tira triplicada (no solo duplicada): un arrastre manual rápido puede
  // recorrer más distancia de una sola vez que el auto-scroll solo, y así
  // queda margen antes de que se vea la costura del loop.
  const tira = [...categorias, ...categorias, ...categorias]

  // Mide el ancho real de UNA copia de la tira (para el loop infinito).
  // Se mide en el DOM en vez de calcularlo a mano porque el ancho de cada
  // banner cambia según el breakpoint (clases responsive de Tailwind).
  useEffect(() => {
    function medir() {
      if (trackRef.current) loopWidthRef.current = trackRef.current.scrollWidth / 3
    }
    medir()
    window.addEventListener('resize', medir)
    return () => window.removeEventListener('resize', medir)
  }, [categorias])

  // Loop de animación: mueve la posición sola, salvo mientras se está
  // arrastrando o mientras el mouse está encima (pausadoRef). El arrastre
  // manual escribe directo sobre posRef en onPointerMove, así que ambos
  // caminos terminan en el mismo lugar: aplicar posRef al transform.
  useEffect(() => {
    let raf: number
    let ultimo = performance.now()
    const signo = direccion === 'izquierda' ? -1 : 1

    function tick(ahora: number) {
      const dt = (ahora - ultimo) / 1000
      ultimo = ahora
      const loopWidth = loopWidthRef.current

      if (loopWidth > 0 && !draggingRef.current && !pausadoRef.current) {
        const velocidad = loopWidth / duracionSeg
        posRef.current += signo * velocidad * dt
      }
      if (loopWidth > 0) {
        posRef.current = ((posRef.current % loopWidth) + loopWidth) % loopWidth
        if (trackRef.current) trackRef.current.style.transform = `translateX(${-posRef.current}px)`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [direccion, duracionSeg, pausadoRef])

  function onPointerDown(e: React.PointerEvent) {
    draggingRef.current = true
    dragStartXRef.current = e.clientX
    dragStartPosRef.current = posRef.current
    dragDistanciaRef.current = 0
    trackRef.current?.setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!draggingRef.current) return
    const delta = e.clientX - dragStartXRef.current
    dragDistanciaRef.current = Math.abs(delta)
    // Arrastrar hacia la izquierda avanza el carrusel hacia la izquierda
    // (mismo criterio que cualquier carrusel táctil: el contenido "sigue"
    // al dedo/mouse).
    posRef.current = dragStartPosRef.current - delta
  }

  function onPointerUp() {
    draggingRef.current = false
  }

  function onClickCapture(e: React.MouseEvent) {
    // Si hubo un arrastre real (no un simple click), no dejar que el link
    // de abajo navegue — evita abrir una categoría sin querer al soltar.
    if (dragDistanciaRef.current > 5) {
      e.preventDefault()
      e.stopPropagation()
    }
  }

  return (
    <div
      ref={trackRef}
      className="flex gap-3 w-max cursor-grab active:cursor-grabbing select-none"
      style={{ touchAction: 'pan-y' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClickCapture={onClickCapture}
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
      draggable={false}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={categoria.imagen}
        alt={categoria.rubro}
        className="w-full h-auto block pointer-events-none"
        loading="lazy"
        draggable={false}
      />
    </Link>
  )
}
