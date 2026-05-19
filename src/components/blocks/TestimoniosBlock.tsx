export type TestimoniosBlockConfig = {
  titulo?: string;
  items?: Array<{ texto: string; autor?: string; contexto?: string }>;
};

export function TestimoniosBlock({ config }: { config: TestimoniosBlockConfig }) {
  const items = Array.isArray(config.items) ? config.items : [];
  if (!items.length) return null;

  return (
    <section className="bg-cream py-16">
      <div className="max-w-5xl mx-auto px-6 sm:px-10">
        {config.titulo && (
          <h2 className="font-heading text-3xl sm:text-4xl text-burgundy mb-10 text-center">
            {config.titulo}
          </h2>
        )}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((t, i) => (
            <blockquote
              key={i}
              className="bg-white/60 rounded-2xl p-6 border border-cream"
            >
              <p className="text-ink/85 italic leading-relaxed">&ldquo;{t.texto}&rdquo;</p>
              {(t.autor || t.contexto) && (
                <footer className="mt-4 text-sm text-burgundy font-semibold">
                  — {t.autor}
                  {t.contexto && <span className="text-ink/60 font-normal"> · {t.contexto}</span>}
                </footer>
              )}
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  );
}
