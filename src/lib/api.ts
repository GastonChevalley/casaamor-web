/**
 * api.ts — Cliente para los endpoints públicos del Apps Script web app.
 *
 * Cada función usa `next.revalidate: 300` (ISR 5 min) — los cambios que las
 * dueñas hagan en la planilla se reflejan en la web en máx 5 min.
 *
 * Devuelve siempre defaults razonables si la API falla o no está configurada,
 * así el build NUNCA crashea por config faltante.
 */

export type ConfigWeb = Record<string, string>;

export type MenuItem = {
  orden: number;
  label: string;
  href: string;
  visible: boolean;
  target: string;
};

export type Block = {
  type: string;
  config: Record<string, unknown>;
};

export type Page = {
  slug: string;
  title: string;
  meta: string;
  blocks: Block[];
};

export type PageSummary = {
  slug: string;
  title: string;
  meta: string;
  enMenu: boolean;
  enFooter: boolean;
};

export type Producto = {
  sku: string;
  proveedor: string;
  nombre: string;
  precioEft: number;
  precioTn: number;
  stock: number;
  oferta: boolean;
  descOfertaPct: number;
  fotoUrl?: string;
  categoria?: string;
  descripcion?: string;
  destacado?: boolean;
};

const API_BASE = process.env.NEXT_PUBLIC_APP_SCRIPT_URL || "";
const API_TOKEN = process.env.APP_SCRIPT_API_TOKEN || "";

/**
 * Indica si la API REMOTA está configurada (URL + token).
 * Cuando es true, las respuestas se respetan tal cual (incluso un null válido).
 * Cuando es false, se usan fallbacks locales — es solo para dev sin Apps Script.
 */
const API_CONFIGURED = Boolean(API_BASE && API_TOKEN);

/** Default config si el backend no responde — la web nunca se rompe. */
const CONFIGWEB_FALLBACK: ConfigWeb = {
  site_title: "CasaAmor",
  site_tagline: "Decoración con amor",
  site_descripcion: "Boutique de decoración y objetos únicos para tu hogar.",
  font_heading: "fraunces",
  font_body: "geist",
  color_burgundy: "#7c2440",
  color_burgundy_dark: "#5a1a2e",
  color_rose: "#b24967",
  color_gold: "#c89e4b",
  color_gold_dark: "#a87d2e",
  color_cream: "#f0e6d2",
  color_cream_light: "#fff8e9",
  color_ink: "#1f2937",
  logo_url: "/logo-512.png",
  contacto_whatsapp: "5491100000000",
  contacto_email: "hola@casaamor.com.ar",
  contacto_instagram: "casaamor",
  contacto_horario: "Lun a Vie 10-18 hs",
  footer_texto: "Hecho con amor 💛",
};

const MENU_FALLBACK: MenuItem[] = [
  { orden: 1, label: "Catálogo", href: "/productos", visible: true, target: "" },
  { orden: 2, label: "Sobre",    href: "/sobre",     visible: true, target: "" },
  { orden: 3, label: "Contacto", href: "/contacto",  visible: true, target: "" },
];

/**
 * Fallbacks de páginas — usados cuando la API no responde (sin token, network down,
 * dev local sin Apps Script). Espejo exacto de PAGES_DEFAULT en apps_script/Config.gs.
 * Mantener sincronizados.
 */
const PAGES_FALLBACK: Record<string, Page> = {
  "/": {
    slug: "/",
    title: "CasaAmor — Decoración con amor",
    meta: "Boutique de decoración y objetos únicos para tu hogar.",
    blocks: [
      {
        type: "hero",
        config: {
          titulo: "Decoración con",
          tituloAcento: "amor",
          bajada: "Piezas únicas, hechas con cariño y elegidas con criterio.",
          ctaText: "Ver catálogo",
          ctaLink: "/productos",
          ctaSecText: "Consultar por WhatsApp",
          ctaSecLink: "whatsapp",
          fondo: "rose",
        },
      },
      {
        type: "productos_destacados",
        config: {
          titulo: "Lo más amado del mes",
          subtitulo: "Destacados",
          modo: "destacados",
          columnas: 3,
          limite: 6,
        },
      },
      {
        type: "cta_contacto",
        config: {
          titulo: "Una boutique con historia propia",
          texto:
            "CasaAmor nació de las ganas de dos amigas de llenar casas de objetos con personalidad. Cada pieza la elegimos a mano.",
          linkVer: "/sobre",
          linkVerTexto: "Leé nuestra historia",
        },
      },
    ],
  },
  "/sobre": {
    slug: "/sobre",
    title: "Sobre nosotras",
    meta: "La historia detrás de CasaAmor — Mora y Lara.",
    blocks: [
      {
        type: "texto",
        config: {
          titulo: "La historia de CasaAmor",
          alineacion: "left",
          texto:
            "CasaAmor empezó como una conversación entre dos amigas: ¿por qué tan poca decoración con personalidad y a buen precio?\n\nHoy seleccionamos cada producto a mano. Tenemos proveedores de confianza, buscamos materiales reales y diseños que duren. Nada es masivo, nada es al azar.\n\nSi elegís CasaAmor, no estás comprando un objeto — estás invitando una historia a tu casa.\n\n_— Mora y Lara_",
        },
      },
    ],
  },
  "/contacto": {
    slug: "/contacto",
    title: "Contacto",
    meta: "Hablemos. WhatsApp, Instagram, email.",
    blocks: [
      {
        type: "cta_contacto",
        config: {
          titulo: "Hablemos",
          texto: "Te respondemos en horario comercial.",
          mostrarWhatsapp: true,
          mostrarInstagram: true,
          mostrarEmail: true,
        },
      },
    ],
  },
  "/envios": {
    slug: "/envios",
    title: "Envíos",
    meta: "Cómo te llega tu pedido CasaAmor.",
    blocks: [
      {
        type: "texto",
        config: {
          titulo: "Cómo te llega",
          texto:
            "**A todo el país** con Andreani, Correo Argentino o el método que prefieras. Te confirmamos el costo exacto al cerrar la compra.\n\n**Retiro en local** sin costo si coordinamos por WhatsApp.\n\n**Tiempos**: CABA/GBA 2-4 días hábiles. Interior 4-7 días desde el pago acreditado.",
        },
      },
    ],
  },
};

const PAGES_SUMMARY_FALLBACK: PageSummary[] = Object.values(PAGES_FALLBACK).map(p => ({
  slug: p.slug,
  title: p.title,
  meta: p.meta,
  enMenu: p.slug === "/sobre" || p.slug === "/contacto",
  enFooter: p.slug === "/sobre" || p.slug === "/contacto" || p.slug === "/envios",
}));

/**
 * Fetcher con cache ISR de 30s (acortado para iteración durante dev).
 * Para producción subir a 300s o agregar invalidate manual con revalidatePath.
 *
 * Devuelve undefined si la API no está configurada → llamadores caen a fallback.
 * Devuelve null si la API respondió pero hubo error (HTTP no-OK, parse fail).
 * Devuelve T si todo OK.
 */
async function fetchApi<T>(api: string, params: Record<string, string> = {}): Promise<T | null | undefined> {
  if (!API_CONFIGURED) return undefined;  // signal explícito de "no configurada"
  const url = new URL(API_BASE);
  url.searchParams.set("api", api);
  url.searchParams.set("token", API_TOKEN);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  try {
    // Revalidate alto (1 hora) porque la invalidación REAL la hace el webhook
    // /api/revalidate que dispara Apps Script onEdit. El TTL es solo safety net.
    const res = await fetch(url.toString(), {
      next: { revalidate: 3600, tags: ["apps-script-api"] },
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function obtenerConfigWeb(): Promise<ConfigWeb> {
  if (!API_CONFIGURED) return CONFIGWEB_FALLBACK;
  const data = await fetchApi<{ config: ConfigWeb }>("configweb");
  if (!data?.config) return CONFIGWEB_FALLBACK;
  // Merge con fallback para asegurar que TODAS las keys existan aunque
  // alguna falte en la planilla (defensa contra config incompleto).
  return { ...CONFIGWEB_FALLBACK, ...data.config };
}

export async function obtenerMenu(): Promise<MenuItem[]> {
  if (!API_CONFIGURED) return MENU_FALLBACK;
  const data = await fetchApi<{ items: MenuItem[] }>("menu");
  // Si la API responde con menu vacío (la dueña borró todo), respetamos eso.
  // Solo usamos fallback si NO hubo respuesta válida (error de red, etc).
  if (!data) return MENU_FALLBACK;
  return data.items ?? [];
}

export async function obtenerPaginas(): Promise<PageSummary[]> {
  if (!API_CONFIGURED) return PAGES_SUMMARY_FALLBACK;
  const data = await fetchApi<{ paginas: PageSummary[] }>("paginas");
  if (!data) return PAGES_SUMMARY_FALLBACK;  // error → fallback
  return data.paginas ?? [];                 // respuesta válida → respetar (puede ser [])
}

export async function obtenerPagina(slug: string): Promise<Page | null> {
  if (!API_CONFIGURED) {
    // Sin token: usar fallback (dev sin Apps Script disponible).
    return PAGES_FALLBACK[slug] ?? null;
  }
  const data = await fetchApi<{ pagina: Page | null }>("pagina", { slug });
  if (data === null) {
    // Error de red / HTTP no-OK → fallback para no romper la web
    return PAGES_FALLBACK[slug] ?? null;
  }
  // data === undefined ya cubierto arriba. Resto: respetar EXACTAMENTE la API.
  // Si la API dice "página no existe / invisible" (null), mostramos 404.
  return data?.pagina ?? null;
}

export async function obtenerCatalogo(): Promise<Producto[]> {
  if (!API_CONFIGURED) return [];
  const data = await fetchApi<{ productos: Producto[] }>("catalogo");
  return data?.productos ?? [];
}
