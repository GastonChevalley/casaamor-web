/**
 * POST /api/mp/confirmar  { paymentId }
 *
 * Lo llaman las páginas de resultado (/checkout/exito y /checkout/pendiente) al
 * volver de Mercado Pago. Pide el pago a MP (fuente de verdad: no se confía en lo
 * que mande el navegador) y, si es de un pedido web, se lo manda al backend.
 *
 * Es la redundancia del aviso de MP para la BILLETERA (que no pasa por
 * process-payment): si el webhook falla, la venta entra igual. El registro es
 * idempotente, así que llamarlo de más no duplica nada.
 */

import { NextRequest, NextResponse } from "next/server";
import { enviarPagoAlBackend, obtenerPayment } from "@/lib/mp";
import { checkRateLimit, getClientIp, rateLimitHeaders } from "@/lib/ratelimit";

export const runtime = "nodejs";

const LIMIT = 10;
const WINDOW_MS = 60 * 1000;

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`mp-confirmar:${ip}`, LIMIT, WINDOW_MS);
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: "rate_limit_exceeded" }, { status: 429, headers: rateLimitHeaders(LIMIT, rl) });
  }
  let body: { paymentId?: string | number } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }
  const paymentId = String(body.paymentId || "").replace(/\D/g, "");
  if (!paymentId) return NextResponse.json({ ok: false, error: "falta_payment_id" }, { status: 400 });

  const pago = await obtenerPayment(paymentId);
  if (!pago) return NextResponse.json({ ok: false, error: "pago_no_encontrado" }, { status: 404 });
  if (!String(pago.external_reference || "").startsWith("pw:")) {
    return NextResponse.json({ ok: true, ignorado: true }, { headers: rateLimitHeaders(LIMIT, rl) });
  }
  const env = await enviarPagoAlBackend(pago);
  return NextResponse.json(
    { ok: env.ok, status: pago.status, pedidoId: String(pago.external_reference).slice(3) },
    { headers: rateLimitHeaders(LIMIT, rl) },
  );
}
