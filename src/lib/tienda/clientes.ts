// Ruta destino: C:\Users\Usuario\Documents\sistema-habitus-sd\src\lib\tienda\clientes.ts
//
// Une los pedidos de la Vitrina web con la tabla `clientes` real — hasta el
// 24/08/2026 esto no existía: los datos de contacto quedaban solo dentro de
// `pedidos_web`, sin nunca crear/vincular un cliente real, y toda venta web
// se atribuía siempre a "Consumidor Final" sin importar quién comprara.

import type { SupabaseClient } from '@supabase/supabase-js'

interface DatosClienteWeb {
  nombre: string
  telefono: string
  email?: string | null
  dni?: string | null
  cuit?: string | null
}

// Compara solo los últimos 8 dígitos — así "2995187180", "549 2995187180"
// y "02995187180" matchean igual, sin importar cómo haya quedado tipeado
// el código de país/área en ese pedido puntual.
function clavePorTelefono(telefono: string): string {
  return telefono.replace(/\D/g, '').slice(-8)
}

// Busca un cliente existente por teléfono, o lo crea si no hay match. Nunca
// pisa datos de un cliente ya cargado — si existe, se reutiliza tal cual.
export async function matchOCrearClienteWeb(admin: SupabaseClient, datos: DatosClienteWeb): Promise<number | null> {
  const claveNueva = clavePorTelefono(datos.telefono)
  if (claveNueva.length < 8) return null // teléfono demasiado corto/inválido, no forzar match ni alta

  const { data: candidatos } = await admin
    .from('clientes')
    .select('id, telefono')
    .not('telefono', 'is', null)

  const existente = (candidatos || []).find(c => clavePorTelefono(c.telefono || '') === claveNueva)
  if (existente) return existente.id

  const { data: nuevo, error } = await admin
    .from('clientes')
    .insert({
      nombre: datos.nombre,
      tipo_cliente_id: 1, // Consumidor Final
      condicion_iva_id: 4, // Consumidor Final
      telefono: datos.telefono,
      email: datos.email || null,
      dni: datos.dni || null,
      cuit: datos.cuit || null,
      tiene_cuenta_corriente: false,
      activo: true,
      notas: 'Cliente de la vitrina propia (creado automático desde un pedido web) — ' + new Date().toISOString().slice(0, 10),
    })
    .select('id')
    .single()

  if (error) {
    console.error('Error al crear cliente desde pedido web:', error.message)
    return null // nunca frena el checkout/webhook por esto — la venta sigue igual
  }

  return nuevo.id
}
