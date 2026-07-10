import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimit, getClientIp, rateLimitHeaders } from "@/lib/ratelimit";

// Rate limit: 5 solicitudes por minuto por IP. Uso humano real + anti-bot.
const LIMIT = 5;
const WINDOW_MS = 60 * 1000;

/**
 * POST /api/arrepentimiento → proxy al endpoint Apps Script del Botón de
 * Arrepentimiento (Resolución 424/2020, obligatorio). Registra la solicitud,
 * genera un código de trámite y dispara los emails (al cliente con el código +
 * a la tienda para procesar). NO reembolsa — eso lo hace la dueña a mano en MP.
 *
 * Body: { nombre, email, dni?, orden, motivo? }
 * Response: { ok: true, codigo } | { error }
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`arrepentimiento:${ip}`, LIMIT, WINDOW_MS);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "rate_limit_exceeded", retryAt: rl.resetAt },
      { status: 429, headers: rateLimitHeaders(LIMIT, rl) },
    );
  }

  let body: { nombre?: string; email?: string; dni?: string; orden?: string; motivo?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  const nombre = String(body.nombre || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const orden = String(body.orden || "").trim();
  if (!nombre) return NextResponse.json({ error: "falta_nombre" }, { status: 400 });
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "email_invalido" }, { status: 400 });
  }
  if (!orden) return NextResponse.json({ error: "falta_orden" }, { status: 400 });

  const API_BASE = process.env.NEXT_PUBLIC_APP_SCRIPT_URL || "";
  const API_TOKEN = process.env.APP_SCRIPT_API_TOKEN || "";
  if (!API_BASE || !API_TOKEN) {
    return NextResponse.json({ error: "backend_not_configured" }, { status: 500 });
  }

  const url = `${API_BASE}?api=arrepentimiento`;
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: API_TOKEN,
        nombre,
        email,
        dni: String(body.dni || "").trim(),
        orden,
        motivo: String(body.motivo || "").trim(),
      }),
      // Apps Script redirige mid-call; necesario para que fetch siga el 302.
      redirect: "follow",
      cache: "no-store",
    });
    const data = await r.json().catch(() => ({ error: "bad_response" }));
    const headers = rateLimitHeaders(LIMIT, rl);
    if (!r.ok || data.error || !data.ok) {
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
