import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Rutas públicas: no requieren login. /login por supuesto, /tienda (la
// Vitrina web — catálogo público + checkout) porque cualquier visitante
// externo tiene que poder verla sin cuenta en el sistema, y /api/tienda
// (checkout + webhook de Mercado Pago) por la misma razón — son endpoints
// de servidor que nunca tienen una sesión de usuario detrás, y NO
// arrancan con "/tienda" sino con "/api/tienda" (bug real, 08/08/2026:
// startsWith('/tienda') no matcheaba '/api/tienda/checkout', el
// middleware redirigía cualquier llamada al checkout a /login).
const RUTAS_PUBLICAS = ['/login', '/tienda', '/api/tienda']

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // La raíz '/' se trata aparte (comparación exacta, nunca con startsWith
  // — si no, matchearía TODO y anularía el resto del chequeo de sesión).
  // Sin esto, cualquier visitante sin sesión que entra a habitussd.com/
  // quedaba atrapado acá y nunca llegaba a ejecutarse el redirect propio
  // de page.tsx hacia /tienda — terminaba viendo el login del sistema
  // interno en vez de la Vitrina (bug real, reportado por un cliente real
  // el 22/08/2026).
  const esRutaPublica = request.nextUrl.pathname === '/' || RUTAS_PUBLICAS.some(ruta => request.nextUrl.pathname.startsWith(ruta))

  if (!user && !esRutaPublica) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
