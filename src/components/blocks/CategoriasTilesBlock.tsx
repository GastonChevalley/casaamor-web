import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { obtenerCategorias, type Categoria, type CategoriaHija } from "../../lib/api";
import { cloudinaryUrl, type ImgVariant } from "../../lib/img";

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
  /** Columnas en desktop. Default 4. */
  columnas?: 2 | 3 | 4;
  /** Columnas en mobile. Default 2. Si quiere look "card grande", poner 1. */
  columnasMobile?: 1 | 2;
  /** Aspect ratio de cada tile. Default 4:3 (look boutique). */
  aspectRatio?: "1:1" | "4:3" | "16:9";
  /**
   * Color del degradado overlay sobre cada tile (afecta legibilidad del nombre).
   * Opciones: 'burgundy' (default actual), 'gris' (negro con transparencia),
   * 'gold', 'rose', 'ink' (gris oscuro intenso).
   */
  degradeColor?: "burgundy" | "gris" | "gold" | "rose" | "ink";
  /**
   * Intensidad del degradado overlay. Define qué tan oscuro queda sobre la foto.
   * Default: 'fuerte' (comportamiento previo). Más opciones:
   * - 'suave': apenas perceptible, foto al 100%.
   * - 'medio': balance entre legibilidad y foto.
   * - 'fuerte': bien legible (default).
   * - 'muy_fuerte': máximo contraste, foto algo oculta.
   */
  degradeIntensidad?: "suave" | "medio" | "fuerte" | "muy_fuerte";
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
  const colsMobile = (config.columnasMobile === 1 ? 1 : 2) as 1 | 2;
  const ratio = config.aspectRatio || "4:3";
  const imagenes = config.imagenes || {};
  const bajadas = config.bajadas || {};
  const degradeKey = (
    ["burgundy", "gris", "gold", "rose", "ink"].includes(config.degradeColor || "")
      ? config.degradeColor
      : "burgundy"
  ) as "burgundy" | "gris" | "gold" | "rose" | "ink";
  const intensidadKey = (
    ["suave", "medio", "fuerte", "muy_fuerte"].includes(config.degradeIntensidad || "")
      ? config.degradeIntensidad
      : "fuerte"
  ) as "suave" | "medio" | "fuerte" | "muy_fuerte";

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

  const mobileGridClass = {
    1: "grid-cols-1",
    2: "grid-cols-2",
  }[colsMobile];

  const aspectClass = {
    "1:1": "aspect-square",
    "4:3": "aspect-[4/3]",
    "16:9": "aspect-[16/9]",
  }[ratio];

  // Variante de Cloudinary que entrega la foto EN EL MISMO aspect ratio del slot
  // → evita doble recorte (Cloudinary + browser object-cover).
  const tileVariant: ImgVariant = (
    ratio === "1:1" ? "tile-1-1" :
    ratio === "16:9" ? "tile-16-9" :
    "tile-4-3"
  );

  // Degradado overlay (Addendum 78 + intensidad Addendum 89): cada color tiene
  // 4 niveles de intensidad. Los stops están enumerados como strings literales
  // para que Tailwind los purgue correctamente (no se pueden construir clases
  // dinámicas — Tailwind solo encuentra lo que ve como string en el código).
  const DEGRADE_PRESETS = {
    burgundy: {
      suave:      "from-burgundy/40 via-burgundy/20 to-transparent",
      medio:      "from-burgundy/60 via-burgundy/35 to-transparent",
      fuerte:     "from-burgundy/85 via-burgundy/55 to-transparent",
      muy_fuerte: "from-burgundy/95 via-burgundy/70 to-transparent",
    },
    gris: {
      suave:      "from-black/40 via-black/20 to-transparent",
      medio:      "from-black/60 via-black/35 to-transparent",
      fuerte:     "from-black/85 via-black/55 to-transparent",
      muy_fuerte: "from-black/95 via-black/70 to-transparent",
    },
    gold: {
      suave:      "from-gold-dark/40 via-gold-dark/20 to-transparent",
      medio:      "from-gold-dark/60 via-gold-dark/35 to-transparent",
      fuerte:     "from-gold-dark/85 via-gold-dark/55 to-transparent",
      muy_fuerte: "from-gold-dark/95 via-gold-dark/70 to-transparent",
    },
    rose: {
      suave:      "from-rose/40 via-rose/20 to-transparent",
      medio:      "from-rose/60 via-rose/35 to-transparent",
      fuerte:     "from-rose/85 via-rose/55 to-transparent",
      muy_fuerte: "from-rose/95 via-rose/70 to-transparent",
    },
    ink: {
      suave:      "from-ink/40 via-ink/20 to-transparent",
      medio:      "from-ink/60 via-ink/35 to-transparent",
      fuerte:     "from-ink/90 via-ink/55 to-transparent",
      muy_fuerte: "from-ink/95 via-ink/70 to-transparent",
    },
  } as const;
  const gradientClass = DEGRADE_PRESETS[degradeKey][intensidadKey];

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

      <div className={`grid gap-3 sm:gap-5 ${mobileGridClass} ${gridClass}`}>
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
                    src={cloudinaryUrl(fotoUrl, tileVariant)}
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
                {/* Overlay gradient: color configurable + intensidad fija. h-3/4 oscurece más arriba para que el texto siempre tenga contraste. */}
                <div className={`absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t ${gradientClass} pointer-events-none`} />
              </div>
              {/* Texto: anclado al borde inferior (pb chico, pt-2) para vivir en la zona MÁS oscura del degradé y maximizar contraste. */}
              <div className="absolute inset-x-0 bottom-0 px-4 pb-3 pt-2 sm:px-5 sm:pb-4 text-cream-light">
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
