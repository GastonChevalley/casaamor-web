import { safeText } from "@/lib/sanitize";

export type MarqueeBlockConfig = {
  textos?: string[];
  separador?: string;
  velocidad?: number;          // segundos por loop completo
  color?: "burgundy" | "gold" | "rose" | "cream" | "burgundy-dark";
  activo?: boolean;
};

const COLOR_CLASSES: Record<NonNullable<MarqueeBlockConfig["color"]>, string> = {
  burgundy:      "bg-burgundy text-cream-light",
  "burgundy-dark": "bg-burgundy-dark text-cream-light",
  gold:          "bg-gold text-burgundy",
  rose:          "bg-rose text-cream-light",
  cream:         "bg-cream text-burgundy",
};

/**
 * Marquee — banner con texto scrolling derecha-a-izquierda en loop infinito.
 * Pausa al hover (definido en globals.css).
 * Duplica el contenido para evitar "salto" al cerrar el loop.
 */
export function MarqueeBlock({ config }: { config: MarqueeBlockConfig }) {
  if (config?.activo === false) return null;
  const textos = (config?.textos || []).map((t) => safeText(t)).filter(Boolean);
  if (textos.length === 0) return null;

  const separador = config?.separador || "·";
  const colorKey = String(config?.color || "burgundy").trim().toLowerCase() as MarqueeBlockConfig["color"];
  const colorClass = (colorKey && COLOR_CLASSES[colorKey]) || COLOR_CLASSES.burgundy;
  const velocidadBase = Math.max(5, Math.min(120, Number(config?.velocidad) || 30));

  // Cada "grupo" tiene que ser más ANCHO que la pantalla; si no, el loop
  // (translateX -50% sobre 2 grupos idénticos) deja huecos y con pocos textos el
  // banner se ve "cortado" y no cruza todo el ancho. Repetimos los textos según su
  // largo para garantizar ~320+ caracteres por grupo (cubre desktops anchos). La
  // duración escala con las repeticiones → la velocidad (px/s) queda igual sin
  // importar cuántos textos haya.
  const joinedLen = textos.join(" · ").length || 1;
  const rep = Math.min(20, Math.max(2, Math.ceil(320 / joinedLen)));
  const textosGrupo = Array.from({ length: rep }).flatMap(() => textos);
  const velocidad = velocidadBase * rep;

  const grupo = (pref: string) =>
    textosGrupo.flatMap((t, i) => [
      <span key={`t-${pref}-${i}`} className="px-3 font-medium tracking-wide text-xs sm:text-sm">{t}</span>,
      <span key={`s-${pref}-${i}`} className="opacity-70" aria-hidden>{separador}</span>,
    ]);

  return (
    <div className={`overflow-hidden py-2 ${colorClass}`} role="region" aria-label="Promociones">
      <div className="marquee-track" style={{ ["--marquee-duration" as string]: `${velocidad}s` }}>
        <div className="flex items-center shrink-0">{grupo("a")}</div>
        <div className="flex items-center shrink-0" aria-hidden>{grupo("b")}</div>
      </div>
    </div>
  );
}
