import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimit, getClientIp, rateLimitHeaders } from "@/lib/ratelimit";
import { ENVIO_CORREO_HABILITADO } from "@/lib/envio-config";
import { cotizarEnvio, normalizarMedidas } from "@/lib/envio-cotizar";

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
  /** Peso/medidas con los que se cotizo el envio (web/src/lib/cart.ts). */
  paquete?: {
    pesoGramos?: number;
    altoCm?: number;
    anchoCm?: number;
    profundidadCm?: number;
    cantidadItems?: number;
    sinDatos?: number;
  };
  entrega?: "showroom" | "domicilio" | "sucursal";
  entregaDetalle?: string;
  notas?: string;
  idempotencyKey?: string;
  /** 'mp' = el pedido se paga con Mercado Pago (lo confirma el aviso de MP). */
  metodoPago?: "transferencia" | "mp";
  /** Pedido de MP anterior del mismo cliente, a liberar antes de reservar de nuevo. */
  reemplazaPedidoId?: string;
  /** Clave idempotente de ese pedido: la prueba de que es el mismo cliente. */
  reemplazaClave?: string;
  /** CP de destino, para re-cotizar el envío en el servidor. */
  envioCp?: string;
  /** El cotizador de Correo está apagado: el envío es "a convenir" (costo 0). */
  envioAConvenir?: boolean;
  /** La cotización salió del estimador local (la API de Correo falló). */
  envioEstimado?: boolean;
};

/**
 * POST /api/pedidos/crear → proxy al endpoint Apps Script que crea un pedido web
 * (estado "pendiente") y RESERVA el stock. Sirve para los dos medios de pago:
 *  - transferencia/efectivo: manda los mails de instrucciones; la dueña confirma
 *    el pago desde la app.
 *  - mp: se crea ANTES de abrir el pago de Mercado Pago (guarda envío, dirección y
 *    medidas); lo confirma el aviso de MP. El backend valida precio y envío.
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

  // ── Envío: lo calcula el SERVIDOR ───────────────────────────────────────────
  // El costo lo mandaba el navegador: con un request armado a mano se pagaba $1 de
  // envío y la tienda le pagaba el resto a Correo. Se re-cotiza acá con el mismo
  // paquete y CP; si la tarifa oficial da más que lo que mandó el cliente, se
  // rechaza con el precio vigente para que lo vea y confirme. "A convenir" lo decide
  // el servidor, no el navegador.
  const entrega = String(body.entrega || "").trim();
  const envioCosto = Math.max(0, Math.round(Number(body.envioCosto) || 0));
  const conEnvio = entrega === "domicilio" || entrega === "sucursal";
  if (ENVIO_CORREO_HABILITADO && conEnvio) {
    const cp = String(body.envioCp || "").replace(/\D/g, "");
    const pq = body.paquete;
    if (!/^\d{4,5}$/.test(cp) || !pq || !(Number(pq.pesoGramos) > 0)) {
      return NextResponse.json({ ok: false, error: "falta_envio" }, { status: 400 });
    }
    const q = await cotizarEnvio({
      cpDestino: cp,
      pesoGramos: Math.max(100, Math.round(Number(pq.pesoGramos))),
      ...normalizarMedidas(pq),
    });
    const op = q.opciones.find((o) => o.tipo === entrega);
    // Solo con tarifa OFICIAL: si la API de Correo no respondió, no se puede
    // comparar contra un estimado (sería rechazar ventas por un problema nuestro).
    if (!q.esEstimado && op && envioCosto + 1 < op.precio) {
      return NextResponse.json(
        { ok: false, error: "envio_cambio", envioCosto: op.precio },
        { status: 409, headers: rateLimitHeaders(LIMIT, rl) },
      );
    }
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
        envioCosto,
        // Peso/medidas con los que se cotizo el envio: el backend los guarda con
        // el pedido para que la duenia cargue lo mismo en MiCorreo.
        paquete: body.paquete && Number(body.paquete.pesoGramos) > 0
          ? {
              pesoGramos: Number(body.paquete.pesoGramos) || 0,
              altoCm: Number(body.paquete.altoCm) || 0,
              anchoCm: Number(body.paquete.anchoCm) || 0,
              profundidadCm: Number(body.paquete.profundidadCm) || 0,
              cantidadItems: Number(body.paquete.cantidadItems) || 0,
              sinDatos: Number(body.paquete.sinDatos) || 0,
            }
          : null,
        entrega,
        entregaDetalle: String(body.entregaDetalle || "").trim(),
        notas: String(body.notas || "").trim(),
        idempotencyKey: String(body.idempotencyKey || "").trim(),
        metodoPago: body.metodoPago === "mp" ? "mp" : "transferencia",
        reemplazaPedidoId: String(body.reemplazaPedidoId || "").trim().slice(0, 40),
        reemplazaClave: String(body.reemplazaClave || "").trim().slice(0, 80),
        envioAConvenir: !ENVIO_CORREO_HABILITADO && conEnvio,
        envioEstimado: body.envioEstimado === true,
      }),
      // Apps Script redirige mid-call (302); necesario para que fetch lo siga.
      redirect: "follow",
      cache: "no-store",
    });
    const data = await r.json().catch(() => ({ ok: false, error: "bad_response" }));
    const headers = rateLimitHeaders(LIMIT, rl);
    if (!r.ok || data.error || !data.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: data.error || "upstream_error",
          // `faltantes` (sku/pedido/disponible) viaja al cliente para poder
          // decirle QUÉ ítem se quedó sin stock en vez de un error genérico.
          ...(Array.isArray(data.faltantes) ? { faltantes: data.faltantes } : {}),
          // `cambios` (sku/vigenteEft/vigenteTn) cuando cambiaron los precios desde
          // que el cliente armó el carrito: la web los aplica y pide confirmar.
          ...(Array.isArray(data.cambios) ? { cambios: data.cambios } : {}),
        },
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
