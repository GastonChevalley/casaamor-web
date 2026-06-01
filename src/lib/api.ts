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

/**
 * Helper robusto para interpretar campos "boolean-like" de la hoja ConfigWeb.
 * Acepta: true (boolean), "true"/"TRUE", "1", "yes", "sí"/"si".
 * Rechaza: false/null/undefined/"" / cualquier otro string.
 *
 * Necesario porque Apps Script puede devolver `boolean true` o `"TRUE"` string,
 * y Google Sheets a veces normaliza `TRUE` literal a checkbox booleano.
 */
export function isTrueStr(v: unknown): boolean {
  if (v === true) return true;
  if (v === false || v === null || v === undefined) return false;
  const s = String(v).trim().toLowerCase();
  return s === "true" || s === "1" || s === "yes" || s === "sí" || s === "si";
}

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

export type Variante = {
  sku: string;
  valor: string;
  orden: number;
  precioEft: number;
  precioTn: number;
  stock: number;
  oferta: boolean;
  descOfertaPct: number;
  fotoUrl?: string;
  fotos?: string[];
  disponible: boolean;
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
  categoriaId?: string;
  categoriaIdsExtra?: string[];   // categorías adicionales tipo "tags" — Addendum 72
  fotoUrl?: string;          // primera foto (backward-compat)
  fotos?: string[];          // array de hasta 4 fotos (Addendum 52)
  categoria?: string;
  descripcion?: string;      // copy público largo (markdown ligero) — Addendum 60
  medidas?: string;          // medidas/dimensiones del producto — Addendum 60
  destacado?: boolean;
  // Variantes (Addendum 61)
  varianteTipo?: string | null;   // "color" | "talle" | "material" | null si sin variantes
  variantes?: Variante[];          // [] si sin variantes
  // Card del catálogo: solo si es un grupo con N>1 variantes
  precioEftMin?: number;
  precioEftMax?: number;
  variantesCount?: number;
  // Productos sugeridos/relacionados — solo presente en detalle (_apiProducto_) — Addendum 72
  productosRelacionados?: string[];  // SKUs curados a mano (solo para admin write)
  relacionados?: Producto[];          // computado por backend, máx 4 cards con shape de catálogo
};

export type CategoriaHija = {
  id: string;
  slug: string;
  nombre: string;
  orden: number;
  icono: string;
  descripcion: string;
  parentId: string;
};

export type Categoria = {
  id: string;
  slug: string;
  nombre: string;
  orden: number;
  icono: string;
  descripcion: string;
  hijos: CategoriaHija[];
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
  color_burgundy: "#b24966",
  color_burgundy_dark: "#8e3a52",
  color_rose: "#c66585",
  color_gold: "#dbbb83",
  color_gold_dark: "#b89860",
  color_cream: "#ede3d7",
  color_cream_light: "#f9f3eb",
  color_ink: "#1f2937",
  color_footer: "#8e3a52",
  logo_url: "/logo-512.png",
  contacto_whatsapp: "5491100000000",
  contacto_email: "hola@casaamor.com.ar",
  contacto_instagram: "casaamor",
  contacto_horario: "Lun a Vie 10-18 hs",
  footer_texto: "Hecho con amor 💛",
  nav_categorias_pos: "abajo",       // 'inline' | 'abajo' | 'oculto'
  nav_categorias_en_footer: "FALSE",
  marquee_global_activo: "FALSE",
  marquee_global_textos: "20% OFF EFECTIVO O TRANSFERENCIA · 3 CUOTAS SIN INTERÉS · ENVÍOS A TODO EL PAÍS",
  marquee_global_color: "burgundy",
  cuotas_sin_interes: "3",
  cuotas_label_corto: "3 cuotas sin interés",
  medios_pago_texto: "**Tarjeta de crédito / débito** (Visa, Mastercard, Amex)\n**Mercado Pago** — todas las opciones de pago\n**Transferencia bancaria** — 15% off del precio de lista\n**Efectivo** — solo retiro en local, 15% off",
  medios_envio_texto: "**Andreani** — envío a domicilio en todo el país (24-72 hs)\n**Correo Argentino** — opción más económica\n**Retiro en local** — sin cargo, en CABA con cita previa\n\nVer detalles completos en la página de Envíos.",
  mostrar_buscador: "TRUE",
  buscador_placeholder: "¿Qué estás buscando?",
  card_estilo: "clasico",
  card_estilo_home: "clasico",
  card_columnas_home: "3",
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

  // Cache buster por ventana de 3 segundos. Garantiza propagación
  // de cambios de Sheet → Web en MAX 3 segundos sin depender del webhook
  // (que solo funciona en producción, no en localhost).
  //
  // Funciona en ambos lados:
  //   - Frontend (Next.js Data Cache): la URL cambia cada 3s → cache miss.
  //   - Backend (Google edge cache para script.google.com): idem.
  //
  // Dentro del mismo bucket de 3s, todas las requests van a la misma URL
  // → ambas capas cachean (no quema cuota).
  const tBucket = Math.floor(Date.now() / 3000);
  url.searchParams.set("_t", String(tBucket));

  try {
    // revalidate alineado al bucket (3s). El webhook, cuando funciona
    // (solo en producción con URL pública), invalida antes vía revalidatePath.
    const res = await fetch(url.toString(), {
      next: { revalidate: 3, tags: ["apps-script-api"] },
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

export async function obtenerProducto(sku: string): Promise<Producto | null> {
  if (!API_CONFIGURED) return null;
  const data = await fetchApi<{ producto: Producto | null }>("producto", { sku });
  if (data === null || data === undefined) return null;
  return data.producto ?? null;
}

export async function obtenerCategorias(): Promise<Categoria[]> {
  if (!API_CONFIGURED) return [];
  const data = await fetchApi<{ categorias: Categoria[] }>("categorias");
  return data?.categorias ?? [];
}
