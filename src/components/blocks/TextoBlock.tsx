import { renderMarkdownSeguro, safeColor } from "../../lib/sanitize";

export type TextoBlockConfig = {
  titulo?: string;
  subtitulo?: string;
  texto?: string;
  alineacion?: "left" | "center" | "right";
  fondoColor?: string;
};

export function TextoBlock({ config }: { config: TextoBlockConfig }) {
  const align = {
    left: "text-left",
    center: "text-center mx-auto",
    right: "text-right",
  }[config.alineacion || "left"];

  const bgColor = safeColor(config.fondoColor);

  return (
    <section
      className="py-16"
      style={bgColor ? { backgroundColor: bgColor } : undefined}
    >
      <div className={`max-w-3xl mx-auto px-6 sm:px-10 ${align}`}>
        {config.subtitulo && (
          <span className="text-xs uppercase tracking-[0.3em] text-rose font-semibold">
            {config.subtitulo}
          </span>
        )}
        {config.titulo && (
          <h2 className="font-heading text-3xl sm:text-4xl text-burgundy mt-2 mb-6">
            {config.titulo}
          </h2>
        )}
        {config.texto && (
          <div
            className="prose prose-stone max-w-none space-y-4 text-ink/85 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: renderMarkdownSeguro(config.texto) }}
          />
        )}
      </div>
    </section>
  );
}
