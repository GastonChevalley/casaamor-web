/**
 * POST /api/mp/create-preference
 *
 * Llamado por CheckoutClient cuando el cliente confirma la compra. Recibe los
 * datos del cliente + items del carrito + opción de envío y crea una
 * preference en Mercado Pago.
 *
 * Cuando llegen las credenciales MP (B.1.8), este endpoint cierra el flujo.
 * Hasta entonces devuelve 503 con explicación amistosa.
 */

import { NextRequest, NextResponse } from "next/server";
import { crearPreference, type PreferenceItem } from "@/lib/mp";
import { SITE_URL } from "@/lib/site";
import { checkRateLimit, getClientIp, rateLimitHeaders } from "@/lib/ratelimit";

export const runtime = "nodejs";

const LIMIT = 10;
const WINDOW_MS = 60 * 1000;

type BodyIn = {
  items?: Array<{
    sku?: string;
    nombre?: string;
    cantidad?: number;
    precioUnit?: number;
    variante?: string;
  }>;
  cliente?: {
    nombre?: string;
    email?: string;
    telefono?: string;
    direccion?: string;
    ciudad?: string;
    codigoPostal?: string;
    notas?: string;
  };
  envio?: "showroom" | "domicilio" | "sucursal";
};

export async function POST(req: NextRequest) {
  // Rate limit por IP para evitar spam de preferences.
  const ip = getClientIp(req);
  const rl = checkRateLimit(`mp-pref:${ip}`, LIMIT, WINDOW_MS);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limit_exceeded" },
      { status: 429, headers: rateLimitHeaders(LIMIT, rl) },
    );
  }

  // Si las credenciales no están seteadas, fallback amistoso.
  if (!process.env.MP_ACCESS_TOKEN) {
    return NextResponse.json(
      {
        ok: false,
        error: "mp_no_configurado",
        message:
          "El pago online está en activación. Por favor coordiná la compra por WhatsApp por ahora.",
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

  // Validación mínima del body
  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) {
    return NextResponse.json({ ok: false, error: "carrito_vacio" }, { status: 400 });
  }
  if (!body.cliente?.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.cliente.email)) {
    return NextResponse.json({ ok: false, error: "email_invalido" }, { status: 400 });
  }

  // Mapear items del carrito a items MP
  const mpItems: PreferenceItem[] = items
    .filter(
      (it): it is Required<NonNullable<BodyIn["items"]>[number]> =>
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
      currency_id: "ARS",
    }));

  if (mpItems.length === 0) {
    return NextResponse.json({ ok: false, error: "items_invalidos" }, { status: 400 });
  }

  // External reference único para idempotencia + tracking.
  const externalReference = `cas-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  const preference = await crearPreference({
    items: mpItems,
    payer: {
      name: body.cliente.nombre,
      email: body.cliente.email,
      ...(body.cliente.telefono && {
        phone: { number: body.cliente.telefono.replace(/[^0-9]/g, "") },
      }),
      ...(body.envio !== "showroom" && {
        address: {
          zip_code: body.cliente.codigoPostal,
          street_name: body.cliente.direccion,
        },
      }),
    },
    externalReference,
    backUrls: {
      success: `${SITE_URL}/checkout/exito?ref=${externalReference}`,
      pending: `${SITE_URL}/checkout/pendiente?ref=${externalReference}`,
      failure: `${SITE_URL}/checkout/error?ref=${externalReference}`,
    },
    notificationUrl: `${SITE_URL}/api/webhooks/mp`,
    cuotasSinInteres: 3,
  });

  if (!preference) {
    return NextResponse.json(
      { ok: false, error: "mp_create_failed" },
      { status: 502, headers: rateLimitHeaders(LIMIT, rl) },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      preferenceId: preference.id,
      initPoint: preference.init_point,
      externalReference,
    },
    { headers: rateLimitHeaders(LIMIT, rl) },
  );
}
