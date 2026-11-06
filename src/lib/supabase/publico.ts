// Ruta destino: C:\Users\Usuario\Documents\sistema-habitus-sd\src\lib\supabase\publico.ts
import { createClient } from '@supabase/supabase-js'

// Cliente de Supabase SIN cookies, para leer datos públicos de la Vitrina
// (la vista articulos_catalogo_web). A diferencia de lib/supabase/server.ts,
// no llama a cookies(): por eso las páginas que lo usan pueden quedar en
// caché de Vercel (ISR) en vez de calcularse en cada visita.
//
// Usa la anon key (la misma que ya usa el resto del sistema), así que solo
// ve lo que el rol anon puede ver. NUNCA usar acá la Service Role Key.
export function createPublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    }
  )
}
