/**
 * analytics.ts — Helpers para enviar eventos a Google Analytics 4.
 *
 * `gtag()` la inyecta `<GoogleAnalytics>` de `@next/third-parties/google` cuando
 * existe la env var `NEXT_PUBLIC_GA_ID`. Si no está cargado (preview / dev / si
 * el script bloqueó por adblock), las funciones de acá son no-op.
 *
 * Uso típico:
 *   trackWhatsappClick({ sku: producto.sku, nombre: producto.nombre, precio: producto.precioEft });
 *
 * Documentación de eventos custom GA4:
 *   https://developers.google.com/analytics/devguides/collection/ga4/reference/events
 */

type GtagFn = (
  command: "event" | "config" | "set" | "consent",
  action: string,
  params?: Record<string, unknown>,
) => void;

declare global {
  interface Window {
    gtag?: GtagFn;
    dataLayer?: unknown[];
  }
}

/** Envía un evento custom a GA4 si gtag está disponible. */
export function trackEvent(eventName: string, params?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  if (typeof window.gtag !== "function") return;
  try {
    window.gtag("event", eventName, params || {});
  } catch {
    // silencioso — analytics nunca debe romper la UX
  }
}

/** Click en el CTA "Consultar por WhatsApp" desde detalle de producto. */
export function trackWhatsappClick(producto: {
  sku?: string;
  nombre?: string;
  precio?: number;
  variante?: string;
}): void {
  trackEvent("whatsapp_click", {
    sku: producto.sku || "",
    nombre: producto.nombre || "",
    precio: producto.precio || 0,
    variante: producto.variante || "",
    surface: "producto_detalle",
  });
}

/** Click en el botón flotante de WhatsApp (footer/sticky). */
export function trackWhatsappFloatingClick(): void {
  trackEvent("whatsapp_click", {
    surface: "floating_button",
  });
}
