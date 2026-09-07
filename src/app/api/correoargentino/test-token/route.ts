// src/app/api/correoargentino/test-token/route.ts
//
// Endpoint TEMPORAL solo para validar que las credenciales MiCorreo
// funcionan correctamente. Borrar una vez confirmado (no debe quedar
// expuesto en producción — no requiere auth de usuario del sistema).

import { NextResponse } from "next/server";
import { obtenerToken, cotizarEnvio } from "@/lib/correoargentino/micorreo";

export async function GET() {
  try {
    const { token, expires } = await obtenerToken();

    // Prueba también /rates con un ejemplo real: Cinco Saltos (8303) a
    // Buenos Aires (1425), paquete chico. Si esto falla pero el token se
    // obtuvo bien, el problema está en el customerId o en los parámetros
    // de cotización, no en las credenciales.
    let cotizacion = null;
    let errorCotizacion: string | null = null;

    try {
      cotizacion = await cotizarEnvio({
        postalCodeOrigin: "8303",
        postalCodeDestination: "1425",
        dimensions: {
          weight: 1000,
          height: 10,
          width: 20,
          length: 20,
        },
      });
    } catch (err) {
      errorCotizacion = err instanceof Error ? err.message : String(err);
    }

    return NextResponse.json({
      ok: true,
      token_obtenido: true,
      token_preview: `${token.slice(0, 20)}...`,
      expires,
      cotizacion,
      errorCotizacion,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
