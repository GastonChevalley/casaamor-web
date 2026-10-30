/**
 * POST /api/envios/cotizar
 *
 * Cotiza el envío del carrito a un código postal destino. Devuelve opciones
 * de entrega (domicilio + sucursal) con precio y plazo estimado.
 *
 * ESTADO ACTUAL (B.2 — API REAL + fallback): cotiza contra la API oficial de
 * Mi Correo Negocios (MiCorreo v1) usando las credenciales en env vars. Si la
 * API no está configurada, falla o no cubre el CP, cae a un estimador local por
 * zona (degradación elegante — el cliente siempre ve un precio y la venta no se
 * traba). La respuesta trae `esEstimado`: false = tarifa oficial, true = estimado.
 *
 * Env vars necesarias (server-side, NUNCA con prefijo NEXT_PUBLIC_):
 *   MCN_API_USER      — userToken de la API (Basic Auth)
 *   MCN_API_PASSWORD  — passwordToken de la API (Basic Auth)
 *   MCN_CUSTOMER_ID   — customerId de 10 dígitos (string, con ceros a la izquierda)
 *   MCN_API_BASE      — opcional; default producción. Test: https://apitest.correoargentino.com.ar/micorreo/v1
 *
 * La cotización vive en @/lib/envio-cotizar (la usa también /api/pedidos/crear).
 */

import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp, rateLimitHeaders } from "@/lib/ratelimit";
import { CP_ORIGEN } from "@/lib/envio-config";
import { cotizarEnvio, normalizarMedidas } from "@/lib/envio-cotizar";

export const runtime = "nodejs";

// Rate limit: el cotizador puede dispararse en cada keystroke del CP, no
// queremos abusos. 30 cotizaciones/min/IP es generoso para un usuario real.
const LIMIT = 30;
const WINDOW_MS = 60 * 1000;

type BodyIn = {
  cpDestino?: string;
  pesoGramos?: number;
  altoCm?: number;
  anchoCm?: number;
  profundidadCm?: number;
  tipoEntrega?: "domicilio" | "sucursal" | "ambas";
};

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`envios-cotizar:${ip}`, LIMIT, WINDOW_MS);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limit_exceeded" },
      { status: 429, headers: rateLimitHeaders(LIMIT, rl) },
    );
  }

  let body: BodyIn = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  // Validaciones
  const cpDestino = String(body.cpDestino || "").trim().replace(/\D/g, "");
  if (!/^\d{4,5}$/.test(cpDestino)) {
    return NextResponse.json(
      { ok: false, error: "cp_invalido", message: "Código postal inválido. Ingresá 4 o 5 dígitos." },
      { status: 400 },
    );
  }

  const pesoGramos = Math.max(100, Math.round(Number(body.pesoGramos) || 500));
  if (pesoGramos > 25000) {
    return NextResponse.json(
      { ok: false, error: "peso_excedido", message: "El paquete supera el máximo de 25 kg de Correo Argentino." },
      { status: 400 },
    );
  }

  const { altoCm, anchoCm, profundidadCm } = normalizarMedidas(body);

  const tipoEntrega = body.tipoEntrega || "ambas";

  // Cotización REAL con la API MiCorreo si están las credenciales; si no está
  // configurada, falla o no devuelve tarifas, cae al estimador local.
  const { opciones, esEstimado } = await cotizarEnvio({ cpDestino, pesoGramos, altoCm, anchoCm, profundidadCm });

  const opcionesFiltradas =
    tipoEntrega === "ambas" ? opciones : opciones.filter((o) => o.tipo === tipoEntrega);

  return NextResponse.json(
    {
      ok: true,
      origen: CP_ORIGEN,
      destino: cpDestino,
      pesoGramos,
      transportista: "correo_argentino",
      opciones: opcionesFiltradas,
      // false = tarifa oficial de la API MiCorreo · true = estimador local.
      esEstimado,
    },
    { headers: rateLimitHeaders(LIMIT, rl) },
  );
}
