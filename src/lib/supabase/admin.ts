// Ruta destino: C:\Users\Usuario\Documents\sistema-habitus-sd\src\lib\supabase\admin.ts
import { createClient } from '@supabase/supabase-js'

// Cliente con Service Role Key — salta RLS por completo.
//
// USAR SOLO en rutas de servidor (API routes) que necesiten actuar sin un
// usuario logueado detrás (ej. webhook de Mercado Pago, checkout público de
// /tienda). NUNCA importar este archivo desde un componente de cliente
// ('use client') ni desde código que corra en el navegador — expondría la
// Service Role Key completa.
//
// Requiere la variable de entorno SUPABASE_SERVICE_ROLE_KEY en Vercel
// (Settings → Environment Variables), sacada del panel de Supabase →
// Settings → API → service_role key. Es distinta de la anon key que ya usa
// el resto del sistema.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error(
      'Faltan variables de entorno para el cliente admin de Supabase (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)'
    )
  }

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
