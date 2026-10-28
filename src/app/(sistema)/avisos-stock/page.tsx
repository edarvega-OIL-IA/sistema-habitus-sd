// Ruta destino: C:\Users\Usuario\Documents\sistema-habitus-sd\src\app\(sistema)\avisos-stock\page.tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { armarSlugProducto } from '@/lib/slug'
import { normalizarWhatsapp } from '@/lib/whatsapp'
import { MessageCircle, Mail, Check, Trash2, Undo2, Pencil, Plus, Store } from 'lucide-react'

interface Aviso {
  id: number
  articulo_id: number
  nombre: string | null // avisos viejos (anteriores al 16/10/2026) no tienen nombre
  medio_preferido: 'whatsapp' | 'email' | 'ambos' | 'ninguno' // 'ninguno' solo en pedidos del local sin datos de contacto
  whatsapp: string | null
  email: string | null
  creado_en: string
  avisado: boolean
  avisado_en: string | null
  origen: 'web' | 'local' // 'local' = lo cargaron Ariel/Agustín desde esta pantalla
  nota: string | null // solo pedidos del local: para reconocer quién lo pidió
  registrado_por: string | null // solo pedidos del local: quién lo cargó
}

interface Articulo {
  id: number
  nombre: string
  nombre_base: string | null
}

interface Grupo {
  articuloId: number
  articulo: Articulo | undefined
  stock: number
  avisos: Aviso[]
  ultimoAvisoEn: string // solo se usa para ordenar la solapa Avisados
}

type Solapa = 'pendientes' | 'avisados'
type OrigenFiltro = 'todos' | 'local' | 'web'

const URL_TIENDA = 'https://www.habitussd.com'

// Mismo criterio de validación que la API de la tienda (api/avisos-stock/route.ts)
const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Formulario "Nuevo pedido del local"
interface FormNuevo {
  articulo: Articulo | null
  busqueda: string
  nombre: string
  whatsapp: string
  email: string
  nota: string
}
const FORM_NUEVO_VACIO: FormNuevo = { articulo: null, busqueda: '', nombre: '', whatsapp: '', email: '', nota: '' }

function soloDigitos(s: string): string {
  return s.replace(/\D/g, '')
}

// Mismo criterio de búsqueda que el resto del sistema: tokenizada, sin
// acentos/mayúsculas (ver Artículos, Actualizar Precios, tienda/page.tsx)
function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function fmtFecha(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })
}

export default function AvisosStockPage() {
  const [loading, setLoading] = useState(true)
  const [avisos, setAvisos] = useState<Aviso[]>([])
  const [articulosMap, setArticulosMap] = useState<Map<number, Articulo>>(new Map())
  const [stockMap, setStockMap] = useState<Map<number, number>>(new Map())
  const [trabajando, setTrabajando] = useState<number | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [orden, setOrden] = useState<'local' | 'stock' | 'cantidad'>('local')
  const [solapa, setSolapa] = useState<Solapa>('pendientes')
  const [esAdmin, setEsAdmin] = useState(false)
  const [notif, setNotif] = useState<{ tipo: 'error' | 'ok'; msg: string } | null>(null)
  // Cambiar producto de un aviso: aviso que tiene el panel abierto + catálogo
  // (se carga recién la primera vez que se abre el panel)
  const [cambiandoId, setCambiandoId] = useState<number | null>(null)
  const [catalogo, setCatalogo] = useState<Articulo[] | null>(null)
  const [cargandoCatalogo, setCargandoCatalogo] = useState(false)
  const [busquedaCambio, setBusquedaCambio] = useState('')
  // Pedidos del local: filtro por origen, nombre de quien está logueado
  // (se guarda en registrado_por) y formulario de carga
  const [origenFiltro, setOrigenFiltro] = useState<OrigenFiltro>('todos')
  const [usuarioNombre, setUsuarioNombre] = useState('')
  const [mostrarNuevo, setMostrarNuevo] = useState(false)
  const [nuevo, setNuevo] = useState<FormNuevo>(FORM_NUEVO_VACIO)
  const [guardandoNuevo, setGuardandoNuevo] = useState(false)

  useEffect(() => { cargarDatos() }, [])

  // silencioso = true: recarga sin tapar la pantalla con "Cargando..."
  async function cargarDatos(silencioso = false) {
    if (!silencioso) setLoading(true)
    const supabase = createClient()

    // Borrar es solo para el Admin (rol_id = 1, mismo criterio que
    // Actualizar Precios). Mientras no haya permisos por pantalla/acción,
    // Agustín también figura como Admin.
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: usuarioData } = await supabase
        .from('usuarios').select('rol_id, nombre, apellido').eq('id', user.id).single()
      setEsAdmin(usuarioData?.rol_id === 1)
      setUsuarioNombre([usuarioData?.nombre, usuarioData?.apellido].filter(Boolean).join(' '))
    }

    const { data: avisosData } = await supabase
      .from('avisos_stock')
      .select('id, articulo_id, nombre, medio_preferido, whatsapp, email, creado_en, avisado, avisado_en, origen, nota, registrado_por')
      .order('creado_en', { ascending: true })
    setAvisos(avisosData || [])

    if (avisosData && avisosData.length > 0) {
      const articuloIds = [...new Set(avisosData.map(a => a.articulo_id))]

      const { data: articulosData } = await supabase
        .from('articulos')
        .select('id, nombre, nombre_base')
        .in('id', articuloIds)
      setArticulosMap(new Map((articulosData || []).map(a => [a.id, a])))

      // Stock separado (tabla articulo_stock, no una columna en articulos) —
      // sumado por las dudas de que en algún momento haya más de una sucursal.
      const { data: stockData } = await supabase
        .from('articulo_stock')
        .select('articulo_id, stock_actual')
        .in('articulo_id', articuloIds)
      const nuevoStockMap = new Map<number, number>()
      for (const fila of stockData || []) {
        nuevoStockMap.set(fila.articulo_id, (nuevoStockMap.get(fila.articulo_id) || 0) + (fila.stock_actual || 0))
      }
      setStockMap(nuevoStockMap)
    }

    setLoading(false)
  }

  async function marcarAvisado(avisoId: number) {
    setTrabajando(avisoId)
    const supabase = createClient()
    const ahora = new Date().toISOString()
    const { error } = await supabase
      .from('avisos_stock')
      .update({ avisado: true, avisado_en: ahora })
      .eq('id', avisoId)
    if (error) {
      setNotif({ tipo: 'error', msg: 'No se pudo marcar como avisado: ' + error.message })
    } else {
      setAvisos(prev => prev.map(a => a.id === avisoId ? { ...a, avisado: true, avisado_en: ahora } : a))
    }
    setTrabajando(null)
  }

  async function marcarTodosDelGrupo(grupo: Grupo) {
    const supabase = createClient()
    const ids = grupo.avisos.map(a => a.id)
    const ahora = new Date().toISOString()
    const { error } = await supabase
      .from('avisos_stock')
      .update({ avisado: true, avisado_en: ahora })
      .in('id', ids)
    if (error) {
      setNotif({ tipo: 'error', msg: 'No se pudo marcar como avisados: ' + error.message })
      return
    }
    setAvisos(prev => prev.map(a => ids.includes(a.id) ? { ...a, avisado: true, avisado_en: ahora } : a))
  }

  async function volverAPendiente(aviso: Aviso) {
    setTrabajando(aviso.id)
    const supabase = createClient()
    const { error } = await supabase
      .from('avisos_stock')
      .update({ avisado: false, avisado_en: null })
      .eq('id', aviso.id)
    if (error) {
      // 23505 = índice único parcial: esa persona ya tiene otro aviso
      // pendiente para el mismo producto (volvió a pedirlo después de ser avisada).
      if (error.code === '23505') {
        setNotif({
          tipo: 'error',
          msg: 'Esa persona ya tiene un aviso pendiente para este producto (volvió a pedirlo). Podés eliminar este aviso viejo.',
        })
      } else {
        setNotif({ tipo: 'error', msg: 'No se pudo volver a pendiente: ' + error.message })
      }
    } else {
      setAvisos(prev => prev.map(a => a.id === aviso.id ? { ...a, avisado: false, avisado_en: null } : a))
      setNotif({ tipo: 'ok', msg: 'El aviso volvió a Pendientes.' })
    }
    setTrabajando(null)
  }

  // Borrado definitivo. Solo Admin (el botón no se muestra a otros, y
  // además se vuelve a chequear acá). .select('id') para detectar si RLS
  // dejó 0 filas borradas sin dar error.
  async function eliminarAvisos(ids: number[], descripcion: string) {
    if (!esAdmin || ids.length === 0) return
    const ok = window.confirm(`¿Eliminar definitivamente ${descripcion}?\n\nEsta acción no se puede deshacer.`)
    if (!ok) return

    const supabase = createClient()
    const { data, error } = await supabase
      .from('avisos_stock')
      .delete()
      .in('id', ids)
      .select('id')
    if (error) {
      setNotif({ tipo: 'error', msg: 'No se pudo eliminar: ' + error.message })
      return
    }
    const borrados = new Set((data || []).map(d => d.id))
    if (borrados.size === 0) {
      setNotif({ tipo: 'error', msg: 'No se eliminó nada (sin permiso o el aviso ya no existe).' })
      return
    }
    setAvisos(prev => prev.filter(a => !borrados.has(a.id)))
    setNotif({ tipo: 'ok', msg: borrados.size === 1 ? 'Aviso eliminado.' : `${borrados.size} avisos eliminados.` })
  }

  // ── Nuevo pedido del local ────────────────────────────────────────────
  // Cuando alguien pide en el local un producto sin stock. Se guarda con
  // origen = 'local', una nota para reconocer quién lo pidió y quién lo cargó.
  // Si el cliente deja el celular se agenda; si no, queda sin datos de contacto
  // (medio_preferido = 'ninguno', solo permitido para origen = 'local').
  async function abrirNuevo() {
    if (mostrarNuevo) { cerrarNuevo(); return }
    setMostrarNuevo(true)
    if (catalogo === null && !cargandoCatalogo) await cargarCatalogo()
  }

  function cerrarNuevo() {
    setMostrarNuevo(false)
    setNuevo(FORM_NUEVO_VACIO)
  }

  async function guardarPedidoLocal() {
    if (!nuevo.articulo) {
      setNotif({ tipo: 'error', msg: 'Elegí el producto que pidieron.' })
      return
    }
    const nombre = nuevo.nombre.trim().replace(/\s+/g, ' ')
    const nota = nuevo.nota.trim()
    const whatsappTxt = nuevo.whatsapp.trim()
    const emailTxt = nuevo.email.trim().toLowerCase()

    if (nombre.length > 80) {
      setNotif({ tipo: 'error', msg: 'El nombre es demasiado largo (máximo 80 caracteres).' })
      return
    }
    let whatsappFinal: string | null = null
    if (whatsappTxt) {
      whatsappFinal = normalizarWhatsapp(whatsappTxt)
      if (!whatsappFinal) {
        setNotif({ tipo: 'error', msg: 'El WhatsApp no parece válido.' })
        return
      }
    }
    if (emailTxt && !EMAIL_VALIDO.test(emailTxt)) {
      setNotif({ tipo: 'error', msg: 'El email no parece válido.' })
      return
    }
    // Aunque no dejen teléfono, tiene que haber algo para reconocer quién lo pidió
    if (!nombre && !nota && !whatsappFinal && !emailTxt) {
      setNotif({ tipo: 'error', msg: 'Poné al menos el nombre, un teléfono o una nota para reconocer quién lo pidió.' })
      return
    }

    const medio = whatsappFinal && emailTxt ? 'ambos' : whatsappFinal ? 'whatsapp' : emailTxt ? 'email' : 'ninguno'

    setGuardandoNuevo(true)
    const supabase = createClient()
    const { error } = await supabase.from('avisos_stock').insert({
      articulo_id: nuevo.articulo.id,
      nombre: nombre || null,
      medio_preferido: medio,
      whatsapp: whatsappFinal,
      email: emailTxt || null,
      origen: 'local',
      nota: nota || null,
      registrado_por: usuarioNombre || null,
    })

    if (error) {
      // 23505 = índice único parcial: esa persona (mismo WhatsApp o email)
      // ya tiene un aviso pendiente para este producto.
      if (error.code === '23505') {
        setNotif({
          tipo: 'error',
          msg: 'Ya hay un pedido pendiente de ese producto con ese WhatsApp/email. Si es otra persona, usá su propio contacto o dejalo sin teléfono con una nota.',
        })
      } else {
        setNotif({ tipo: 'error', msg: 'No se pudo guardar el pedido: ' + error.message })
      }
    } else {
      const nombreProducto = nuevo.articulo.nombre
      await cargarDatos(true)
      setSolapa('pendientes')
      cerrarNuevo()
      setNotif({ tipo: 'ok', msg: `Pedido del local anotado: "${nombreProducto}".` })
    }
    setGuardandoNuevo(false)
  }

  // ── Cambiar el producto de un aviso ───────────────────────────────────
  // Caso típico: se anotó "Magnesio Mega" pero el cliente pedía "Magnesio Seven".
  // Solo cambia articulo_id del aviso; no toca el artículo ni el contacto/fecha.
  async function cargarCatalogo() {
    setCargandoCatalogo(true)
    const supabase = createClient()
    const todos: Articulo[] = []
    const TAM = 1000 // límite de filas de Supabase por consulta
    let fallo = false
    for (let desde = 0; ; desde += TAM) {
      const { data, error } = await supabase
        .from('articulos')
        .select('id, nombre, nombre_base')
        .eq('activo', true)
        .order('id', { ascending: true })
        .range(desde, desde + TAM - 1)
      if (error) {
        setNotif({ tipo: 'error', msg: 'No se pudo cargar el listado de productos: ' + error.message })
        fallo = true
        break
      }
      todos.push(...(data || []))
      if (!data || data.length < TAM) break
    }
    if (!fallo) setCatalogo(todos)
    setCargandoCatalogo(false)
  }

  async function abrirCambio(avisoId: number) {
    if (cambiandoId === avisoId) { cerrarCambio(); return }
    setCambiandoId(avisoId)
    setBusquedaCambio('')
    if (catalogo === null && !cargandoCatalogo) await cargarCatalogo()
  }

  function cerrarCambio() {
    setCambiandoId(null)
    setBusquedaCambio('')
  }

  async function cambiarProducto(aviso: Aviso, nuevo: Articulo) {
    if (nuevo.id === aviso.articulo_id) {
      setNotif({ tipo: 'error', msg: 'Ese ya es el producto de este aviso.' })
      return
    }
    const actual = articulosMap.get(aviso.articulo_id)
    const quien = aviso.nombre || aviso.whatsapp || aviso.email || aviso.nota || 'sin datos'
    const ok = window.confirm(
      `¿Cambiar el producto del pedido de ${quien}?\n\nDe: ${actual ? actual.nombre : '#' + aviso.articulo_id}\nA: ${nuevo.nombre}`
    )
    if (!ok) return

    setTrabajando(aviso.id)
    const supabase = createClient()
    // .select('id') para detectar si RLS dejó 0 filas modificadas sin dar error
    const { data, error } = await supabase
      .from('avisos_stock')
      .update({ articulo_id: nuevo.id })
      .eq('id', aviso.id)
      .select('id')

    if (error) {
      // 23505 = índice único parcial: esa persona ya tiene otro aviso
      // pendiente para el producto elegido.
      if (error.code === '23505') {
        setNotif({
          tipo: 'error',
          msg: 'Esa persona ya tiene un aviso pendiente para ese producto. Si es el mismo pedido, eliminá este aviso duplicado.',
        })
      } else {
        setNotif({ tipo: 'error', msg: 'No se pudo cambiar el producto: ' + error.message })
      }
    } else if (!data || data.length === 0) {
      setNotif({ tipo: 'error', msg: 'No se modificó nada (sin permiso o el aviso ya no existe).' })
    } else {
      // Stock del producto nuevo (por si no estaba en la lista cargada)
      const { data: stockData } = await supabase
        .from('articulo_stock')
        .select('stock_actual')
        .eq('articulo_id', nuevo.id)
      const stockNuevo = (stockData || []).reduce((acc, f) => acc + (f.stock_actual || 0), 0)

      setAvisos(prev => prev.map(a => a.id === aviso.id ? { ...a, articulo_id: nuevo.id } : a))
      setArticulosMap(prev => new Map(prev).set(nuevo.id, nuevo))
      setStockMap(prev => new Map(prev).set(nuevo.id, stockNuevo))
      cerrarCambio()
      setNotif({ tipo: 'ok', msg: `Producto cambiado a "${nuevo.nombre}".` })
    }
    setTrabajando(null)
  }

  function linkProducto(articulo: Articulo): string {
    const titulo = articulo.nombre
    return `${URL_TIENDA}/tienda/producto/${armarSlugProducto(articulo.id, titulo)}`
  }

  function mensajeWhatsapp(articulo: Articulo, nombrePersona: string | null): string {
    const titulo = articulo.nombre
    const saludo = nombrePersona && nombrePersona.trim() ? `Hola ${nombrePersona.trim()}!` : 'Hola!'
    return `${saludo} Te escribimos porque nos pediste que te avisemos cuando tengamos stock de *${titulo}*\n\nPodés adquirirlo en Av. Roca 54 - Cinco Saltos o en nuestra página web\n${linkProducto(articulo)}\n\nGracias por elegirnos\n*Hábitus SD* - *Presentes en tu proceso*`
  }

  function linkWhatsapp(whatsapp: string, articulo: Articulo, nombrePersona: string | null): string {
    // Los números se guardan normalizados ("+5492995741735", ver src/lib/whatsapp.ts),
    // así que NO hay que volver a anteponer 549 (bug 08/10/2026: generaba
    // 5495492996204144). normalizarWhatsapp respeta lo que ya viene con "+" y
    // además arregla los números viejos guardados sin código de país.
    // wa.me quiere solo dígitos, sin "+".
    const normalizado = normalizarWhatsapp(whatsapp)
    const numero = soloDigitos(normalizado ?? whatsapp)
    return `https://wa.me/${numero}?text=${encodeURIComponent(mensajeWhatsapp(articulo, nombrePersona))}`
  }

  // Compose web de Gmail en vez de mailto: — mailto: depende de cuál sea el
  // cliente de mail predeterminado de Windows (en la práctica, Outlook sin
  // configurar, que tira error). Esto abre directo en el navegador.
  function linkMailtoGrupo(grupo: Grupo): string {
    const emails = grupo.avisos.filter(a => a.email).map(a => a.email as string)
    const titulo = grupo.articulo ? grupo.articulo.nombre : ''
    const asunto = `¡Ya hay stock de ${titulo}! — Hábitus SD`
    const cuerpo = grupo.articulo
      ? `Hola!\n\nTe escribimos porque nos pediste que te avisemos cuando tengamos stock de ${titulo}\n\nPodés adquirirlo en Av. Roca 54 - Cinco Saltos o en nuestra página web\n${linkProducto(grupo.articulo)}\n\nGracias por elegirnos\nHábitus SD - Presentes en tu proceso`
      : ''
    const params = new URLSearchParams({ view: 'cm', fs: '1', bcc: emails.join(','), su: asunto, body: cuerpo })
    return `https://mail.google.com/mail/?${params.toString()}`
  }

  const cantPendientes = avisos.filter(a => !a.avisado).length
  const cantAvisados = avisos.filter(a => a.avisado).length
  const enPendientes = solapa === 'pendientes'
  // Cantidades por origen dentro de la solapa actual (para los botones de filtro)
  const avisosDeSolapa = avisos.filter(a => a.avisado !== enPendientes)
  const cantLocal = avisosDeSolapa.filter(a => a.origen === 'local').length
  const cantWeb = avisosDeSolapa.length - cantLocal

  const grupos: Grupo[] = (() => {
    const mapa = new Map<number, Grupo>()
    for (const aviso of avisos) {
      if (aviso.avisado === enPendientes) continue // pendientes: avisado=false; avisados: avisado=true
      if (origenFiltro !== 'todos' && aviso.origen !== origenFiltro) continue
      const existente = mapa.get(aviso.articulo_id)
      if (existente) {
        existente.avisos.push(aviso)
      } else {
        mapa.set(aviso.articulo_id, {
          articuloId: aviso.articulo_id,
          articulo: articulosMap.get(aviso.articulo_id),
          stock: stockMap.get(aviso.articulo_id) ?? 0,
          avisos: [aviso],
          ultimoAvisoEn: '',
        })
      }
    }

    let lista = [...mapa.values()]

    for (const g of lista) {
      if (!enPendientes) {
        // Avisados: el último en ser avisado primero
        g.avisos.sort((a, b) => (b.avisado_en || '').localeCompare(a.avisado_en || ''))
        g.ultimoAvisoEn = g.avisos[0]?.avisado_en || ''
      } else {
        // Pendientes: primero los pedidos del local; dentro de cada tipo, el más antiguo primero
        g.avisos.sort((a, b) =>
          (a.origen === 'local' ? 0 : 1) - (b.origen === 'local' ? 0 : 1) ||
          a.creado_en.localeCompare(b.creado_en)
        )
      }
    }

    if (busqueda.trim()) {
      const textoBuscado = normalizar(busqueda.trim())
      lista = lista.filter(g => {
        const nombre = g.articulo ? (g.articulo.nombre) : ''
        return normalizar(nombre).includes(textoBuscado)
      })
    }

    return lista.sort((a, b) => {
      const nombreA = a.articulo ? (a.articulo.nombre) : ''
      const nombreB = b.articulo ? (b.articulo.nombre) : ''

      if (!enPendientes) {
        // Avisados: los avisados más recientemente arriba
        if (a.ultimoAvisoEn !== b.ultimoAvisoEn) return b.ultimoAvisoEn.localeCompare(a.ultimoAvisoEn)
        return nombreA.localeCompare(nombreB)
      }

      if (orden === 'local') {
        // Local primero: los productos con pedidos del local arriba (prioridad
        // al cliente que uno ve seguido); después, los que ya tienen stock
        const localA = a.avisos.some(x => x.origen === 'local') ? 0 : 1
        const localB = b.avisos.some(x => x.origen === 'local') ? 0 : 1
        if (localA !== localB) return localA - localB
        const stockA = a.stock > 0 ? 0 : 1
        const stockB = b.stock > 0 ? 0 : 1
        if (stockA !== stockB) return stockA - stockB
        return nombreA.localeCompare(nombreB)
      }

      if (orden === 'cantidad') {
        if (a.avisos.length !== b.avisos.length) return b.avisos.length - a.avisos.length
        return nombreA.localeCompare(nombreB)
      }

      // orden === 'stock': con stock disponible primero
      const listoA = a.stock > 0 ? 0 : 1
      const listoB = b.stock > 0 ? 0 : 1
      if (listoA !== listoB) return listoA - listoB
      return nombreA.localeCompare(nombreB)
    })
  })()

  // Búsqueda de productos (paneles "Cambiar producto" y "Nuevo pedido del
  // local"): tokenizada, sin acentos/mayúsculas
  function filtrarCatalogo(texto: string): Articulo[] {
    if (!catalogo || !texto.trim()) return []
    const tokens = normalizar(texto.trim()).split(/\s+/).filter(Boolean)
    return catalogo
      .filter(a => {
        const n = normalizar(a.nombre)
        return tokens.every(t => n.includes(t))
      })
      .slice(0, 8)
  }
  const resultadosCambio = filtrarCatalogo(busquedaCambio)
  const resultadosNuevo = filtrarCatalogo(nuevo.busqueda)

  if (loading) return <div className="p-6 text-sm text-gray-500">Cargando...</div>

  const botonSolapa = (id: Solapa, texto: string, cant: number) => (
    <button
      type="button"
      onClick={() => setSolapa(id)}
      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
        solapa === id
          ? 'border-[#00a19a] text-[#00a19a]'
          : 'border-transparent text-gray-500 hover:text-gray-700'
      }`}
    >
      {texto} <span className="text-xs opacity-70">({cant})</span>
    </button>
  )

  return (
    <div>
      <div className="mb-4 flex items-start justify-between flex-wrap gap-3">
        <div>
        <h1 className="text-xl font-semibold text-[#3c3c3b]">Avisos de Stock</h1>
        <p className="text-sm text-gray-500 mt-1">
          {enPendientes
            ? 'Gente que pidió que le avisemos cuando vuelva a haber stock de un producto. Los que ya tienen stock disponible aparecen primero.'
            : 'Gente a la que ya se le avisó. Quedan acá como historial, agrupados por producto.'}
        </p>
        </div>
        <button
          type="button"
          onClick={abrirNuevo}
          className="inline-flex items-center gap-1.5 bg-[#00a19a] text-white px-3 py-2 rounded text-sm font-medium hover:bg-[#008f89] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nuevo pedido del local
        </button>
      </div>

      {mostrarNuevo && (
        <div className="bg-white rounded-lg border border-[#00a19a] p-4 mb-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-[#3c3c3b]">Nuevo pedido del local</p>
            <button type="button" onClick={cerrarNuevo} className="text-xs text-gray-400 hover:text-gray-600">
              Cancelar
            </button>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Producto que pidieron</label>
            {nuevo.articulo ? (
              <div className="flex items-center justify-between gap-2 px-3 py-2 bg-[#00a19a]/10 border border-[#00a19a]/30 rounded text-sm text-[#3c3c3b]">
                <span>{nuevo.articulo.nombre}</span>
                <button
                  type="button"
                  onClick={() => setNuevo(n => ({ ...n, articulo: null, busqueda: '' }))}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Cambiar
                </button>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  autoFocus
                  placeholder="Buscar el producto..."
                  value={nuevo.busqueda}
                  onChange={e => setNuevo(n => ({ ...n, busqueda: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]"
                />
                {cargandoCatalogo ? (
                  <p className="text-xs text-gray-500 mt-2">Cargando productos...</p>
                ) : nuevo.busqueda.trim() && resultadosNuevo.length === 0 ? (
                  <p className="text-xs text-gray-500 mt-2">No hay productos activos que coincidan.</p>
                ) : (
                  resultadosNuevo.length > 0 && (
                    <div className="mt-2 divide-y divide-gray-100 bg-white border border-gray-200 rounded">
                      {resultadosNuevo.map(a => (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => setNuevo(n => ({ ...n, articulo: a, busqueda: '' }))}
                          className="w-full text-left px-3 py-2 text-sm text-[#3c3c3b] hover:bg-[#00a19a]/10"
                        >
                          {a.nombre}
                        </button>
                      ))}
                    </div>
                  )
                )}
              </>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Nombre (si lo dio)</label>
              <input
                type="text"
                value={nuevo.nombre}
                onChange={e => setNuevo(n => ({ ...n, nombre: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">WhatsApp (si lo dejó)</label>
              <input
                type="text"
                inputMode="tel"
                placeholder="Ej: 299 4567214"
                value={nuevo.whatsapp}
                onChange={e => setNuevo(n => ({ ...n, whatsapp: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Email (si lo dejó)</label>
              <input
                type="email"
                value={nuevo.email}
                onChange={e => setNuevo(n => ({ ...n, email: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Nota para reconocerlo</label>
              <input
                type="text"
                placeholder="Ej: viene a la tarde, entrena en Energym"
                value={nuevo.nota}
                onChange={e => setNuevo(n => ({ ...n, nota: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]"
              />
            </div>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-xs text-gray-400">
              Si no dejó datos, alcanza con una nota. Queda registrado que lo cargó {usuarioNombre || 'vos'}.
            </p>
            <button
              type="button"
              onClick={guardarPedidoLocal}
              disabled={guardandoNuevo}
              className="inline-flex items-center gap-1.5 bg-[#00a19a] text-white px-4 py-2 rounded text-sm font-medium hover:bg-[#008f89] transition-colors disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              {guardandoNuevo ? 'Guardando...' : 'Anotar pedido'}
            </button>
          </div>
        </div>
      )}

      {notif && (
        <div className={`rounded-lg border px-4 py-3 flex items-center justify-between gap-3 mb-4 ${
          notif.tipo === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'
        }`}>
          <p className="text-sm font-medium">{notif.msg}</p>
          <button onClick={() => setNotif(null)} className="opacity-50 hover:opacity-100 text-lg leading-none">✕</button>
        </div>
      )}

      <div className="flex border-b border-gray-200 mb-4">
        {botonSolapa('pendientes', 'Pendientes', cantPendientes)}
        {botonSolapa('avisados', 'Avisados', cantAvisados)}
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Buscar producto..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#00a19a]"
        />
        <div className="flex gap-1.5">
          {([['todos', 'Todos', cantLocal + cantWeb], ['local', 'Local', cantLocal], ['web', 'Web', cantWeb]] as const).map(([id, texto, cant]) => (
            <button
              key={id}
              type="button"
              onClick={() => setOrigenFiltro(id)}
              className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
                origenFiltro === id ? 'bg-[#3c3c3b] text-white border-[#3c3c3b]' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {texto} <span className="opacity-70">({cant})</span>
            </button>
          ))}
        </div>
        {enPendientes && (
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setOrden('local')}
              className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
                orden === 'local' ? 'bg-[#00a19a] text-white border-[#00a19a]' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
            >
              Local primero
            </button>
            <button
              type="button"
              onClick={() => setOrden('stock')}
              className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
                orden === 'stock' ? 'bg-[#00a19a] text-white border-[#00a19a]' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
            >
              Con stock primero
            </button>
            <button
              type="button"
              onClick={() => setOrden('cantidad')}
              className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
                orden === 'cantidad' ? 'bg-[#00a19a] text-white border-[#00a19a]' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
            >
              Más gente esperando
            </button>
          </div>
        )}
      </div>

      {grupos.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-sm text-gray-500">
          {busqueda.trim()
            ? 'No hay productos que coincidan con la búsqueda.'
            : enPendientes
              ? 'No hay avisos pendientes. 🎉'
              : 'Todavía no hay avisos marcados como avisados.'}
        </div>
      ) : (
        <div className="space-y-4">
          {grupos.map(grupo => {
            const stock = grupo.stock
            const hayStock = stock > 0
            const titulo = grupo.articulo ? (grupo.articulo.nombre) : `Artículo #${grupo.articuloId}`
            const tieneEmails = grupo.avisos.some(a => a.email)
            const idsGrupo = grupo.avisos.map(a => a.id)

            return (
              <div key={grupo.articuloId} className={`bg-white rounded-lg border p-4 ${enPendientes && hayStock ? 'border-[#00a19a]' : 'border-gray-200'}`}>
                <div className="flex items-start justify-between flex-wrap gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[#3c3c3b]">{titulo}</span>
                      {enPendientes && (hayStock ? (
                        <span className="text-xs bg-[#00a19a]/10 text-[#00a19a] px-2 py-0.5 rounded-full font-medium">
                          Hay stock ({stock})
                        </span>
                      ) : (
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Todavía sin stock</span>
                      ))}
                      {enPendientes && grupo.avisos.some(a => a.origen === 'local') && (
                        <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium">
                          Pedido en local ({grupo.avisos.filter(a => a.origen === 'local').length})
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {enPendientes
                        ? `${grupo.avisos.length} ${grupo.avisos.length === 1 ? 'persona esperando' : 'personas esperando'}`
                        : `${grupo.avisos.length} ${grupo.avisos.length === 1 ? 'persona avisada' : 'personas avisadas'}`}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    {enPendientes && tieneEmails && (
                      <a
                        href={linkMailtoGrupo(grupo)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-700 px-3 py-1.5 rounded text-xs font-medium hover:bg-gray-200 transition-colors border border-gray-300"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        Mail a todos
                      </a>
                    )}
                    {enPendientes && (
                      <button
                        type="button"
                        onClick={() => marcarTodosDelGrupo(grupo)}
                        className="inline-flex items-center gap-1.5 bg-[#00a19a] text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-[#008f89] transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Marcar todos avisados
                      </button>
                    )}
                    {esAdmin && (
                      <button
                        type="button"
                        onClick={() => eliminarAvisos(
                          idsGrupo,
                          `los ${idsGrupo.length} ${enPendientes ? 'avisos pendientes' : 'avisos'} de "${titulo}"`
                        )}
                        className="inline-flex items-center gap-1.5 bg-white text-red-600 px-3 py-1.5 rounded text-xs font-medium border border-red-200 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Eliminar todos
                      </button>
                    )}
                  </div>
                </div>

                <div className="divide-y divide-gray-100 border-t border-gray-100">
                  {grupo.avisos.map(aviso => {
                    const contacto = [aviso.nombre, aviso.whatsapp, aviso.email, aviso.nota].filter(Boolean).join(' · ') || 'sin datos'
                    return (
                      <div key={aviso.id} className="py-2">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="text-sm text-gray-600">
                          {aviso.origen === 'local' && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded mr-2">
                              <Store className="w-3 h-3" />
                              Local
                            </span>
                          )}
                          {aviso.nombre && <span className="font-medium text-[#3c3c3b] mr-2">{aviso.nombre}</span>}
                          {aviso.whatsapp && <span>{aviso.whatsapp}</span>}
                          {aviso.whatsapp && aviso.email && <span className="text-gray-300 mx-1.5">·</span>}
                          {aviso.email && <span>{aviso.email}</span>}
                          {!aviso.nombre && !aviso.whatsapp && !aviso.email && (
                            <span className="italic text-gray-400">sin datos de contacto</span>
                          )}
                          <span className="text-gray-400 text-xs ml-2">
                            pidió el {fmtFecha(aviso.creado_en)}
                            {!enPendientes && <> · avisado el {fmtFecha(aviso.avisado_en)}</>}
                          </span>
                          {aviso.origen === 'local' && (aviso.nota || aviso.registrado_por) && (
                            <div className="text-xs text-gray-500 mt-0.5">
                              {aviso.nota && <span className="italic">“{aviso.nota}”</span>}
                              {aviso.nota && aviso.registrado_por && ' · '}
                              {aviso.registrado_por && <>cargado por {aviso.registrado_por}</>}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          {enPendientes && !aviso.whatsapp && !aviso.email && (
                            <span className="text-xs text-amber-700">Avisar en el local</span>
                          )}
                          {enPendientes && aviso.whatsapp && grupo.articulo && (
                            <a
                              href={linkWhatsapp(aviso.whatsapp, grupo.articulo, aviso.nombre)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-[#25D366] hover:underline font-medium"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              WhatsApp
                            </a>
                          )}
                          {enPendientes && (
                            <button
                              type="button"
                              onClick={() => abrirCambio(aviso.id)}
                              disabled={trabajando === aviso.id}
                              className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-[#00a19a] transition-colors disabled:opacity-40"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              Cambiar producto
                            </button>
                          )}
                          {enPendientes ? (
                            <button
                              type="button"
                              onClick={() => marcarAvisado(aviso.id)}
                              disabled={trabajando === aviso.id}
                              className="text-xs text-gray-400 hover:text-[#00a19a] transition-colors disabled:opacity-40"
                            >
                              Marcar avisado
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => volverAPendiente(aviso)}
                              disabled={trabajando === aviso.id}
                              className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-[#00a19a] transition-colors disabled:opacity-40"
                            >
                              <Undo2 className="w-3.5 h-3.5" />
                              Volver a pendiente
                            </button>
                          )}
                          {esAdmin && (
                            <button
                              type="button"
                              onClick={() => eliminarAvisos([aviso.id], `el aviso de ${contacto} para "${titulo}"`)}
                              title="Eliminar definitivamente"
                              className="text-gray-300 hover:text-red-600 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                      {enPendientes && cambiandoId === aviso.id && (
                        <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded">
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <p className="text-xs text-gray-600">
                              Elegí el producto correcto para este pedido (el contacto y la fecha se mantienen).
                            </p>
                            <button
                              type="button"
                              onClick={cerrarCambio}
                              className="text-xs text-gray-400 hover:text-gray-600"
                            >
                              Cancelar
                            </button>
                          </div>
                          <input
                            type="text"
                            autoFocus
                            placeholder="Buscar el producto correcto..."
                            value={busquedaCambio}
                            onChange={e => setBusquedaCambio(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#00a19a]"
                          />
                          {cargandoCatalogo ? (
                            <p className="text-xs text-gray-500 mt-2">Cargando productos...</p>
                          ) : busquedaCambio.trim() && resultadosCambio.length === 0 ? (
                            <p className="text-xs text-gray-500 mt-2">No hay productos activos que coincidan.</p>
                          ) : (
                            <div className="mt-2 divide-y divide-gray-100 bg-white border border-gray-200 rounded">
                              {resultadosCambio.map(a => (
                                <button
                                  key={a.id}
                                  type="button"
                                  onClick={() => cambiarProducto(aviso, a)}
                                  disabled={trabajando === aviso.id || a.id === aviso.articulo_id}
                                  className="w-full text-left px-3 py-2 text-sm text-[#3c3c3b] hover:bg-[#00a19a]/10 disabled:opacity-40 disabled:hover:bg-transparent"
                                >
                                  {a.nombre}
                                  {a.id === aviso.articulo_id && <span className="text-xs text-gray-400 ml-2">(producto actual)</span>}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
