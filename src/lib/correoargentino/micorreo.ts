// src/lib/correoargentino/micorreo.ts
//
// Cliente de conexión con la API MiCorreo de Correo Argentino.
// Credenciales SIEMPRE en variables de entorno de Vercel, nunca hardcodeadas.
//
// Variables de entorno requeridas:
// - MICORREO_API_USER
// - MICORREO_API_PASSWORD
// - MICORREO_CUSTOMER_ID
//
// Nota: por ahora se asume ambiente Productivo mientras se confirma con
// Correo Argentino si estas credenciales aplican también a QA.

const BASE_URL = "https://api.correoargentino.com.ar/micorreo/v1";

interface TokenResponse {
  token: string;
  expires: string;
}

interface RateRequest {
  postalCodeOrigin: string;
  postalCodeDestination: string;
  deliveredType?: "D" | "S";
  dimensions: {
    weight: number; // gramos, 1 a 25000
    height: number; // cm, máx 150
    width: number; // cm, máx 150
    length: number; // cm, máx 150
  };
}

interface Rate {
  deliveredType: "D" | "S";
  productType: string;
  productName: string;
  price: number;
}

interface RateResponse {
  customerId: string;
  validTo: string;
  rates: Rate[];
}

/**
 * Tabla de referencia oficial MiCorreo — código de provincia requerido en
 * `address.provinceCode` para /shipping/import. Se exporta acá (no en el
 * componente de checkout) porque el webhook la va a necesitar de nuevo
 * cuando se dé de alta el envío real, después del pago aprobado.
 */
export const PROVINCIAS_MICORREO = [
  { codigo: "A", nombre: "Salta" },
  { codigo: "B", nombre: "Buenos Aires" },
  { codigo: "C", nombre: "Ciudad Autónoma de Buenos Aires" },
  { codigo: "D", nombre: "San Luis" },
  { codigo: "E", nombre: "Entre Ríos" },
  { codigo: "F", nombre: "La Rioja" },
  { codigo: "G", nombre: "Santiago del Estero" },
  { codigo: "H", nombre: "Chaco" },
  { codigo: "J", nombre: "San Juan" },
  { codigo: "K", nombre: "Catamarca" },
  { codigo: "L", nombre: "La Pampa" },
  { codigo: "M", nombre: "Mendoza" },
  { codigo: "N", nombre: "Misiones" },
  { codigo: "P", nombre: "Formosa" },
  { codigo: "Q", nombre: "Neuquén" },
  { codigo: "R", nombre: "Río Negro" },
  { codigo: "S", nombre: "Santa Fe" },
  { codigo: "T", nombre: "Tucumán" },
  { codigo: "U", nombre: "Chubut" },
  { codigo: "V", nombre: "Tierra del Fuego" },
  { codigo: "W", nombre: "Corrientes" },
  { codigo: "X", nombre: "Córdoba" },
  { codigo: "Y", nombre: "Jujuy" },
  { codigo: "Z", nombre: "Santa Cruz" },
] as const;

/**
 * Obtiene un token JWT de la API MiCorreo mediante HTTP Basic Auth.
 * El token es de corta duración (ver campo `expires`) — no se cachea acá,
 * se debe pedir uno nuevo antes de cada operación o llevar cache propio
 * con control de vencimiento en quien lo consuma.
 */
export async function obtenerToken(): Promise<TokenResponse> {
  const user = process.env.MICORREO_API_USER;
  const password = process.env.MICORREO_API_PASSWORD;

  if (!user || !password) {
    throw new Error(
      "Faltan MICORREO_API_USER / MICORREO_API_PASSWORD en las variables de entorno"
    );
  }

  const credenciales = Buffer.from(`${user}:${password}`).toString("base64");

  const respuesta = await fetch(`${BASE_URL}/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credenciales}`,
    },
  });

  const data = await respuesta.json();

  if (!respuesta.ok) {
    throw new Error(
      `Error al obtener token MiCorreo (${respuesta.status}): ${JSON.stringify(data)}`
    );
  }

  return data as TokenResponse;
}

/**
 * Cotiza un envío por peso/dimensiones entre dos códigos postales.
 * Si se omite `deliveredType`, la API devuelve ambas cotizaciones
 * (domicilio y sucursal) en el mismo response.
 */
export async function cotizarEnvio(params: RateRequest): Promise<RateResponse> {
  const customerId = process.env.MICORREO_CUSTOMER_ID;

  if (!customerId) {
    throw new Error("Falta MICORREO_CUSTOMER_ID en las variables de entorno");
  }

  const { token } = await obtenerToken();

  const respuesta = await fetch(`${BASE_URL}/rates`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      customerId,
      ...params,
    }),
  });

  const data = await respuesta.json();

  if (!respuesta.ok) {
    throw new Error(
      `Error al cotizar envío MiCorreo (${respuesta.status}): ${JSON.stringify(data)}`
    );
  }

  return data as RateResponse;
}
