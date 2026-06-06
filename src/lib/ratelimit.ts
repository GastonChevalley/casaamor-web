/**
 * ratelimit.ts — Rate limiting simple en memoria para endpoints públicos.
 *
 * Mitigación básica del Addendum 88 / Sub-fase B.0 (audit de seguridad):
 *   El `/api/suscribir` y `/api/revalidate` no tenían rate limit alguno → un
 *   atacante podía flooder la hoja Suscriptores o invalidar el cache infinito.
 *
 * Implementación:
 *   - Map en memoria con buckets por identificador (IP).
 *   - Token bucket simple con ventana fija.
 *   - Cleanup automático de buckets expirados (cuando se accede).
 *
 * Limitación conocida:
 *   Vercel serverless mantiene el Map mientras la instancia esté caliente.
 *   En cold start o entre instancias paralelas, el conteo se pierde. Para
 *   tráfico bajo (CasaAmor: <100 visitas/día actual) esto es aceptable como
 *   primera línea de defensa.
 *
 * Migración a Upstash/Vercel KV (cuando aplique):
 *   Si hay abuso real (logs de Vercel muestran spam), reemplazar este módulo
 *   con `@upstash/ratelimit` + Redis. Setup ~10 min, free tier 10k cmds/día.
 *   La API exportada (`checkRateLimit`, `getClientIp`) se mantiene igual.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Cleanup pasivo: cada 1000 accesos a `checkRateLimit`, podamos buckets viejos.
let accessCounter = 0;
const CLEANUP_INTERVAL = 1000;

function cleanupExpired(now: number): void {
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt < now) buckets.delete(key);
  }
}

/**
 * Verifica si el `identifier` está dentro del límite. Devuelve `ok: false`
 * si excedió. Es idempotente — incrementa el contador SOLO si `ok: true`.
 *
 * @param identifier  Clave única (típicamente IP del cliente).
 * @param limit       Máximo de requests permitidos en la ventana.
 * @param windowMs    Tamaño de la ventana en milisegundos.
 */
export function checkRateLimit(
  identifier: string,
  limit: number,
  windowMs: number,
): { ok: boolean; remaining: number; resetAt: number } {
  const now = Date.now();

  accessCounter++;
  if (accessCounter >= CLEANUP_INTERVAL) {
    accessCounter = 0;
    cleanupExpired(now);
  }

  const bucket = buckets.get(identifier);

  // Sin bucket o ventana expirada → arrancar nueva.
  if (!bucket || now > bucket.resetAt) {
    buckets.set(identifier, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  // Excedió el límite.
  if (bucket.count >= limit) {
    return { ok: false, remaining: 0, resetAt: bucket.resetAt };
  }

  // Incrementar y permitir.
  bucket.count += 1;
  return { ok: true, remaining: limit - bucket.count, resetAt: bucket.resetAt };
}

/**
 * Extrae la IP del cliente del request. Vercel inyecta `x-forwarded-for`
 * con la cadena de proxies (cliente → cloudflare → vercel).
 */
export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for") || "";
  const ip = xff.split(",")[0]?.trim() || "";
  return ip || req.headers.get("x-real-ip") || "unknown";
}

/**
 * Helper que construye los headers HTTP estándar de rate limit
 * (RFC draft-ietf-httpapi-ratelimit-headers).
 */
export function rateLimitHeaders(
  limit: number,
  result: { remaining: number; resetAt: number },
): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
  };
}
