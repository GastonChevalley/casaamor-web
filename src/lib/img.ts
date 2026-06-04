/**
 * img.ts — Helper para servir imágenes Cloudinary con transformaciones automáticas.
 *
 * Cloudinary acepta transformaciones en la URL:
 *   https://res.cloudinary.com/<cloud>/image/upload/<TRANSFORMACIONES>/<path>
 *   https://res.cloudinary.com/<cloud>/image/fetch/<TRANSFORMACIONES>/<URL_REMOTA>
 *
 * Todas las variantes usan c_fill,g_auto: recorta al cuadrado del slot, la IA
 * de Cloudinary detecta el sujeto principal y lo mantiene centrado en el frame.
 *
 * Estrategia: el widget de Cloudinary (en la PWA admin) OBLIGA a recortar a
 * 1:1 al subir → las fotos llegan al sistema ya cuadradas → c_fill no recorta
 * más → no hay franjas ni cortes raros. La IA solo importa para fotos
 * importadas de TN o las históricas que llegaron en otro aspect ratio.
 *
 * Para URLs que NO son Cloudinary (Drive, externas), devuelve la URL tal cual.
 */

export type ImgVariant =
  | "card"         // 600×600 — productos en grid
  | "card-mobile"  // 400×400 — productos en grid mobile
  | "detail"       // 1200×1200 — detalle de producto
  | "hero"         // 1920×1080 — hero full-width (banner)
  | "carrusel"     // 1600×900 — slides de carrusel (banner)
  | "galeria"      // 800×800 — items de galería
  | "thumb"        // 200×200 — thumbnails
  // Tile variants para CategoriasTilesBlock — entregan la foto YA en el aspect
  // ratio del slot para evitar doble recorte (Cloudinary + browser object-cover).
  | "tile-1-1"     // 1200×1200 cuadrado
  | "tile-4-3"     // 1600×1200 — 4:3 (default del bloque)
  | "tile-16-9"    // 1920×1080 — 16:9 (banner-style)
  // OG variant — forzamos JPG porque WhatsApp/Facebook prefieren JPG/PNG sobre WebP
  // para previews de OpenGraph. 1200×1200 (cuadrado) es seguro para todos los crawlers.
  | "og";          // 1200×1200 JPG — para og:image y twitter:image

const VARIANTS: Record<ImgVariant, string> = {
  card:          "w_600,h_600,c_fill,g_auto,q_auto,f_auto",
  "card-mobile": "w_400,h_400,c_fill,g_auto,q_auto,f_auto",
  detail:        "w_1200,h_1200,c_fill,g_auto,q_auto,f_auto",
  hero:          "w_1920,h_1080,c_fill,g_auto,q_auto,f_auto",
  carrusel:      "w_1600,h_900,c_fill,g_auto,q_auto,f_auto",
  galeria:       "w_800,h_800,c_fill,g_auto,q_auto,f_auto",
  thumb:         "w_200,h_200,c_fill,g_auto,q_auto,f_auto",
  "tile-1-1":    "w_1200,h_1200,c_fill,g_auto,q_auto,f_auto",
  "tile-4-3":    "w_1600,h_1200,c_fill,g_auto,q_auto,f_auto",
  "tile-16-9":   "w_1920,h_1080,c_fill,g_auto,q_auto,f_auto",
  og:            "w_1200,h_1200,c_fill,g_auto,q_auto,f_jpg",
};

/**
 * Devuelve una URL transformada de Cloudinary. Si no es URL Cloudinary, devuelve
 * la original tal cual (compatibilidad con Drive público o URLs externas).
 *
 * Maneja URLs que ya tienen transformaciones (las reemplaza por la nueva).
 */
export function cloudinaryUrl(url: string | undefined | null, variant: ImgVariant): string {
  if (!url || typeof url !== "string") return "";
  const trimmed = url.trim();
  if (!trimmed) return "";

  // Procesar URLs de Cloudinary: tanto image/upload/ (assets propios) como image/fetch/ (URL remota).
  const match = trimmed.match(/^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/(?:upload|fetch)\/)(.+)$/);
  if (!match) return trimmed; // No es Cloudinary → devolver tal cual

  const [, base, rest] = match;
  const transformacion = VARIANTS[variant];

  // Si la URL YA tenía transformaciones, las reemplazamos.
  // Para image/fetch/, el "rest" arranca con "https://..." (URL remota) — nunca tiene transformaciones
  // previas en el formato Cloudinary, así que NO intentar parsear. Solo aplica a image/upload/.
  let restoCamino = rest;
  if (!base.endsWith("/fetch/")) {
    const segments = rest.split("/");
    if (segments.length > 0) {
      const primero = segments[0];
      // Versión "vNNN" → mantener. Transformación "w_600,c_fill" → quitar.
      if (primero && !primero.match(/^v\d+$/) && primero.includes("_")) {
        restoCamino = segments.slice(1).join("/");
      }
    }
  }

  return `${base}${transformacion}/${restoCamino}`;
}

/**
 * Helper específico para placeholders SVG inline (usado cuando no hay foto).
 * Genera un fondo cream-light con la inicial del nombre en burgundy.
 */
export function placeholderDataUrl(nombre: string): string {
  const inicial = (nombre || "?").trim().charAt(0).toUpperCase() || "?";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="#f0e6d2"/><text x="100" y="135" font-size="100" font-family="Georgia,serif" fill="#7c2440" text-anchor="middle" opacity="0.3">${inicial}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
