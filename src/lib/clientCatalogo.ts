/**
 * Cache cliente del catálogo lite para el dropdown del buscador.
 *
 * Patrón: singleton en window con lazy load on-demand.
 * Solo fetcha cuando alguien necesita el catálogo (primer focus del input).
 * Subsequent reads devuelven la cache inmediato.
 */

export type ProductoLite = {
  sku: string;
  nombre: string;
  proveedor: string;
  fotoUrl: string;
  precioEft: number;
  precioTn: number;
  oferta: boolean;
  descOfertaPct: number;
};

type WindowConCache = Window & {
  __casaamorCatalogo?: ProductoLite[];
  __casaamorCatalogoPromise?: Promise<ProductoLite[]>;
};

/**
 * Devuelve el catálogo cliente. Cachea en window. Si ya hay un fetch en curso,
 * espera ese mismo (evita 2 fetches paralelos en first paint).
 */
export async function getCatalogoCached(): Promise<ProductoLite[]> {
  if (typeof window === "undefined") return [];
  const w = window as WindowConCache;
  if (w.__casaamorCatalogo) return w.__casaamorCatalogo;
  if (w.__casaamorCatalogoPromise) return w.__casaamorCatalogoPromise;

  const promise = fetch("/api/catalogo")
    .then((r) => (r.ok ? r.json() : { productos: [] }))
    .then((data) => {
      const lista: ProductoLite[] = data?.productos || [];
      w.__casaamorCatalogo = lista;
      delete w.__casaamorCatalogoPromise;
      return lista;
    })
    .catch(() => {
      delete w.__casaamorCatalogoPromise;
      return [];
    });

  w.__casaamorCatalogoPromise = promise;
  return promise;
}

/**
 * Filtra productos por query string (nombre o sku, case-insensitive).
 * Ordena: startsWith(q) > includes(q). Devuelve top N (default 5).
 */
export function buscarEnCatalogo(
  catalogo: ProductoLite[],
  q: string,
  limite = 5,
): { matches: ProductoLite[]; total: number } {
  const term = q.trim().toLowerCase();
  if (!term) return { matches: [], total: 0 };

  const conScore = catalogo
    .map((p) => {
      const nombre = String(p.nombre || "").toLowerCase();
      const sku = String(p.sku || "").toLowerCase();
      let score = 0;
      if (nombre.startsWith(term)) score = 3;
      else if (nombre.includes(term)) score = 2;
      else if (sku.includes(term)) score = 1;
      return { p, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  return {
    matches: conScore.slice(0, limite).map((x) => x.p),
    total: conScore.length,
  };
}
