import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimit, getClientIp, rateLimitHeaders } from "@/lib/ratelimit";

// Rate limit: 5 suscripciones por minuto por IP. Suficiente para uso humano
// real (1-2 por sesión) y blokea bots que floodean la hoja Suscriptores.
const SUSCRIBIR_LIMIT = 5;
const SUSCRIBIR_WINDOW_MS = 60 * 1000;

/**
 * POST /api/suscribir → proxy al endpoint Apps Script para suscripciones
 * al newsletter desde el dropdown del UserMenu en el header.
 *
 * Body: { email: string, origen?: string }
 * Response: { ok: true, status: 'nuevo' | 'ya_suscripto' } | { error: string }
 *
 * Auth: rate limit por IP (5/min). Sin token publico — el endpoint solo
 * inserta en hoja Suscriptores (no expone data sensible).
 */
export async function POST(req: NextRequest) {
  // Rate limit por IP antes de cualquier trabajo.
  const ip = getClientIp(req);
  const rl = checkRateLimit(`suscribir:${ip}`, SUSCRIBIR_LIMIT, SUSCRIBIR_WINDOW_MS);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "rate_limit_exceeded", retryAt: rl.resetAt },
      { status: 429, headers: rateLimitHeaders(SUSCRIBIR_LIMIT, rl) },
    );
  }

  let body: { email?: string; origen?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  const email = String(body.email || "").trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "email_invalido" }, { status: 400 });
  }

  const API_BASE = process.env.NEXT_PUBLIC_APP_SCRIPT_URL || "";
  const API_TOKEN = process.env.APP_SCRIPT_API_TOKEN || "";
  if (!API_BASE || !API_TOKEN) {
    return NextResponse.json({ error: "backend_not_configured" }, { status: 500 });
  }

  const url = `${API_BASE}?api=suscribir`;
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: API_TOKEN,
        email,
        origen: body.origen || "header_dropdown",
      }),
      // Apps Script redirects mid-call; necesario para que fetch siga el 302.
      redirect: "follow",
      cache: "no-store",
    });
    const data = await r.json().catch(() => ({ error: "bad_response" }));
    const headers = rateLimitHeaders(SUSCRIBIR_LIMIT, rl);
    if (!r.ok || data.error) {
      return NextResponse.json(
        { error: data.error || "upstream_error" },
        { status: r.status || 502, headers },
      );
    }
    return NextResponse.json(data, { headers });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown" },
      { status: 502 },
    );
  }
}
