// Ruta destino: C:\Users\Usuario\Documents\sistema-habitus-sd\src\lib\tienda\catalogoUtil.ts
//
// Funciones puras del catálogo de la Vitrina (sin acceso a base de datos), así
// las pueden importar tanto el servidor (tienda/page.tsx) como el navegador
// (components/tienda/CatalogoTienda.tsx). Antes vivían dentro de tienda/page.tsx.

import { compararSabores } from '@/lib/ordenSabores'

export interface VarianteCatalogo {
  id: number
  sabor: string | null
  atributo_valor: string | null
  precio: number
  precio_original: number
  en_oferta: boolean
  stock: number
  imagen_url: string | null
}

export interface FilaCatalogo extends VarianteCatalogo {
  nombre: string
  nombre_base: string | null
  rubro: string | null
  marca_id: number | null
  marca: string | null
}

export interface GrupoProducto {
  key: string
  titulo: string
  marca: string | null
  rubro: string | null
  variantes: VarianteCatalogo[]
}

// Mismo criterio de búsqueda que el resto del sistema: tokenizada, sin
// acentos/mayúsculas (ver Artículos, Actualizar Precios, Actualizar Fotos).
export function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

// Equivalencias de búsqueda: cada grupo son raíces de palabras que significan
// lo mismo (español / inglés / ortografías distintas). Se escriben ya
// normalizadas (sin tildes, minúsculas). Para sumar una equivalencia nueva,
// agregar un grupo acá: no hay que tocar nada más.
const EQUIVALENCIAS: string[][] = [
  ['colag', 'collag'],                 // colágeno, colageno, collagen
  ['protein', 'whey'],                 // proteína, protein, whey
  ['creatin'],                         // creatina, creatine (por si se escribe en inglés)
  ['quemad', 'burner', 'termogen'],    // quemador, fat burner
  ['aminoacid', 'amino'],              // aminoácidos, amino
  ['isoton', 'hidrat'],                // isotónica, hidratación
]

// Un término escrito por el cliente puede coincidir con más de una forma.
// Si es raíz (o empieza con la raíz) de un grupo, se aceptan todas las del
// grupo. Mínimo 3 letras para no abrir la búsqueda de más con "co" o "pr".
function formasDelTermino(t: string): string[] {
  const formas = new Set<string>([t])
  if (t.length >= 3) {
    for (const grupo of EQUIVALENCIAS) {
      if (grupo.some(raiz => raiz.startsWith(t) || t.startsWith(raiz))) {
        grupo.forEach(raiz => formas.add(raiz))
      }
    }
  }
  return [...formas]
}

// Todas las palabras escritas deben aparecer (en cualquier orden y en
// cualquiera de sus formas equivalentes).
export function coincideBusqueda(texto: string, busqueda: string): boolean {
  return busqueda.split(/\s+/).filter(Boolean).every(t =>
    formasDelTermino(t).some(forma => texto.includes(forma))
  )
}

// Agrupa por nombre_base + marca (sistema de Sabores). Los artículos sin
// nombre_base se muestran sueltos. Devuelve los grupos en orden alfabético
// fijo (es el orden que ve el servidor / Google; el navegador lo mezcla).
export function agrupar(filas: FilaCatalogo[]): GrupoProducto[] {
  const mapa = new Map<string, GrupoProducto>()
  for (const a of filas) {
    const key = a.nombre_base ? `${a.nombre_base}||${a.marca_id ?? ''}` : `single-${a.id}`
    const variante: VarianteCatalogo = {
      id: a.id,
      sabor: a.sabor,
      atributo_valor: a.atributo_valor,
      precio: a.precio,
      precio_original: a.precio_original,
      en_oferta: a.en_oferta,
      stock: a.stock,
      imagen_url: a.imagen_url,
    }
    const existente = mapa.get(key)
    if (existente) {
      existente.variantes.push(variante)
    } else {
      mapa.set(key, {
        key,
        titulo: a.nombre_base || a.nombre,
        marca: a.marca,
        rubro: a.rubro,
        variantes: [variante],
      })
    }
  }
  // Sabor alfabético dentro de cada grupo; "Neutro" siempre al final de los
  // sabores y los sin sabor después (ver lib/ordenSabores.ts)
  for (const g of mapa.values()) {
    g.variantes.sort((a, b) => compararSabores(a.sabor, b.sabor))
  }
  return [...mapa.values()].sort((a, b) => a.titulo.localeCompare(b.titulo, 'es'))
}

export function hayStock(g: GrupoProducto): boolean {
  return g.variantes.some(v => v.stock > 0)
}

export function precioMinimo(g: GrupoProducto): number {
  return Math.min(...g.variantes.map(v => v.precio))
}

// Fisher-Yates: barajado uniforme de verdad (a diferencia de usar
// Math.random() como comparador de .sort(), que da resultados sesgados
// según el algoritmo de ordenamiento del motor).
export function barajar<T>(arr: T[]): T[] {
  const copia = [...arr]
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copia[i], copia[j]] = [copia[j], copia[i]]
  }
  return copia
}
