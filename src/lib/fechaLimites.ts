/**
 * Límites para los <input type="date"> y <input type="month"> del sistema.
 *
 * Sirven para que el navegador rechace años absurdos por error de tipeo
 * (ej. "20266" en vez de "2026"), que hoy pasan sin ningún aviso.
 */

/** Piso: no hay fecha operativa del negocio anterior a 2015. */
export const FECHA_MIN = '2015-01-01'

/**
 * Techo dinámico: hoy + 2 años, en formato 'YYYY-MM-DD'.
 * Deja margen para fechas futuras legítimas (vencimientos, validez de
 * presupuestos) sin permitir años disparatados.
 */
export function fechaMax(): string {
  const d = new Date()
  d.setFullYear(d.getFullYear() + 2)
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
}

/**
 * Variantes en formato 'YYYY-MM' para los <input type="month">, que segun el
 * estandar HTML esperan mes (no dia) en min/max.
 */
export const FECHA_MIN_MES = FECHA_MIN.slice(0, 7)

export function fechaMaxMes(): string {
  return fechaMax().slice(0, 7)
}
