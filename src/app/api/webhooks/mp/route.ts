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
import { obtenerPayment, validarFirmaWebhook } from "@/lib/mp";
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
  let body: { type?: string; action?: string; data?: { id?: string | number } } = {};
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

  // Solo procesamos eventos de payment (ignoramos refunds, claims, etc por ahora)
  const tipo = body.type || "";
  if (tipo && tipo !== "payment") {
    return ok();
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
    pago = await obtenerPayment(dataId);
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

  // Derivar a Apps Script para registrar la venta
  const appsScriptUrl = process.env.NEXT_PUBLIC_APP_SCRIPT_URL || "";
  const apiToken = process.env.APP_SCRIPT_API_TOKEN || "";
  if (!appsScriptUrl || !apiToken) {
    console.error("[mp/webhook] falta APPS_SCRIPT_URL o APP_SCRIPT_API_TOKEN");
    return NextResponse.json({ ok: false, error: "backend_no_configurado" }, { status: 500 });
  }

  try {
    const r = await fetch(`${appsScriptUrl}?api=mp_webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: apiToken,
        payment: pago,
      }),
      redirect: "follow",
      cache: "no-store",
    });
    if (!r.ok) {
      console.error("[mp/webhook] Apps Script respondió", r.status);
      return NextResponse.json({ ok: false, error: "apps_script_error" }, { status: 502 });
    }
  } catch (err) {
    console.error("[mp/webhook] Apps Script fetch falló", err);
    return NextResponse.json({ ok: false, error: "apps_script_unreachable" }, { status: 502 });
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
