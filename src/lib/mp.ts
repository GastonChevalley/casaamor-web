/**
 * mp.ts — Helpers server-side para Mercado Pago.
 *
 * Por ahora sin SDK oficial (`mercadopago` npm). Llamamos REST directo para
 * mantener el bundle chico y evitar problemas de typing con Next 16.
 *
 * Cuando llegen las credenciales:
 *   - MP_ACCESS_TOKEN → bearer para los endpoints de payments / preferences.
 *   - MP_PUBLIC_KEY   → la usa el cliente para inicializar Payment Brick.
 *   - MP_WEBHOOK_SECRET → para validar firma del webhook.
 */

const MP_BASE = "https://api.mercadopago.com";

export type MPPayment = {
  id: number;
  status:
    | "approved"
    | "pending"
    | "in_process"
    | "rejected"
    | "refunded"
    | "cancelled"
    | "in_mediation"
    | "charged_back";
  status_detail?: string;
  payment_type_id?: string;
  payment_method_id?: string;
  installments?: number;
  transaction_amount?: number;
  net_amount?: number;
  fee_details?: Array<{ type?: string; amount?: number }>;
  date_created?: string;
  date_approved?: string | null;
  external_reference?: string;
  payer?: {
    email?: string;
    first_name?: string;
    last_name?: string;
    phone?: { area_code?: string; number?: string };
    identification?: { type?: string; number?: string };
  };
  additional_info?: {
    items?: Array<{
      id?: string;
      title?: string;
      quantity?: number;
      unit_price?: number;
    }>;
    shipments?: {
      receiver_address?: {
        zip_code?: string;
        state_name?: string;
        city_name?: string;
        street_name?: string;
        street_number?: string;
      };
    };
  };
};

/**
 * Consulta el detalle de un pago en MP. Necesario en el webhook porque MP
 * notifica solo el ID, no el payload completo.
 */
export async function obtenerPayment(paymentId: string | number): Promise<MPPayment | null> {
  const token = process.env.MP_ACCESS_TOKEN || "";
  if (!token) return null;

  const url = `${MP_BASE}/v1/payments/${encodeURIComponent(String(paymentId))}`;
  try {
    const r = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });
    if (!r.ok) return null;
    return (await r.json()) as MPPayment;
  } catch {
    return null;
  }
}

export type PreferenceItem = {
  id: string;
  title: string;
  quantity: number;
  unit_price: number;
  currency_id: "ARS";
};

export type PreferenceInput = {
  items: PreferenceItem[];
  payer: {
    name?: string;
    email: string;
    phone?: { area_code?: string; number?: string };
    address?: {
      zip_code?: string;
      street_name?: string;
      street_number?: string;
    };
  };
  externalReference: string;
  backUrls: { success: string; pending: string; failure: string };
  notificationUrl: string;
  /** Cuotas máximas sin interés que el comercio absorbe (3 default). */
  cuotasSinInteres?: number;
};

export type PreferenceResponse = {
  id: string;
  init_point: string;
  sandbox_init_point?: string;
};

/**
 * Crea una preference de pago en MP. La preference es lo que el Payment Brick
 * usa como contexto para el cobro.
 */
export async function crearPreference(input: PreferenceInput): Promise<PreferenceResponse | null> {
  const token = process.env.MP_ACCESS_TOKEN || "";
  if (!token) return null;

  const body = {
    items: input.items,
    payer: input.payer,
    external_reference: input.externalReference,
    back_urls: input.backUrls,
    auto_return: "approved" as const,
    notification_url: input.notificationUrl,
    statement_descriptor: "CASAAMOR",
    payment_methods: {
      installments: input.cuotasSinInteres ?? 3,
      default_installments: 1,
    },
  };

  try {
    const r = await fetch(`${MP_BASE}/checkout/preferences`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!r.ok) return null;
    return (await r.json()) as PreferenceResponse;
  } catch {
    return null;
  }
}

/**
 * Input que envía el Payment Brick en su callback `onSubmit`.
 * Estos campos vienen del SDK MP — son los datos tokenizados de la tarjeta.
 */
export type ProcessPaymentInput = {
  token: string;
  payment_method_id: string;
  issuer_id?: string;
  installments?: number;
  transaction_amount: number;
  payer: {
    email: string;
    identification?: { type?: string; number?: string };
  };
  external_reference: string;
  description?: string;
};

/**
 * Crea un pago en MP usando la Payments API. Se usa para procesar tarjetas
 * de crédito / débito directamente desde el Payment Brick (sin redirección
 * a MP). El Brick tokeniza la tarjeta del lado cliente y nos pasa el token;
 * nosotros lo intercambiamos por un cobro real acá.
 *
 * https://www.mercadopago.com.ar/developers/es/reference/payments/_payments/post
 */
/**
 * Resultado de `procesarPago` — siempre devuelve detalle (sea OK o error)
 * para que el endpoint pueda propagar al frontend.
 */
export type ProcesarPagoResult =
  | { ok: true; payment: MPPayment }
  | { ok: false; status: number; mpError: string; mpBody?: unknown };

export async function procesarPago(input: ProcessPaymentInput): Promise<ProcesarPagoResult> {
  const token = process.env.MP_ACCESS_TOKEN || "";
  if (!token) {
    return { ok: false, status: 503, mpError: "MP_ACCESS_TOKEN no configurado" };
  }

  const body = {
    token: input.token,
    payment_method_id: input.payment_method_id,
    issuer_id: input.issuer_id,
    installments: input.installments || 1,
    transaction_amount: input.transaction_amount,
    payer: input.payer,
    external_reference: input.external_reference,
    description: input.description || "Compra CasaAmor",
    statement_descriptor: "CASAAMOR",
    notification_url: `${process.env.NEXT_PUBLIC_SITE_URL || ""}/api/webhooks/mp`,
    binary_mode: false,
  };

  try {
    // Idempotency-Key obligatorio en POST /v1/payments para evitar cobros
    // duplicados si el usuario refresca o la red falla en el medio del request.
    const idempotencyKey = `${input.external_reference}-${Date.now()}`;
    const r = await fetch(`${MP_BASE}/v1/payments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!r.ok) {
      const errText = await r.text().catch(() => "");
      let parsed: unknown = errText;
      try {
        parsed = JSON.parse(errText);
      } catch {
        /* mantener texto plano */
      }
      console.error("[mp/procesarPago] error API", r.status, errText);
      return { ok: false, status: r.status, mpError: errText.slice(0, 500), mpBody: parsed };
    }
    return { ok: true, payment: (await r.json()) as MPPayment };
  } catch (err) {
    console.error("[mp/procesarPago] excepción", err);
    return {
      ok: false,
      status: 0,
      mpError: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Valida la firma HMAC del webhook de MP.
 *
 * MP envía header `x-signature: ts=<timestamp>,v1=<hash>`.
 * El hash se construye así:
 *   HMAC-SHA256(secret, `id:<dataId>;request-id:<requestId>;ts:<ts>;`)
 *
 * https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks
 */
export async function validarFirmaWebhook(opts: {
  signatureHeader: string;
  requestIdHeader: string;
  dataId: string;
}): Promise<boolean> {
  const secret = process.env.MP_WEBHOOK_SECRET || "";
  if (!secret) return false;

  const partes = opts.signatureHeader.split(",").reduce<Record<string, string>>((acc, p) => {
    const [k, v] = p.split("=");
    if (k && v) acc[k.trim()] = v.trim();
    return acc;
  }, {});
  const ts = partes["ts"];
  const v1 = partes["v1"];
  if (!ts || !v1) return false;

  const manifest = `id:${opts.dataId};request-id:${opts.requestIdHeader};ts:${ts};`;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(manifest));
  const sigHex = Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return sigHex === v1.toLowerCase();
}
