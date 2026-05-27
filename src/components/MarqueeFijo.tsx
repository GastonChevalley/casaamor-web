import type { MarqueeBlockConfig } from "./blocks/MarqueeBlock";
import { MarqueeBlock } from "./blocks/MarqueeBlock";
import { isTrueStr } from "@/lib/api";

/**
 * MarqueeFijo — wrapper que renderiza un MarqueeBlock arriba del Header en
 * TODAS las páginas, leyendo la config global de ConfigWeb:
 *  - marquee_global_activo (boolean-like, ver isTrueStr)
 *  - marquee_global_textos (string con · como separador)
 *  - marquee_global_color  (burgundy | gold | rose | cream)
 *
 * Si la dueña apaga `marquee_global_activo`, no renderiza nada.
 */
export function MarqueeFijo({
  activo,
  textosRaw,
  color,
}: {
  activo?: string;
  textosRaw?: string;
  color?: string;
}) {
  if (!isTrueStr(activo)) return null;
  const textos = (textosRaw || "")
    .split("·")
    .map((t) => t.trim())
    .filter(Boolean);
  if (textos.length === 0) return null;

  const colorLc = String(color || "").trim().toLowerCase();
  const valid = ["burgundy", "burgundy-dark", "gold", "rose", "cream"];
  const colorOk = (valid.includes(colorLc) ? colorLc : "burgundy") as MarqueeBlockConfig["color"];

  return <MarqueeBlock config={{ textos, color: colorOk, velocidad: 30 }} />;
}
