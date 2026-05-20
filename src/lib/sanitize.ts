/**
 * sanitize.ts — Validadores de inputs que vienen del Apps Script API.
 *
 * Las dueñas pueden poner cualquier cosa en la planilla (es el "CMS"). Eso
 * significa que tenemos que tratar TODO valor como untrusted antes de:
 *   - inyectarlo en `style` (CSS injection)
 *   - inyectarlo en `href` (URL/open-redirect / javascript: scheme)
 *   - inyectarlo en `innerHTML` (XSS)
 *
 * Cada helper devuelve un valor seguro o vacío. Nunca tira.
 */

// =================== COLORS ===================

/**
 * Acepta solo formatos CSS de color simples y conocidos. Rechaza cualquier
 * cosa que pueda romper el atributo style.
 *
 * Permitidos:
 *   - #abc / #abcd / #aabbcc / #aabbccdd
 *   - rgb(0,0,0) / rgba(0,0,0,0.5)
 *   - hsl(0,0%,0%) / hsla(...)
 *   - palabras CSS (red, transparent, currentColor, etc.) acotadas a [a-z]+
 */
const COLOR_HEX_RE = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const COLOR_RGB_RE = /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(?:,\s*(?:0|1|0?\.\d+)\s*)?\)$/i;
const COLOR_HSL_RE = /^hsla?\(\s*\d{1,3}\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%\s*(?:,\s*(?:0|1|0?\.\d+)\s*)?\)$/i;
const COLOR_KEYWORD_RE = /^[a-z]{3,32}$/i;

export function safeColor(input: unknown, fallback = ""): string {
  if (typeof input !== "string") return fallback;
  const v = input.trim();
  if (!v) return fallback;
  if (COLOR_HEX_RE.test(v)) return v;
  if (COLOR_RGB_RE.test(v)) return v;
  if (COLOR_HSL_RE.test(v)) return v;
  if (COLOR_KEYWORD_RE.test(v)) return v;
  return fallback;
}

// =================== URLs ===================

/**
 * Acepta sólo:
 *   - URLs http(s) válidas
 *   - Rutas internas que empiecen con "/" (sin "//" porfuera del schema)
 *   - "mailto:" y "tel:" cuando se permite explícito
 *   - El string especial "whatsapp" (resuelto por componentes a un wa.me)
 *
 * Rechaza javascript:, data:, file:, ftp: y cualquier scheme raro.
 */
export function safeUrl(
  input: unknown,
  opts: { permitirMailto?: boolean; permitirTel?: boolean; permitirEspecial?: boolean } = {},
): string {
  if (typeof input !== "string") return "";
  const v = input.trim();
  if (!v) return "";

  // Token especial que componentes saben resolver (ej: "whatsapp" → URL real)
  if (opts.permitirEspecial && v === "whatsapp") return v;

  // Rutas internas: deben empezar con "/" pero NO "//" (protocol-relative)
  if (v.startsWith("/") && !v.startsWith("//")) return v;

  if (opts.permitirMailto && v.startsWith("mailto:")) {
    // Validar que tenga al menos un @
    if (v.includes("@")) return v;
    return "";
  }

  if (opts.permitirTel && v.startsWith("tel:")) {
    // Solo dígitos, +, -, espacios, paréntesis
    if (/^tel:[\d+\-\s()]+$/.test(v)) return v;
    return "";
  }

  // Tratar de parsear como URL absoluta
  try {
    const u = new URL(v);
    if (u.protocol === "http:" || u.protocol === "https:") {
      return u.toString();
    }
  } catch {
    // no parseable
  }
  return "";
}

/**
 * Sanitiza un handle de red social (Instagram, Twitter, etc).
 * Solo letras, números, puntos, guiones bajos. Sin @, sin URL.
 */
export function safeHandle(input: unknown): string {
  if (typeof input !== "string") return "";
  const v = input.trim().replace(/^@/, "");
  if (/^[a-zA-Z0-9._-]{1,32}$/.test(v)) return v;
  return "";
}

/**
 * Sanitiza un número de teléfono internacional (sólo dígitos).
 * Ej: "5491100000000" → ok. "+54 11 0000 0000" → "54110000000" (quita no-dígitos).
 */
export function safePhone(input: unknown): string {
  if (typeof input !== "string") return "";
  const v = input.replace(/[^\d]/g, "");
  if (v.length >= 8 && v.length <= 20) return v;
  return "";
}

// =================== HTML / Markdown ===================

/**
 * Escape HTML completo. NO permite tags, todo se vuelve texto literal.
 * Usar cuando el contenido es 100% texto.
 */
export function escapeHtml(input: unknown): string {
  if (input == null) return "";
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Renderizado de markdown ULTRA simple a HTML seguro.
 *
 * Soporta solo:
 *   - **bold**
 *   - _italic_
 *   - doble newline = párrafo
 *
 * Antes escapa TODO el HTML del input, así no hay forma de inyectar tags.
 * Después aplica los marcadores markdown sobre el texto ya escapado.
 */
export function renderMarkdownSeguro(input: unknown): string {
  if (input == null) return "";
  const escapado = escapeHtml(input);
  const conInline = escapado
    .replace(/\*\*([^*<>]+?)\*\*/g, "<strong>$1</strong>")
    .replace(/_([^_<>]+?)_/g, "<em>$1</em>");
  // Saltos de línea dobles = párrafos separados
  const parrafos = conInline.split(/\n\n+/).map(p => `<p>${p.replace(/\n/g, "<br>")}</p>`);
  return parrafos.join("");
}

// =================== STRINGS ===================

/**
 * Limita un string a una longitud máxima y trimea.
 * Útil para títulos / textos cortos que NO van a HTML directo.
 */
export function safeText(input: unknown, maxLen = 500): string {
  if (typeof input !== "string") return "";
  const v = input.trim();
  if (!v) return "";
  if (v.length > maxLen) return v.slice(0, maxLen);
  return v;
}
