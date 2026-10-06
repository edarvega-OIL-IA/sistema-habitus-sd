// Ruta destino: C:\Users\Usuario\Documents\sistema-habitus-sd\src\components\mayoristas\InputMonto.tsx
//
// Campo de monto con formato argentino (409.099,63).
// - El valor que maneja el formulario ("value" / "onChange") es SIEMPRE canónico:
//   texto con punto decimal y sin separador de miles (ej. "409099.63"). Así el resto
//   del código (num(), Number(), RPC) sigue funcionando igual.
// - Al salir del campo se muestra con formato es-AR. Al entrar se muestra para editar
//   con coma decimal y sin puntos de miles (ej. "409099,63").
// - Al tipear acepta "409.099,63", "409099,63" y también "409099.63".
'use client'

import { useState } from 'react'

// Texto tipeado → valor canónico (punto decimal, sin miles). Si no es un número válido
// devuelve igual el texto limpio, para que la validación del formulario lo marque.
export function parseMonto(texto: string): string {
  let s = texto.replace(/[\s$]/g, '')
  if (s.includes(',')) {
    // Con coma: los puntos son separadores de miles
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    // Sin coma y con grupos de 3 dígitos (1.500 / 409.099): puntos de miles
    s = s.replace(/\./g, '')
  }
  return s
}

// Valor canónico → texto con formato es-AR
export function formatMonto(canonico: string, maxDecimales = 2): string {
  const n = Number(canonico)
  if (canonico.trim() === '' || !Number.isFinite(n)) return canonico
  return n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: maxDecimales })
}

interface Props {
  value: string
  onChange: (valor: string) => void
  maxDecimales?: number
  className?: string
  placeholder?: string
  disabled?: boolean
}

export default function InputMonto({ value, onChange, maxDecimales = 2, className, placeholder, disabled }: Props) {
  const [enFoco, setEnFoco] = useState(false)
  const [texto, setTexto] = useState('')

  const mostrado = enFoco ? texto : formatMonto(value, maxDecimales)

  return (
    <input
      type="text"
      inputMode="decimal"
      value={mostrado}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
      onFocus={() => { setTexto(value.replace('.', ',')); setEnFoco(true) }}
      onChange={e => { setTexto(e.target.value); onChange(parseMonto(e.target.value)) }}
      onBlur={() => setEnFoco(false)}
    />
  )
}
