/**
 * POST /api/revalidate
 *
 * Endpoint invocado por Apps Script cuando la dueña edita ConfigWeb, Menu o
 * Pages en la planilla. Invalida el Full Route Cache + Data Cache de Next.js
 * para que el próximo visitante vea los cambios al instante (sin esperar TTL).
 *
 * Body opcional:
 *   { paths?: string[] }   lista de paths a invalidar. Default: ["/"] con layout.
 *
 * Auth (Addendum 88 / Sub-fase B.0.3):
 *   - PRIMARIO: header `x-revalidate-secret` debe matchear env `REVALIDATE_SECRET`.
 *   - FALLBACK: query string `?secret=` aceptado durante 1 deploy para no romper
 *     Apps Script viejos en el medio del cambio. Quitar este fallback en B.4.
 *
 * Rate limit: 60 reqs/min por IP. Cubre los edits típicos (1-2 por minuto en
 * uso real) y blokea DoS de cache invalidation.
 *
 * Responde JSON `{ ok: true, revalidated: [...] }` o `{ ok: false, error }`.
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { checkRateLimit, getClientIp, rateLimitHeaders } from "@/lib/ratelimit";

export const runtime = "nodejs";

const SECRET = process.env.REVALIDATE_SECRET || "";
const REVALIDATE_LIMIT = 60;
const REVALIDATE_WINDOW_MS = 60 * 1000;

function checkSecret(req: NextRequest): boolean {
  if (!SECRET) return false;
  // Primario: header (más seguro, no se logea en proxies/HAR)
  const headerSecret = req.headers.get("x-revalidate-secret") || "";
  if (headerSecret === SECRET) return true;
  // Fallback temporal: query string (compatibilidad con Apps Script v52 y previas).
  // Quitar este fallback en B.4 una vez que clasp deploy actualice el script.
  const url = new URL(req.url);
  const querySecret = url.searchParams.get("secret") || "";
  return querySecret === SECRET;
}

export async function POST(req: NextRequest) {
  // Rate limit ANTES de cualquier trabajo (incluyendo lectura del body).
  const ip = getClientIp(req);
  const rl = checkRateLimit(`revalidate:${ip}`, REVALIDATE_LIMIT, REVALIDATE_WINDOW_MS);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limit_exceeded", retryAt: rl.resetAt },
      { status: 429, headers: rateLimitHeaders(REVALIDATE_LIMIT, rl) },
    );
  }

  // Auth
  if (!checkSecret(req)) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401, headers: rateLimitHeaders(REVALIDATE_LIMIT, rl) },
    );
  }

  // Parsear paths a invalidar
  let paths: string[] = ["/"];
  try {
    const body = await req.json().catch(() => ({}));
    if (Array.isArray(body?.paths) && body.paths.length > 0) {
      paths = body.paths.filter((p: unknown) => typeof p === "string" && p.startsWith("/"));
    }
  } catch {
    // body vacío o malformado → usar default
  }

  // Invalidar
  const revalidated: string[] = [];
  for (const p of paths) {
    try {
      // 'layout' invalida tambien todos los hijos (header/footer leen ConfigWeb desde layout)
      revalidatePath(p, "layout");
      revalidated.push(p);
    } catch (err) {
      // Continuar con el resto si uno falla
      console.error("revalidatePath fallo para", p, err);
    }
  }

  return NextResponse.json(
    {
      ok: true,
      revalidated,
      timestamp: Date.now(),
    },
    { headers: rateLimitHeaders(REVALIDATE_LIMIT, rl) },
  );
}

// GET para health check (opcional, útil para testing manual)
export async function GET(req: NextRequest) {
  if (!checkSecret(req)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  return NextResponse.json({
    ok: true,
    hint: "POST con header 'x-revalidate-secret' y body {paths: [...]}",
  });
}
