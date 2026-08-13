// Ruta destino: C:\Users\Usuario\Documents\sistema-habitus-sd\src\app\api\tienda\configuracion-envios\route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Service role — igual criterio que api/tienda/checkout/route.ts: la Vitrina
// es pública (sin sesión), así que las lecturas server-side usan la key de
// servicio en vez de depender de RLS para el rol anónimo.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  // TEMPORAL — diagnóstico: qué rol trae la key configurada, sin exponer la key en sí.
  let rolDetectado = 'no se pudo decodificar'
  try {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64').toString())
    rolDetectado = payload.role || 'sin campo role'
  } catch {
    rolDetectado = 'SUPABASE_SERVICE_ROLE_KEY no está definida o no es un JWT válido'
  }

  const { data, error } = await supabase
    .from('configuracion_envios')
    .select(
      'tarifa_cinco_saltos, envio_cinco_saltos_activo, aclaraciones_texto, aclaraciones_activo, correo_argentino_activo'
    )
    .eq('id', 1)
    .single()

  if (error || !data) {
    console.error('Error configuracion_envios:', error)
    return NextResponse.json(
      { error: 'No se pudo obtener la configuración de envíos', debug: error?.message || 'sin data', rolDetectado },
      { status: 500 }
    )
  }

  return NextResponse.json({
    tarifaCincoSaltos: data.tarifa_cinco_saltos,
    cincoSaltosActivo: data.envio_cinco_saltos_activo,
    aclaracionesTexto: data.aclaraciones_texto,
    aclaracionesActivo: data.aclaraciones_activo,
    // Todavía deshabilitado hasta tener credenciales de API — se expone para
    // que el frontend pueda mostrar la opción como "Próximamente" si hace falta.
    correoArgentinoActivo: data.correo_argentino_activo,
  })
}
