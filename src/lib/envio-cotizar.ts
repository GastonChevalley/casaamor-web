/**
 * Cotización de envío con Correo Argentino, compartida por:
 *  - POST /api/envios/cotizar  (el checkout muestra el precio)
 *  - POST /api/pedidos/crear   (el servidor RE-COTIZA antes de crear el pedido: el
 *    costo lo mandaba el navegador y con un request armado se pagaba $1 de envío)
 *
 * Cotiza contra la API oficial de MiCorreo si hay credenciales; si no está
 * configurada, falla o no cubre el CP, cae a un estimador local por zona
 * (`esEstimado: true`). Ver @/lib/correo-argentino para el cliente de la API.
 */

import { correoConfigurado, cotizarCorreo, type RateCorreo } from "@/lib/correo-argentino";
import { CP_ORIGEN } from "@/lib/envio-config";

export type OpcionEnvio = {
  tipo: "domicilio" | "sucursal";
  precio: number;
  plazoMinDias: number;
  plazoMaxDias: number;
  transportista: "correo_argentino";
  descripcion: string;
};

/**
 * Correo limita cada lado a 150 cm. En vez de RECHAZAR (bloqueaba la compra), se
 * clampa a 150: para paquetes densos el peso REAL domina la tarifa, así que el
 * precio queda igual de razonable y nunca se pierde la venta. El modelo de caja
 * (calcularPaqueteCarrito) ya mantiene las medidas bajo 150 para pedidos normales.
 */
export function normalizarMedidas(b: { altoCm?: number; anchoCm?: number; profundidadCm?: number }) {
  return {
    altoCm: Math.max(5, Math.min(150, Math.round(Number(b.altoCm) || 15))),
    anchoCm: Math.max(5, Math.min(150, Math.round(Number(b.anchoCm) || 20))),
    profundidadCm: Math.max(5, Math.min(150, Math.round(Number(b.profundidadCm) || 10))),
  };
}

/** Cotiza un paquete a un CP. Nunca lanza: si la API falla, devuelve el estimado. */
export async function cotizarEnvio(args: {
  cpDestino: string;
  pesoGramos: number;
  altoCm: number;
  anchoCm: number;
  profundidadCm: number;
}): Promise<{ opciones: OpcionEnvio[]; esEstimado: boolean }> {
  const argsPaquete = { cpOrigen: CP_ORIGEN, ...args };
  if (correoConfigurado()) {
    try {
      const mapeadas = mapRatesToOpciones(await cotizarCorreo(argsPaquete));
      if (mapeadas.length > 0) return { opciones: mapeadas, esEstimado: false };
    } catch (err) {
      console.error("[envio-cotizar] API Correo falló, usando estimado:", (err as Error)?.message || err);
    }
  }
  return { opciones: cotizarStub(argsPaquete), esEstimado: true };
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
