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
 * El cliente de la API vive en @/lib/correo-argentino (auth JWT + cache + /rates).
 */

import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp, rateLimitHeaders } from "@/lib/ratelimit";
import { correoConfigurado, cotizarCorreo, type RateCorreo } from "@/lib/correo-argentino";

export const runtime = "nodejs";

// Rate limit: el cotizador puede dispararse en cada keystroke del CP, no
// queremos abusos. 30 cotizaciones/min/IP es generoso para un usuario real.
const LIMIT = 30;
const WINDOW_MS = 60 * 1000;

// CP origen del envío. CasaAmor: 1621 Benavidez (GBA Norte).
// Hardcoded por ahora — se moverá a ConfigWeb si en el futuro la dueña se muda.
const CP_ORIGEN = "1621";

type BodyIn = {
  cpDestino?: string;
  pesoGramos?: number;
  altoCm?: number;
  anchoCm?: number;
  profundidadCm?: number;
  tipoEntrega?: "domicilio" | "sucursal" | "ambas";
};

type OpcionEnvio = {
  tipo: "domicilio" | "sucursal";
  precio: number;
  plazoMinDias: number;
  plazoMaxDias: number;
  transportista: "correo_argentino";
  descripcion: string;
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

  // Correo limita cada lado a 150 cm. En vez de RECHAZAR (bloqueaba la compra), se
  // clampa a 150: para paquetes densos el peso REAL domina la tarifa, así que el
  // precio queda igual de razonable y nunca se pierde la venta. El modelo de caja
  // (calcularPaqueteCarrito) ya mantiene las medidas bajo 150 para pedidos normales.
  const altoCm = Math.max(5, Math.min(150, Math.round(Number(body.altoCm) || 15)));
  const anchoCm = Math.max(5, Math.min(150, Math.round(Number(body.anchoCm) || 20)));
  const profundidadCm = Math.max(5, Math.min(150, Math.round(Number(body.profundidadCm) || 10)));

  const tipoEntrega = body.tipoEntrega || "ambas";

  const argsPaquete = { cpOrigen: CP_ORIGEN, cpDestino, pesoGramos, altoCm, anchoCm, profundidadCm };

  // Cotización REAL con la API MiCorreo si están las credenciales; si no está
  // configurada, falla o no devuelve tarifas, caemos al estimador local.
  let opciones: OpcionEnvio[];
  let esEstimado: boolean;
  if (correoConfigurado()) {
    try {
      const mapeadas = mapRatesToOpciones(await cotizarCorreo(argsPaquete));
      if (mapeadas.length > 0) {
        opciones = mapeadas;
        esEstimado = false;
      } else {
        opciones = cotizarStub(argsPaquete);
        esEstimado = true;
      }
    } catch (err) {
      console.error(
        "[envios/cotizar] API Correo falló, usando estimado:",
        (err as Error)?.message || err,
      );
      opciones = cotizarStub(argsPaquete);
      esEstimado = true;
    }
  } else {
    opciones = cotizarStub(argsPaquete);
    esEstimado = true;
  }

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

/**
 * Convierte las tarifas de la API MiCorreo al shape OpcionEnvio del frontend.
 * La API puede devolver varios productos por tipo (Clásico CP, Expreso EP);
 * nos quedamos con el MÁS BARATO por tipo (domicilio / sucursal) para no
 * saturar el checkout con opciones. Descarta tarifas con precio <= 0.
 */
function mapRatesToOpciones(rates: RateCorreo[]): OpcionEnvio[] {
  const porTipo = new Map<"domicilio" | "sucursal", OpcionEnvio>();
  for (const rt of rates) {
    const precio = Math.round(rt.price);
    if (precio <= 0) continue;
    const tipo: "domicilio" | "sucursal" = rt.deliveredType === "S" ? "sucursal" : "domicilio";
    const opc: OpcionEnvio = {
      tipo,
      precio,
      plazoMinDias: rt.deliveryTimeMin,
      plazoMaxDias: rt.deliveryTimeMax,
      transportista: "correo_argentino",
      descripcion:
        tipo === "sucursal"
          ? `${rt.productName} — Retiro en sucursal`
          : `${rt.productName} — Entrega a domicilio`,
    };
    const prev = porTipo.get(tipo);
    if (!prev || opc.precio < prev.precio) porTipo.set(tipo, opc);
  }
  return Array.from(porTipo.values());
}

// ───────────────────────────────────────────────────────────────────────────────
// STUB DE COTIZACIÓN
// ───────────────────────────────────────────────────────────────────────────────

type ZonaCorreo =
  | "caba"
  | "gba"
  | "centro"
  | "cuyo"
  | "nea"
  | "noa"
  | "patagonia_norte"
  | "patagonia_sur";

/**
 * Mapea CP destino a zona Correo Argentino para tarifa.
 * Reglas aproximadas basadas en rangos típicos por provincia 2026.
 */
function zonaDeCp(cp: string): ZonaCorreo {
  const n = Number(cp);
  if (n >= 1000 && n <= 1499) return "caba";
  if (n >= 1500 && n <= 2999) return "gba";
  if ((n >= 3000 && n <= 3299) || (n >= 5000 && n <= 5199) || (n >= 5800 && n <= 5999))
    return "centro"; // Santa Fe, Córdoba (parte), Mendoza centro
  if (n >= 3300 && n <= 3599) return "nea"; // Misiones, Chaco
  if (n >= 4000 && n <= 4999) return "noa"; // Salta, Jujuy, Tucumán, La Rioja
  if ((n >= 5400 && n <= 5599) || (n >= 5700 && n <= 5799)) return "cuyo"; // San Juan, San Luis
  if (n >= 8000 && n <= 8499) return "patagonia_norte"; // Río Negro, Neuquén
  if (n >= 9000) return "patagonia_sur"; // Chubut, Santa Cruz, TDF
  // Default: centro (tarifa intermedia conservadora)
  return "centro";
}

/**
 * Tarifa base por zona y peso (en kg). Plazo en días hábiles.
 * Tarifa "domicilio" — sucursal es ~20% más barato.
 *
 * Fuente: tarifario público Correo Argentino Encomienda Clásica 2026
 * (aproximado, puede variar). Cuando llegue API real, esto se reemplaza.
 */
const TARIFA_DOMICILIO_2026: Record<
  ZonaCorreo,
  { hasta1kg: number; hasta3kg: number; hasta5kg: number; hasta10kg: number; plazoMin: number; plazoMax: number }
> = {
  caba: { hasta1kg: 2500, hasta3kg: 3100, hasta5kg: 3700, hasta10kg: 4800, plazoMin: 1, plazoMax: 2 },
  gba: { hasta1kg: 2700, hasta3kg: 3300, hasta5kg: 4000, hasta10kg: 5200, plazoMin: 2, plazoMax: 3 },
  centro: { hasta1kg: 3500, hasta3kg: 4200, hasta5kg: 5200, hasta10kg: 6500, plazoMin: 3, plazoMax: 5 },
  cuyo: { hasta1kg: 4200, hasta3kg: 5000, hasta5kg: 6000, hasta10kg: 7500, plazoMin: 4, plazoMax: 6 },
  nea: { hasta1kg: 4500, hasta3kg: 5400, hasta5kg: 6500, hasta10kg: 8000, plazoMin: 4, plazoMax: 6 },
  noa: { hasta1kg: 4500, hasta3kg: 5400, hasta5kg: 6500, hasta10kg: 8000, plazoMin: 4, plazoMax: 6 },
  patagonia_norte: { hasta1kg: 5000, hasta3kg: 6000, hasta5kg: 7000, hasta10kg: 8800, plazoMin: 5, plazoMax: 7 },
  patagonia_sur: { hasta1kg: 5500, hasta3kg: 6700, hasta5kg: 7500, hasta10kg: 9500, plazoMin: 5, plazoMax: 8 },
};

function precioBasePorPeso(zona: ZonaCorreo, pesoGramos: number): number {
  const t = TARIFA_DOMICILIO_2026[zona];
  if (pesoGramos <= 1000) return t.hasta1kg;
  if (pesoGramos <= 3000) return t.hasta3kg;
  if (pesoGramos <= 5000) return t.hasta5kg;
  if (pesoGramos <= 10000) return t.hasta10kg;
  // Más de 10 kg: extrapolación lineal aproximada (poco frecuente para boutique)
  const kgExtra = (pesoGramos - 10000) / 1000;
  return t.hasta10kg + Math.ceil(kgExtra) * 300;
}

/**
 * Peso volumétrico Correo Argentino: (alto × ancho × prof) / 5000
 * Se usa el mayor entre peso real y peso volumétrico para tarifar.
 */
function pesoVolumetrico(altoCm: number, anchoCm: number, profCm: number): number {
  return Math.round((altoCm * anchoCm * profCm) / 5);
}

function cotizarStub(args: {
  cpOrigen: string;
  cpDestino: string;
  pesoGramos: number;
  altoCm: number;
  anchoCm: number;
  profundidadCm: number;
}): OpcionEnvio[] {
  const zona = zonaDeCp(args.cpDestino);
  const pesoVol = pesoVolumetrico(args.altoCm, args.anchoCm, args.profundidadCm);
  const pesoTarifar = Math.max(args.pesoGramos, pesoVol);
  const precioDomicilio = precioBasePorPeso(zona, pesoTarifar);
  const precioSucursal = Math.round(precioDomicilio * 0.8); // sucursal ~20% más barato
  const t = TARIFA_DOMICILIO_2026[zona];

  return [
    {
      tipo: "domicilio",
      precio: precioDomicilio,
      plazoMinDias: t.plazoMin,
      plazoMaxDias: t.plazoMax,
      transportista: "correo_argentino",
      descripcion: "Correo Argentino — Entrega en tu domicilio",
    },
    {
      tipo: "sucursal",
      precio: precioSucursal,
      plazoMinDias: t.plazoMin,
      plazoMaxDias: t.plazoMax,
      transportista: "correo_argentino",
      descripcion: "Correo Argentino — Retiro en sucursal Correo",
    },
  ];
}
