/**
 * POST /api/mp/process-payment
 *
 * Llamado por el Payment Brick (callback `onSubmit`) cuando el usuario
 * confirma el pago con tarjeta de crédito / débito. El Brick nos pasa el
 * `formData` con el `token` de la tarjeta ya tokenizada (no recibimos el
 * número de tarjeta directo — eso lo maneja MP del lado cliente).
 *
 * Nosotros llamamos a `POST /v1/payments` de MP con el token, y devolvemos
 * el `status` al frontend para que decida a qué página redirigir.
 *
 * Estados posibles devueltos por MP:
 *   - approved        → /checkout/exito
 *   - in_process      → /checkout/pendiente (review manual, hasta 48h)
 *   - pending         → /checkout/pendiente (efectivo Rapipago/PF, etc.)
 *   - rejected        → /checkout/error (el Brick lo muestra inline también)
 *   - cancelled       → /checkout/error
 *
 * Para "Mercado Pago" como método (Wallet), MP NO usa este endpoint —
 * redirige al user a su hosted checkout y vuelve por back_urls.
 *
 * El webhook /api/webhooks/mp se sigue disparando en paralelo y registra
 * la venta en Apps Script — este endpoint solo le dice al cliente cómo fue.
 */

import { NextRequest, NextResponse } from "next/server";
import { procesarPago, type ProcessPaymentInput } from "@/lib/mp";
import { checkRateLimit, getClientIp, rateLimitHeaders } from "@/lib/ratelimit";

export const runtime = "nodejs";

// Rate limit conservador — un cliente no debería intentar pagar > 10 veces/min.
const LIMIT = 10;
const WINDOW_MS = 60 * 1000;

type BodyIn = {
  token?: string;
  payment_method_id?: string;
  issuer_id?: string;
  installments?: number;
  transaction_amount?: number;
  payer?: {
    email?: string;
    identification?: { type?: string; number?: string };
  };
  externalReference?: string;
  description?: string;
  /**
   * Items del carrito. Si se omiten, MP no guarda detalle del pago →
   * el webhook recibe pago.additional_info.items vacío → Apps Script no
   * puede matchear SKU contra Productos → fila sin sku + stock NO decrementa.
   * Cada item necesita id=SKU para que el matcheo funcione.
   */
  items?: Array<{
    sku?: string;
    nombre?: string;
    variante?: string;
    cantidad?: number;
    precioUnit?: number;
  }>;
};

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`mp-pay:${ip}`, LIMIT, WINDOW_MS);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limit_exceeded" },
      { status: 429, headers: rateLimitHeaders(LIMIT, rl) },
    );
  }

  if (!process.env.MP_ACCESS_TOKEN) {
    return NextResponse.json(
      {
        ok: false,
        error: "mp_no_configurado",
        message: "El pago online no está configurado todavía.",
      },
      { status: 503 },
    );
  }

  let body: BodyIn = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  // Validación mínima — el Brick siempre manda estos campos cuando es tarjeta.
  if (!body.token || !body.payment_method_id || !body.transaction_amount) {
    return NextResponse.json(
      { ok: false, error: "datos_invalidos", message: "Faltan datos del pago." },
      { status: 400 },
    );
  }
  if (!body.payer?.email) {
    return NextResponse.json(
      { ok: false, error: "email_invalido" },
      { status: 400 },
    );
  }
  if (!body.externalReference) {
    return NextResponse.json(
      { ok: false, error: "ref_invalida" },
      { status: 400 },
    );
  }

  // Mapear items del carrito al formato additional_info.items que espera MP.
  // CRÍTICO para que el webhook pueda matchear SKU contra Productos.
  const items = Array.isArray(body.items)
    ? body.items
        .filter(
          (it): it is { sku: string; nombre: string; cantidad: number; precioUnit: number; variante?: string } =>
            !!it.sku &&
            !!it.nombre &&
            typeof it.cantidad === "number" &&
            it.cantidad > 0 &&
            typeof it.precioUnit === "number" &&
            it.precioUnit > 0,
        )
        .map((it) => ({
          id: it.sku,
          title: it.variante ? `${it.nombre} (${it.variante})` : it.nombre,
          quantity: Math.floor(it.cantidad),
          unit_price: Math.round(it.precioUnit),
        }))
    : undefined;

  const input: ProcessPaymentInput = {
    token: body.token,
    payment_method_id: body.payment_method_id,
    issuer_id: body.issuer_id,
    installments: body.installments,
    transaction_amount: body.transaction_amount,
    payer: {
      email: body.payer.email,
      identification: body.payer.identification,
    },
    external_reference: body.externalReference,
    description: body.description,
    items,
  };

  const resultado = await procesarPago(input);
  if (!resultado.ok) {
    // Extraer mensaje y código causa de MP para que el frontend pueda mostrar
    // detalle útil al cliente (y al dev para debug). MP devuelve típicamente
    // un body { message, error, status, cause: [{code, description}] }.
    let mpMensaje = "MP no aceptó la solicitud de pago.";
    let mpCausa: string | undefined;
    const mpBody = resultado.mpBody as
      | { message?: string; error?: string; cause?: Array<{ code?: number | string; description?: string }> }
      | undefined;
    if (mpBody && typeof mpBody === "object") {
      if (typeof mpBody.message === "string" && mpBody.message) mpMensaje = mpBody.message;
      if (Array.isArray(mpBody.cause) && mpBody.cause.length > 0) {
        const first = mpBody.cause[0];
        if (first?.description) mpCausa = String(first.description);
      }
    }

    return NextResponse.json(
      {
        ok: false,
        error: "mp_payment_failed",
        message: `MP rechazó el pago. ${mpMensaje}${mpCausa ? ` — ${mpCausa}` : ""}`,
        // Detalle técnico para diagnóstico (NO contiene datos sensibles).
        debug: {
          mpHttpStatus: resultado.status,
          mpMessage: mpMensaje,
          mpCausa,
        },
      },
      { status: 502, headers: rateLimitHeaders(LIMIT, rl) },
    );
  }

  const pago = resultado.payment;
  return NextResponse.json(
    {
      ok: true,
      paymentId: String(pago.id),
      status: pago.status,
      statusDetail: pago.status_detail,
    },
    { headers: rateLimitHeaders(LIMIT, rl) },
  );
}
