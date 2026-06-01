import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { obtenerCategorias, type Categoria, type CategoriaHija } from "../../lib/api";
import { cloudinaryUrl } from "../../lib/img";

export type CategoriasTilesBlockConfig = {
  titulo?: string;
  subtitulo?: string;
  /**
   * 'top' = todas las categorías top automáticas, en su orden.
   * 'manual' = solo las indicadas en `slugs`, en ese orden.
   * Default: 'top'.
   */
  modo?: "top" | "manual";
  /** Solo si modo='manual'. Slugs de categorías top o subcategorías. */
  slugs?: string[];
  /** Override de imagen por slug: { tablas: 'https://...', deco: 'https://...' }. */
  imagenes?: Record<string, string>;
  /** Override de bajada corta por slug: { tablas: 'Arma tus picaditas' }. */
  bajadas?: Record<string, string>;
  /** Columnas en desktop. Default 4. Mobile siempre muestra 2. */
  columnas?: 2 | 3 | 4;
  /** Aspect ratio de cada tile. Default 4:3 (look boutique). */
  aspectRatio?: "1:1" | "4:3" | "16:9";
};

/**
 * Bloque "Categorías con imagen" (Addendum 77). Patrón Tienda Nube / Anthropologie:
 * grid de tiles con foto + nombre + bajada que linkean al filtro de catálogo por
 * categoría. Server Component — lee `obtenerCategorias()` server-side.
 *
 * La dueña configura por JSON desde el editor PWA:
 *   - modo 'top': muestra automáticamente las categorías top (root). Si no
 *     define imagen, cae al placeholder con el icono (emoji) sobre cream.
 *   - modo 'manual': elige slugs concretos (puede mezclar top y subcategorías).
 *
 * Las URLs destino son /productos?cat=<slug> (top) o
 * /productos?cat=<padre>&sub=<slug> (sub), respetando el filtro existente
 * del catálogo (CatalogoClient.tsx).
 */
export async function CategoriasTilesBlock({
  config,
}: {
  config: CategoriasTilesBlockConfig;
}) {
  const arbol = await obtenerCategorias();
  const modo = config.modo === "manual" ? "manual" : "top";
  const cols = (config.columnas || 4) as 2 | 3 | 4;
  const ratio = config.aspectRatio || "4:3";
  const imagenes = config.imagenes || {};
  const bajadas = config.bajadas || {};

  // Mapa slug → { ref, slugMadre? } para resolver tanto top como sub.
  // Indexar el árbol una sola vez (~25 categorías típico).
  type Resuelta = {
    slug: string;
    nombre: string;
    icono: string;
    href: string;
  };
  const indice: Record<string, Resuelta> = {};
  arbol.forEach((c: Categoria) => {
    indice[c.slug] = {
      slug: c.slug,
      nombre: c.nombre,
      icono: c.icono || "",
      href: `/productos?cat=${encodeURIComponent(c.slug)}`,
    };
    (c.hijos || []).forEach((h: CategoriaHija) => {
      indice[h.slug] = {
        slug: h.slug,
        nombre: h.nombre,
        icono: h.icono || "",
        href: `/productos?cat=${encodeURIComponent(c.slug)}&sub=${encodeURIComponent(h.slug)}`,
      };
    });
  });

  // Lista final de tiles según modo.
  let tiles: Resuelta[];
  if (modo === "manual" && Array.isArray(config.slugs) && config.slugs.length > 0) {
    tiles = config.slugs
      .map((s) => indice[s])
      .filter((x): x is Resuelta => !!x);
  } else {
    tiles = arbol.map((c) => indice[c.slug]);
  }

  if (tiles.length === 0) {
    return (
      <section className="max-w-6xl mx-auto px-6 sm:px-10 py-16">
        <div className="rounded-2xl border-2 border-dashed border-burgundy/20 p-10 text-center bg-cream/30 text-ink/60">
          No hay categorías para mostrar todavía.
        </div>
      </section>
    );
  }

  const gridClass = {
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-3",
    4: "sm:grid-cols-2 lg:grid-cols-4",
  }[cols];

  const aspectClass = {
    "1:1": "aspect-square",
    "4:3": "aspect-[4/3]",
    "16:9": "aspect-[16/9]",
  }[ratio];

  return (
    <section className="max-w-6xl mx-auto px-6 sm:px-10 py-16">
      {(config.subtitulo || config.titulo) && (
        <header className="mb-8 text-center">
          {config.subtitulo && (
            <span className="text-xs uppercase tracking-[0.3em] text-rose font-semibold">
              {config.subtitulo}
            </span>
          )}
          {config.titulo && (
            <h2 className="font-heading text-3xl sm:text-4xl text-burgundy mt-2">
              {config.titulo}
            </h2>
          )}
        </header>
      )}

      <div className={`grid gap-3 sm:gap-5 grid-cols-2 ${gridClass}`}>
        {tiles.map((t) => {
          const fotoUrl = imagenes[t.slug] || "";
          const bajada = bajadas[t.slug] || "";
          return (
            <Link
              key={t.slug}
              href={t.href}
              className="group relative block overflow-hidden rounded-2xl bg-cream shadow-sm hover:shadow-xl transition-shadow"
            >
              <div className={`relative ${aspectClass} bg-cream overflow-hidden`}>
                {fotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={cloudinaryUrl(fotoUrl, "hero")}
                    alt={t.nombre}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <span
                    aria-hidden
                    className="absolute inset-0 flex items-center justify-center font-heading text-7xl text-burgundy/15 select-none"
                  >
                    {t.icono || t.nombre.charAt(0).toUpperCase()}
                  </span>
                )}
                {/* Overlay gradient para legibilidad del texto */}
                <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-burgundy/85 via-burgundy/40 to-transparent pointer-events-none" />
              </div>
              <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5 text-cream-light">
                <h3 className="font-heading text-lg sm:text-xl leading-tight">
                  {t.nombre}
                </h3>
                {bajada && (
                  <p className="text-xs sm:text-sm opacity-90 mt-1">{bajada}</p>
                )}
                <span className="inline-flex items-center gap-1 mt-2 text-xs sm:text-sm font-medium opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all">
                  Ver más <ArrowRight size={14} />
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
