/**
 * site.ts — Helper centralizado para la URL base del sitio.
 *
 * Lee de `NEXT_PUBLIC_SITE_URL` (env var en Vercel + .env.local local).
 * Default a producción Vercel actual. Cuando se registre el dominio propio
 * (casaamor.com.ar), cambiar la env var en Vercel y TODO el SEO (sitemap,
 * robots, OG, JSON-LD, canonicals) usa las URLs nuevas sin tocar código.
 *
 * Sin slash final.
 */
export const SITE_URL: string =
  (process.env.NEXT_PUBLIC_SITE_URL || "https://casaamor-web.vercel.app").replace(/\/+$/, "");

/** Concatena un path a SITE_URL garantizando exactamente un slash separador. */
export function siteUrl(path: string = "/"): string {
  if (!path || path === "/") return SITE_URL + "/";
  const clean = path.startsWith("/") ? path : `/${path}`;
  return SITE_URL + clean;
}
