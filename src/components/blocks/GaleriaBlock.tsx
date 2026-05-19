import Image from "next/image";

export type GaleriaBlockConfig = {
  titulo?: string;
  fotos?: Array<{ url: string; alt?: string; caption?: string }>;
  columnas?: 2 | 3 | 4;
};

export function GaleriaBlock({ config }: { config: GaleriaBlockConfig }) {
  const fotos = Array.isArray(config.fotos) ? config.fotos : [];
  const cols = config.columnas || 3;
  const gridClass = {
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-3",
    4: "sm:grid-cols-2 lg:grid-cols-4",
  }[cols];

  if (!fotos.length) {
    return (
      <section className="max-w-6xl mx-auto px-6 sm:px-10 py-16">
        {config.titulo && (
          <h2 className="font-heading text-3xl text-burgundy mb-6">{config.titulo}</h2>
        )}
        <div className="rounded-2xl border-2 border-dashed border-burgundy/20 p-12 text-center bg-cream/30 text-ink/60">
          Galería vacía (agregá fotos desde el admin)
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-6xl mx-auto px-6 sm:px-10 py-16">
      {config.titulo && (
        <h2 className="font-heading text-3xl sm:text-4xl text-burgundy mb-8 text-center">
          {config.titulo}
        </h2>
      )}
      <div className={`grid gap-4 grid-cols-1 ${gridClass}`}>
        {fotos.map((f, i) => (
          <figure
            key={`${f.url}-${i}`}
            className="rounded-xl overflow-hidden bg-cream/30 aspect-square relative"
          >
            <Image
              src={f.url}
              alt={f.alt || ""}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 33vw"
            />
            {f.caption && (
              <figcaption className="absolute inset-x-0 bottom-0 bg-burgundy/70 text-cream-light text-xs px-3 py-2">
                {f.caption}
              </figcaption>
            )}
          </figure>
        ))}
      </div>
    </section>
  );
}
