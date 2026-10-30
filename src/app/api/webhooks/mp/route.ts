/**
 * POST /api/webhooks/mp
 *
 * Webhook de Mercado Pago. MP notifica acá cada cambio de estado de pago
 * (created, updated). El payload de MP solo trae el ID; consultamos el
 * detalle completo vía API de MP, luego derivamos el registro a Apps Script
 * que escribe en la hoja Ventas + decrementa stock.
 *
 * Seguridad:
 *   - Validamos firma HMAC con MP_WEBHOOK_SECRET (header `x-signature`).
 *   - Rate limit conservador para mitigar ataques de replay con firmas falsas.
 *   - Apps Script tiene token + idempotencia por payment_id.
 *
 * Estado actual (B.1.4):
 *   - Esqueleto funcional. Sin credenciales reales, devuelve 503.
 *   - Cuando llegen las credenciales, el flujo cierra automáticamente.
 */

import { NextRequest, NextResponse } from "next/server";
import { enviarPagoAlBackend, obtenerPayment, validarFirmaWebhook } from "@/lib/mp";
import { checkRateLimit, getClientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";

const WEBHOOK_LIMIT = 120; // MP puede reintentar varias veces, ser generoso.
const WEBHOOK_WINDOW_MS = 60 * 1000;

function ok() {
  // MP requiere 2xx para considerar la notificación entregada (sin reintentos).
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`mp-webhook:${ip}`, WEBHOOK_LIMIT, WEBHOOK_WINDOW_MS);
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: "rate_limit_exceeded" }, { status: 429 });
  }

  // Sin credenciales, no podemos validar firma ni consultar MP. Aceptar
  // silenciosamente para que MP no spamee con reintentos durante setup.
  const secret = process.env.MP_WEBHOOK_SECRET || "";
  const accessToken = process.env.MP_ACCESS_TOKEN || "";
  if (!secret || !accessToken) {
    console.warn("[mp/webhook] credenciales no configuradas — ignorando notificación");
    return ok();
  }

  // Parsear body para extraer data.id
  let body: {
    type?: string;
    topic?: string;
    action?: string;
    // Contracargos / reclamos traen el id del pago aparte del id del evento.
    data?: { id?: string | number; payment_id?: string | number; resource?: { payment_id?: string | number } };
  } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }
  const dataId = String(body?.data?.id || "");
  if (!dataId) return ok(); // ignorar pings sin data

  // Validar firma
  const signature = req.headers.get("x-signature") || "";
  const requestId = req.headers.get("x-request-id") || "";
  const firmaOk = await validarFirmaWebhook({
    signatureHeader: signature,
    requestIdHeader: requestId,
    dataId,
  });
  if (!firmaOk) {
    console.warn("[mp/webhook] firma inválida — descartando", { dataId, requestId });
    return NextResponse.json({ ok: false, error: "firma_invalida" }, { status: 401 });
  }

  // Eventos de pago. Los contracargos y los reclamos llegan como tópicos PROPIOS
  // (no "payment"): antes se descartaban y un contracargo nunca llegaba al backend.
  // Se saca el id del pago y se procesa igual: el estado del pago dice
  // charged_back / in_mediation.
  const tipo = String(body.type || body.topic || "");
  let paymentId = dataId;
  if (tipo && tipo !== "payment") {
    const pid = body?.data?.payment_id ?? body?.data?.resource?.payment_id;
    if (/chargeback|claim/i.test(tipo) && pid) paymentId = String(pid);
    else return ok();
  }

  // Consultar detalle del pago con POLLING.
  // CRÍTICO (Bug D): MP a veces envía el webhook `payment.created` ANTES de
  // que el cobro termine de procesarse en su backend. En ese momento el
  // status puede venir `in_process` o `pending`, y como MP NO siempre envía
  // un `payment.updated` posterior (depende de la suscripción), si cortamos
  // acá perdemos la venta para siempre.
  //
  // Fix: polling con backoff (1s, 2s, 5s) hasta que pago.status sea final
  // O hasta agotar reintentos. Después igual derivamos a Apps Script para
  // que loggee y procese según corresponda (idempotente).
  const estadosFinales = new Set(["approved", "rejected", "refunded", "cancelled", "charged_back"]);
  const BACKOFF_MS = [0, 1500, 3000, 5000]; // 4 intentos: inmediato + 3 backoffs
  let pago = null;
  let intento = 0;
  for (const wait of BACKOFF_MS) {
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    intento += 1;
    pago = await obtenerPayment(paymentId);
    if (!pago) {
      console.error("[mp/webhook] no se pudo obtener detalle del pago", { dataId, intento });
      continue;
    }
    if (estadosFinales.has(pago.status)) {
      break; // status final → procesar
    }
    console.warn("[mp/webhook] status no final, reintentando", {
      dataId,
      intento,
      status: pago.status,
    });
  }
  if (!pago) {
    return NextResponse.json({ ok: false, error: "no_payment_detail" }, { status: 502 });
  }
  // Si después de los reintentos sigue no-final → igual derivar a Apps Script
  // para registrar el evento en _LogsMP (auditoría). El Apps Script no inserta
  // fila en Ventas si status !== 'approved', solo loggea.

  // Derivar al backend para registrar la venta. CRÍTICO (Addendum 88): por GET con
  // el pago en la URL (el redirect 302 de Apps Script descarta el body de un POST).
  // Apps Script SIEMPRE responde HTTP 200, así que antes un error de registro (lock
  // ocupado, excepción) salía como éxito: MP daba la notificación por entregada, no
  // reintentaba, y la venta se perdía. Ahora, si el backend no responde ok:true, se
  // le devuelve 500 a MP para que vuelva a avisar (el registro es idempotente).
  const env = await enviarPagoAlBackend(pago);
  if (!env.ok) {
    console.error("[mp/webhook] el backend no registró el pago — MP va a reintentar", {
      paymentId,
      status: pago.status,
      error: env.error,
    });
    return NextResponse.json({ ok: false, error: "registro_fallido" }, { status: 500 });
  }

  return ok();
}

// GET para health check manual (verificar que el endpoint está vivo).
export async function GET() {
  return NextResponse.json({
    ok: true,
    configured: {
      access_token: !!process.env.MP_ACCESS_TOKEN,
      webhook_secret: !!process.env.MP_WEBHOOK_SECRET,
    },
  });
}
