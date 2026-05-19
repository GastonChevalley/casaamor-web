/**
 * api.ts — Cliente para los endpoints públicos del Apps Script web app.
 *
 * Por ahora son STUBS placeholder. En la Fase 2 del plan vamos a:
 *   - Implementar `?api=catalogo` en apps_script/PublicApi.gs
 *   - Implementar `?api=configweb`
 *   - Implementar `?api=producto`
 * y reemplazar estos stubs por fetch reales con ISR (revalidate cada 5 min).
 */

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

export type ConfigWeb = {
  hero?: { titulo: string; subtitulo: string; imagenUrl?: string };
  bannerPromo?: { activo: boolean; texto: string };
  sobre?: { titulo: string; texto: string };
  whatsapp?: string;
  instagram?: string;
  colores?: Record<string, string>;
};

const API_BASE = process.env.NEXT_PUBLIC_APP_SCRIPT_URL || "";
const API_TOKEN = process.env.APP_SCRIPT_API_TOKEN || "";

async function fetchApi<T>(api: string, params: Record<string, string> = {}): Promise<T | null> {
  if (!API_BASE || !API_TOKEN) {
    // Hasta que se configure el .env.local, devolver null (stub)
    return null;
  }
  const url = new URL(API_BASE);
  url.searchParams.set("api", api);
  url.searchParams.set("token", API_TOKEN);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  try {
    const res = await fetch(url.toString(), { next: { revalidate: 300 } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function obtenerCatalogo(): Promise<Producto[]> {
  const data = await fetchApi<{ productos: Producto[] }>("catalogo");
  return data?.productos ?? [];
}

export async function obtenerConfigWeb(): Promise<ConfigWeb> {
  const data = await fetchApi<ConfigWeb>("configweb");
  return data ?? {};
}

export async function obtenerProducto(sku: string): Promise<Producto | null> {
  const data = await fetchApi<{ producto: Producto }>("producto", { sku });
  return data?.producto ?? null;
}
