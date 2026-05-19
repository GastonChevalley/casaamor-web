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

async function fetchApi<T>(api: string, params: Record<string, string> = {}): Promise<T | null> {
  if (!API_BASE || !API_TOKEN) {
    return null;
  }
  const url = new URL(API_BASE);
  url.searchParams.set("api", api);
  url.searchParams.set("token", API_TOKEN);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  try {
    const res = await fetch(url.toString(), {
      next: { revalidate: 300 },
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function obtenerConfigWeb(): Promise<ConfigWeb> {
  const data = await fetchApi<{ config: ConfigWeb }>("configweb");
  if (!data?.config) return CONFIGWEB_FALLBACK;
  // Merge con fallback para asegurar que TODAS las keys existan
  return { ...CONFIGWEB_FALLBACK, ...data.config };
}

export async function obtenerMenu(): Promise<MenuItem[]> {
  const data = await fetchApi<{ items: MenuItem[] }>("menu");
  if (!data?.items || data.items.length === 0) return MENU_FALLBACK;
  return data.items;
}

export async function obtenerPaginas(): Promise<PageSummary[]> {
  const data = await fetchApi<{ paginas: PageSummary[] }>("paginas");
  return data?.paginas ?? [];
}

export async function obtenerPagina(slug: string): Promise<Page | null> {
  const data = await fetchApi<{ pagina: Page | null }>("pagina", { slug });
  return data?.pagina ?? null;
}

export async function obtenerCatalogo(): Promise<Producto[]> {
  const data = await fetchApi<{ productos: Producto[] }>("catalogo");
  return data?.productos ?? [];
}
