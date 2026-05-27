import Link from "next/link";
import { safeUrl } from "../../lib/sanitize";
import { cloudinaryUrl } from "../../lib/img";

export type HeroBlockConfig = {
  titulo?: string;
  tituloAcento?: string;     // palabra/frase que se destaca en gold
  subtitulo?: string;
  bajada?: string;
  ctaText?: string;
  ctaLink?: string;
  ctaSecText?: string;
  ctaSecLink?: string;
  fondo?: "rose" | "burgundy" | "cream" | "imagen";
  fondoImagenUrl?: string;
  alineacion?: "left" | "center";
};

export function HeroBlock({
  config,
  whatsapp,
}: {
  config: HeroBlockConfig;
  whatsapp?: string;
}) {
  const fondo = config.fondo || "rose";
  const bgClass = {
    rose: "bg-rose text-cream-light",
    burgundy: "bg-burgundy text-cream-light",
    cream: "bg-cream text-burgundy",
    imagen: "bg-rose text-cream-light",
  }[fondo];

  const align = config.alineacion === "center" ? "sm:text-center sm:items-center" : "";

  // Resolver link especial "whatsapp" → wa.me real. Resto: sanitizar como URL.
  const resolveLink = (link?: string) => {
    if (!link) return null;
    if (link === "whatsapp" && whatsapp) {
      return `https://wa.me/${whatsapp}`;
    }
    const safe = safeUrl(link, { permitirEspecial: false });
    return safe || null;
  };
  const ctaHref = resolveLink(config.ctaLink);
  const ctaSecHref = resolveLink(config.ctaSecLink);

  return (
    <section
      className={`relative overflow-hidden ${bgClass}`}
      style={(() => {
        const safeBgUrl = safeUrl(config.fondoImagenUrl);
        if (!safeBgUrl) return undefined;
        // Transformación Cloudinary si aplica: redimensiona a tamaño hero (1920x1080).
        const optimizedUrl = cloudinaryUrl(safeBgUrl, "hero") || safeBgUrl;
        // CSS.escape no existe en SSR de forma garantizada; reemplazamos ",
        // (, ), \ y newlines para evitar romper la propiedad CSS.
        const safeForCss = optimizedUrl.replace(/["'()\\\n\r]/g, "");
        return {
          backgroundImage: `url("${safeForCss}")`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        };
      })()}
    >
      <div className="max-w-6xl mx-auto px-6 sm:px-10 py-20 sm:py-32 grid gap-10 sm:grid-cols-2 sm:items-center">
        <div className={`space-y-5 sm:space-y-7 ${align}`}>
          {config.subtitulo && (
            <span className="inline-block text-xs uppercase tracking-[0.3em] opacity-80">
              {config.subtitulo}
            </span>
          )}
          {(config.titulo || config.tituloAcento) && (
            <h1 className="font-heading text-5xl sm:text-6xl font-bold leading-[1.05]">
              {config.titulo}
              {config.tituloAcento && (
                <span className="block text-gold">{config.tituloAcento}</span>
              )}
            </h1>
          )}
          {config.bajada && (
            <p className="max-w-md text-base sm:text-lg opacity-90 leading-relaxed">
              {config.bajada}
            </p>
          )}
          {(ctaHref || ctaSecHref) && (
            <div className="flex flex-wrap gap-3 pt-2">
              {ctaHref && (
                <Link
                  href={ctaHref}
                  target={ctaHref.startsWith("http") ? "_blank" : undefined}
                  rel={ctaHref.startsWith("http") ? "noopener noreferrer" : undefined}
                  className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-gold text-burgundy font-semibold hover:bg-cream-light transition-colors shadow-md"
                >
                  {config.ctaText || "Ver más"}
                </Link>
              )}
              {ctaSecHref && (
                <Link
                  href={ctaSecHref}
                  target={ctaSecHref.startsWith("http") ? "_blank" : undefined}
                  rel={ctaSecHref.startsWith("http") ? "noopener noreferrer" : undefined}
                  className="inline-flex items-center justify-center px-6 py-3 rounded-full border border-current/40 hover:bg-current/10 transition-colors"
                >
                  {config.ctaSecText || "Más info"}
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
