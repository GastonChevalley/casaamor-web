/**
 * Cliente server-side de la API Mi Correo Negocios (MiCorreo v1 — Correo Argentino).
 *
 * ⚠️ SOLO SERVER-SIDE. Usa credenciales secretas (MCN_API_USER / MCN_API_PASSWORD /
 * MCN_CUSTOMER_ID). NUNCA importar desde un componente cliente ni exponer estas
 * env vars con prefijo NEXT_PUBLIC_.
 *
 * Flujo de la API (verificado contra apiMiCorreo.pdf v2025-01-14 + prueba en vivo):
 *   1) POST /token   — Basic Auth base64(userToken:passwordToken) → { token, expire }
 *                      El token es un JWT Bearer que vive ~2,5 h. Se cachea en memoria.
 *   2) POST /rates   — Bearer + { customerId, postalCodeOrigin, postalCodeDestination,
 *                      deliveredType?, dimensions:{ weight(g), height, width, length(cm) } }
 *                      Omitiendo deliveredType devuelve AMBAS (D=domicilio y S=sucursal).
 *
 * Gotchas ya contemplados:
 *   - El campo es `deliveredType` (con "ed") en /rates.
 *   - `customerId` es string con ceros a la izquierda: nunca parsearlo a número.
 *   - Pesos y dimensiones son ENTEROS. Peso en gramos (1–25000), dims en cm (máx 150).
 *   - Errores de negocio pueden venir con HTTP 400/402 y { code, message }.
 */

const BASE = (process.env.MCN_API_BASE || "https://api.correoargentino.com.ar/micorreo/v1").replace(
  /\/+$/,
  "",
);
const USER = (process.env.MCN_API_USER || "").trim();
const PASSWORD = (process.env.MCN_API_PASSWORD || "").trim();
const CUSTOMER_ID = (process.env.MCN_CUSTOMER_ID || "").trim();

/** true si están las 3 credenciales necesarias para cotizar con la API real. */
export function correoConfigurado(): boolean {
  return Boolean(USER && PASSWORD && CUSTOMER_ID);
}

export type RateCorreo = {
  deliveredType: "D" | "S";
  productType: string;
  productName: string;
  price: number;
  deliveryTimeMin: number;
  deliveryTimeMax: number;
};

// ─── Cache del token JWT en memoria del módulo ───────────────────────────────
// Persiste entre requests en el mismo runtime (warm lambda de Vercel). En cold
// start se pide uno nuevo. Renovamos con 60 s de colchón antes del expire.
let tokenCache: { token: string; expMs: number } | null = null;
let tokenInFlight: Promise<string> | null = null;

async function fetchToken(): Promise<string> {
  const basic = Buffer.from(`${USER}:${PASSWORD}`).toString("base64");
  const r = await fetch(`${BASE}/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, Accept: "application/json" },
    // POST sin body, según la doc oficial.
  });
  if (!r.ok) throw new Error(`token_http_${r.status}`);
  const data = (await r.json().catch(() => ({}))) as { token?: string; expire?: string; expires?: string };
  const token = String(data?.token || "");
  if (!token) throw new Error("token_vacio");

  // `expire` viene como "YYYY-MM-DD HH:mm:ss" (hora local AR, -03:00). Parsear
  // defensivo; si falla, asumir 2 h de vida (conservador vs los ~2,5 h reales).
  let expMs = Date.now() + 2 * 60 * 60 * 1000;
  const expStr = String(data?.expire || data?.expires || "").trim();
  if (expStr) {
    const parsed = Date.parse(expStr.replace(" ", "T") + "-03:00");
    if (!Number.isNaN(parsed)) expMs = parsed;
  }
  tokenCache = { token, expMs };
  return token;
}

async function obtenerToken(): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expMs > now + 60_000) return tokenCache.token;
  // Coalescer llamadas concurrentes: si ya hay un /token en vuelo, reusarlo.
  if (!tokenInFlight) {
    tokenInFlight = fetchToken().finally(() => {
      tokenInFlight = null;
    });
  }
  return tokenInFlight;
}

/**
 * Cotiza un envío. Devuelve las tarifas de Correo Argentino (domicilio y/o
 * sucursal) para el paquete dado. Lanza Error si la API falla o rechaza — el
 * caller decide el fallback.
 */
export async function cotizarCorreo(args: {
  cpOrigen: string;
  cpDestino: string;
  pesoGramos: number;
  altoCm: number;
  anchoCm: number;
  profundidadCm: number;
}): Promise<RateCorreo[]> {
  if (!correoConfigurado()) throw new Error("correo_no_configurado");
  const token = await obtenerToken();

  const body = {
    customerId: CUSTOMER_ID,
    postalCodeOrigin: String(args.cpOrigen),
    postalCodeDestination: String(args.cpDestino),
    // deliveredType omitido a propósito → la API devuelve D y S en una llamada.
    dimensions: {
      weight: Math.max(1, Math.min(25000, Math.round(args.pesoGramos))),
      height: Math.max(1, Math.min(150, Math.round(args.altoCm))),
      width: Math.max(1, Math.min(150, Math.round(args.anchoCm))),
      length: Math.max(1, Math.min(150, Math.round(args.profundidadCm))),
    },
  };

  const r = await fetch(`${BASE}/rates`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = (await r.json().catch(() => ({}))) as {
    rates?: Array<Record<string, unknown>>;
    code?: number | string;
    message?: string;
  };

  if (!r.ok) {
    const msg = String(data?.message || `rates_http_${r.status}`).trim();
    throw new Error(msg || `rates_http_${r.status}`);
  }

  const rates = Array.isArray(data?.rates) ? data.rates : [];
  return rates.map((rt) => ({
    deliveredType: rt.deliveredType === "S" ? ("S" as const) : ("D" as const),
    productType: String(rt.productType || ""),
    productName: String(rt.productName || "Correo Argentino"),
    price: Number(rt.price) || 0,
    deliveryTimeMin: parseInt(String(rt.deliveryTimeMin ?? ""), 10) || 0,
    deliveryTimeMax: parseInt(String(rt.deliveryTimeMax ?? ""), 10) || 0,
  }));
}
