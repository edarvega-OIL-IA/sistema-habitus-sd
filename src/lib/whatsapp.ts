// Ruta destino: C:\Users\Usuario\Documents\sistema-habitus-sd\src\lib\whatsapp.ts
//
// Normaliza un número de WhatsApp a formato internacional "+<código><número>" sin espacios.
// - Si el usuario escribe "+..." o "00...", se respeta el número internacional tal cual.
// - Si escribe solo el número local, se le antepone el código del país elegido (por defecto Argentina, 54).
// - Argentina: se quita el 0 inicial y el 15 ("0299 15 574-1735" → "+5492995741735"),
//   y se agrega el 9 que exige WhatsApp para celulares ("+54 9 ...").
// Devuelve null si el número no es válido.

export interface PaisWhatsapp {
  codigo: string // código telefónico sin "+"
  nombre: string
  bandera: string
}

export const PAISES_WHATSAPP: PaisWhatsapp[] = [
  { codigo: '54', nombre: 'Argentina', bandera: '🇦🇷' },
  { codigo: '56', nombre: 'Chile', bandera: '🇨🇱' },
  { codigo: '598', nombre: 'Uruguay', bandera: '🇺🇾' },
  { codigo: '595', nombre: 'Paraguay', bandera: '🇵🇾' },
  { codigo: '591', nombre: 'Bolivia', bandera: '🇧🇴' },
  { codigo: '55', nombre: 'Brasil', bandera: '🇧🇷' },
  { codigo: '51', nombre: 'Perú', bandera: '🇵🇪' },
]

export const CODIGO_PAIS_POR_DEFECTO = '54'

const INTERNACIONAL_VALIDO = /^\+\d{8,15}$/

// Argentina: deja los 10 dígitos "código de área + número" (sin 0, sin 15, sin 54, sin 9).
function soloDiezDigitosArgentina(digitos: string): string | null {
  let d = digitos

  // Prefijo de país escrito sin "+" (ej. "5492995741735" o "542995741735")
  if (d.startsWith('54') && (d.length === 12 || d.length === 13)) d = d.slice(2)
  // El 9 de celular
  if (d.startsWith('9') && d.length === 11) d = d.slice(1)
  // El 0 del código de área
  if (d.startsWith('0')) d = d.slice(1)
  // El 15 de celular, después del código de área (2, 3 o 4 dígitos)
  if (d.length === 12) {
    for (const k of [2, 3, 4]) {
      if (d.slice(k, k + 2) === '15') {
        d = d.slice(0, k) + d.slice(k + 2)
        break
      }
    }
  }
  return d.length === 10 ? d : null
}

export function normalizarWhatsapp(entrada: string, codigoPais: string = CODIGO_PAIS_POR_DEFECTO): string | null {
  const limpio = entrada.trim().replace(/[\s().-]/g, '')
  if (!limpio) return null

  // Ya viene en formato internacional
  if (limpio.startsWith('+') || limpio.startsWith('00')) {
    const digitos = limpio.replace(/^\+|^00/, '')
    if (!/^\d+$/.test(digitos)) return null
    // Argentina escrita con "+54": se normaliza igual (agrega el 9, quita 0/15)
    if (digitos.startsWith('54')) {
      const local = soloDiezDigitosArgentina(digitos)
      return local ? `+549${local}` : null
    }
    const internacional = `+${digitos}`
    return INTERNACIONAL_VALIDO.test(internacional) ? internacional : null
  }

  if (!/^\d+$/.test(limpio)) return null

  if (codigoPais === '54') {
    const local = soloDiezDigitosArgentina(limpio)
    return local ? `+549${local}` : null
  }

  // Otros países: se quita el 0 inicial y se antepone el código
  const internacional = `+${codigoPais}${limpio.replace(/^0+/, '')}`
  return INTERNACIONAL_VALIDO.test(internacional) ? internacional : null
}
