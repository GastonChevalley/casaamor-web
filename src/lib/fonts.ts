/**
 * fonts.ts — Lista curada de Google Fonts disponibles para CasaAmor.
 *
 * Importante: next/font/google requiere imports estáticos. NO podemos hacer
 * `Font(name)` dinámico. Por eso pre-cargamos las 10 fuentes y exponemos un
 * map por ID. El layout selecciona según ConfigWeb.font_heading / font_body.
 */

import {
  Fraunces,
  Playfair_Display,
  Cormorant_Garamond,
  DM_Serif_Display,
  Patua_One,
  Geist,
  Inter,
  Manrope,
  Plus_Jakarta_Sans,
  Quicksand,
} from "next/font/google";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["400", "600", "700", "900"],
  display: "swap",
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "600", "700", "900"],
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const dmSerif = DM_Serif_Display({
  variable: "--font-dm-serif",
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});

const patua = Patua_One({
  variable: "--font-patua",
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
});

const quicksand = Quicksand({
  variable: "--font-quicksand",
  subsets: ["latin"],
  display: "swap",
});

/**
 * Catálogo público — usado por el admin para el dropdown.
 */
export const FUENTES = {
  // Serifs (recomendadas para titulares)
  fraunces:   { nombre: "Fraunces",            grupo: "serif", instance: fraunces,  cssVar: "--font-fraunces" },
  playfair:   { nombre: "Playfair Display",    grupo: "serif", instance: playfair,  cssVar: "--font-playfair" },
  cormorant:  { nombre: "Cormorant Garamond",  grupo: "serif", instance: cormorant, cssVar: "--font-cormorant" },
  "dm-serif": { nombre: "DM Serif Display",    grupo: "serif", instance: dmSerif,   cssVar: "--font-dm-serif" },
  patua:      { nombre: "Patua One",           grupo: "serif", instance: patua,     cssVar: "--font-patua" },
  // Sans (recomendadas para cuerpo)
  geist:      { nombre: "Geist",               grupo: "sans",  instance: geist,     cssVar: "--font-geist" },
  inter:      { nombre: "Inter",               grupo: "sans",  instance: inter,     cssVar: "--font-inter" },
  manrope:    { nombre: "Manrope",             grupo: "sans",  instance: manrope,   cssVar: "--font-manrope" },
  jakarta:    { nombre: "Plus Jakarta Sans",   grupo: "sans",  instance: jakarta,   cssVar: "--font-jakarta" },
  quicksand:  { nombre: "Quicksand",           grupo: "sans",  instance: quicksand, cssVar: "--font-quicksand" },
} as const;

export type FontId = keyof typeof FUENTES;

/** Aplica todas las variables CSS de fuentes al className raíz */
export function todasLasFontsClassName(): string {
  return Object.values(FUENTES).map(f => f.instance.variable).join(" ");
}

/** Devuelve la CSS var de una fuente por id (con fallback) */
export function fontVarPorId(id: string | undefined, fallback: FontId): string {
  if (id && (id in FUENTES)) {
    return FUENTES[id as FontId].cssVar;
  }
  return FUENTES[fallback].cssVar;
}
