import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimit, getClientIp, rateLimitHeaders } from "@/lib/ratelimit";

export const runtime = "nodejs";

// Rate limit: 8 pedidos por minuto por IP (uso humano real + anti-abuso).
const LIMIT = 8;
const WINDOW_MS = 60 * 1000;

type ItemIn = {
  sku?: string;
  nombre?: string;
  cantidad?: number;
  precioUnit?: number;
  variante?: string;
};

type BodyIn = {
  cliente?: { nombre?: string; email?: string; telefono?: string };
  items?: ItemIn[];
  total?: number;
  envioCosto?: number;
  entrega?: "showroom" | "domicilio" | "sucursal";
  entregaDetalle?: string;
  notas?: string;
  idempotencyKey?: string;
};

/**
 * POST /api/pedidos/crear → proxy al endpoint Apps Script que crea un pedido web
 * por transferencia/efectivo (estado "pendiente") y RESERVA el stock. Dispara los
 * emails (instrucciones de pago al cliente + aviso a la tienda). La dueña confirma
 * el pago después desde la app.
 *
 * Body: { cliente:{nombre,email,telefono}, items:[{sku,nombre,cantidad,precioUnit,variante}],
 *         total, envioCosto?, entrega, entregaDetalle?, notas?, idempotencyKey }
 * Response: { ok:true, pedidoId } | { ok:false, error }
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`pedido-web:${ip}`, LIMIT, WINDOW_MS);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limit_exceeded" },
      { status: 429, headers: rateLimitHeaders(LIMIT, rl) },
    );
  }

  let body: BodyIn = {};
  try {
    body = (await req.json()) as BodyIn;
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const nombre = String(body.cliente?.nombre || "").trim();
  const email = String(body.cliente?.email || "").trim().toLowerCase();
  if (!nombre) return NextResponse.json({ ok: false, error: "falta_nombre" }, { status: 400 });
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "email_invalido" }, { status: 400 });
  }

  const items = (Array.isArray(body.items) ? body.items : [])
    .filter(
      (it) =>
        !!it?.sku &&
        !!it?.nombre &&
        typeof it.cantidad === "number" &&
        it.cantidad > 0 &&
        typeof it.precioUnit === "number" &&
        it.precioUnit > 0,
    )
    .map((it) => ({
      sku: String(it.sku),
      nombre: String(it.nombre),
      cantidad: Math.floor(it.cantidad as number),
      precioUnit: Math.round(it.precioUnit as number),
      variante: String(it.variante || ""),
    }));
  if (items.length === 0) {
    return NextResponse.json({ ok: false, error: "carrito_vacio" }, { status: 400 });
  }

  const API_BASE = process.env.NEXT_PUBLIC_APP_SCRIPT_URL || "";
  const API_TOKEN = process.env.APP_SCRIPT_API_TOKEN || "";
  if (!API_BASE || !API_TOKEN) {
    return NextResponse.json({ ok: false, error: "backend_not_configured" }, { status: 500 });
  }

  const url = `${API_BASE}?api=crear_pedido_web`;
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: API_TOKEN,
        cliente: { nombre, email, telefono: String(body.cliente?.telefono || "").trim() },
        items,
        total: Number(body.total) || 0,
        envioCosto: Number(body.envioCosto) || 0,
        entrega: String(body.entrega || "").trim(),
        entregaDetalle: String(body.entregaDetalle || "").trim(),
        notas: String(body.notas || "").trim(),
        idempotencyKey: String(body.idempotencyKey || "").trim(),
      }),
      // Apps Script redirige mid-call (302); necesario para que fetch lo siga.
      redirect: "follow",
      cache: "no-store",
    });
    const data = await r.json().catch(() => ({ ok: false, error: "bad_response" }));
    const headers = rateLimitHeaders(LIMIT, rl);
    if (!r.ok || data.error || !data.ok) {
      return NextResponse.json(
        { ok: false, error: data.error || "upstream_error" },
        { status: r.status || 502, headers },
      );
    }
    return NextResponse.json(data, { headers });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "unknown" },
      { status: 502 },
    );
  }
}
