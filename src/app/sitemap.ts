import type { MetadataRoute } from "next";
import { obtenerCatalogo, obtenerCategorias, obtenerPaginas } from "@/lib/api";
import { siteUrl } from "@/lib/site";

/**
 * sitemap.xml dinámico — Next.js 16 App Router convention.
 *
 * Incluye:
 *   - Páginas estáticas + páginas custom del CMS (slug visible en hoja Pages).
 *   - Catálogo completo y detalle de cada producto activo.
 *   - Filtros de categoría top y subcategoría (URLs con query params).
 *
 * URL base controlada por `lib/site.ts` (env var NEXT_PUBLIC_SITE_URL).
 * Cuando cambie el dominio, este sitemap se regenera con las URLs nuevas
 * sin tocar código.
 *
 * Cache: Next.js cachea este Route Handler. Como invoca `obtenerCatalogo()`
 * (fetch a Apps Script), revalida con el ISR ya configurado en `lib/api.ts`.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  // Páginas estáticas + páginas CMS visibles
  let paginas: Awaited<ReturnType<typeof obtenerPaginas>> = [];
  let productos: Awaited<ReturnType<typeof obtenerCatalogo>> = [];
  let categorias: Awaited<ReturnType<typeof obtenerCategorias>> = [];

  try {
    [paginas, productos, categorias] = await Promise.all([
      obtenerPaginas(),
      obtenerCatalogo(),
      obtenerCategorias(),
    ]);
  } catch {
    // Si falla algún fetch (Apps Script down, etc) servimos al menos las páginas estáticas.
  }

  const entries: MetadataRoute.Sitemap = [];

  // 1) Home explícito (priority 1)
  entries.push({
    url: siteUrl("/"),
    lastModified: now,
    changeFrequency: "weekly",
    priority: 1.0,
  });

  // 2) Catálogo (priority 0.9 — hub principal)
  entries.push({
    url: siteUrl("/productos"),
    lastModified: now,
    changeFrequency: "daily",
    priority: 0.9,
  });

  // 3) Páginas del CMS (excluyendo "/" que ya está arriba)
  for (const p of paginas) {
    if (!p.slug || p.slug === "/") continue;
    entries.push({
      url: siteUrl(p.slug),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    });
  }

  // 4) Detalle de cada producto activo (priority 0.8)
  for (const prod of productos) {
    if (!prod.sku) continue;
    entries.push({
      url: siteUrl(`/productos/${encodeURIComponent(prod.sku)}`),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    });
  }

  // 5) Filtros de categoría top + subcategoría (priority 0.6).
  //    Útil para que Google indexe los listados por categoría, no solo el detalle.
  for (const cat of categorias) {
    if (!cat.slug) continue;
    entries.push({
      url: siteUrl(`/productos?cat=${encodeURIComponent(cat.slug)}`),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.6,
    });
    for (const hijo of cat.hijos || []) {
      if (!hijo.slug) continue;
      entries.push({
        url: siteUrl(
          `/productos?cat=${encodeURIComponent(cat.slug)}&sub=${encodeURIComponent(hijo.slug)}`,
        ),
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.5,
      });
    }
  }

  return entries;
}
