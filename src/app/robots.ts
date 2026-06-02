import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

/**
 * robots.txt — Next.js 16 App Router convention.
 *
 * Permite indexación total del sitio público excepto:
 *   - /api/*  → rutas técnicas internas (revalidate, suscribir, catalogo proxy).
 *
 * Referencia el sitemap dinámico para que Google lo descubra.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: "/api/",
    },
    sitemap: siteUrl("/sitemap.xml"),
    host: siteUrl("/").replace(/\/+$/, ""),
  };
}
