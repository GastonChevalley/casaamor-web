import Link from "next/link";

export type CtaContactoBlockConfig = {
  titulo?: string;
  texto?: string;
  whatsappTexto?: string;
  mostrarWhatsapp?: boolean;
  mostrarInstagram?: boolean;
  mostrarEmail?: boolean;
  linkVer?: string;
  linkVerTexto?: string;
};

export function CtaContactoBlock({
  config,
  whatsapp,
  instagram,
  email,
}: {
  config: CtaContactoBlockConfig;
  whatsapp?: string;
  instagram?: string;
  email?: string;
}) {
  const showWa = config.mostrarWhatsapp !== false && whatsapp;
  const showIg = config.mostrarInstagram !== false && instagram;
  const showEmail = config.mostrarEmail !== false && email;
  const hayChannels = showWa || showIg || showEmail;

  return (
    <section className="bg-cream py-16">
      <div className="max-w-3xl mx-auto px-6 sm:px-10 text-center">
        {config.titulo && (
          <h2 className="font-heading text-3xl sm:text-4xl text-burgundy mb-3">
            {config.titulo}
          </h2>
        )}
        {config.texto && (
          <p className="text-ink/80 leading-relaxed">{config.texto}</p>
        )}

        {config.linkVer && (
          <Link
            href={config.linkVer}
            className="mt-6 inline-block text-burgundy underline underline-offset-4 decoration-gold hover:text-gold"
          >
            {config.linkVerTexto || "Saber más"}
          </Link>
        )}

        {hayChannels && (
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {showWa && (
              <a
                href={`https://wa.me/${whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-2xl border border-burgundy/15 bg-white/60 p-5 hover:bg-white transition-colors"
              >
                <h3 className="font-heading text-lg text-burgundy">WhatsApp</h3>
                <p className="text-ink/70 text-xs mt-1">
                  {config.whatsappTexto || "Te respondemos rápido"}
                </p>
              </a>
            )}
            {showIg && (
              <a
                href={`https://instagram.com/${instagram}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-2xl border border-burgundy/15 bg-white/60 p-5 hover:bg-white transition-colors"
              >
                <h3 className="font-heading text-lg text-burgundy">Instagram</h3>
                <p className="text-ink/70 text-xs mt-1">@{instagram}</p>
              </a>
            )}
            {showEmail && (
              <a
                href={`mailto:${email}`}
                className="rounded-2xl border border-burgundy/15 bg-white/60 p-5 hover:bg-white transition-colors"
              >
                <h3 className="font-heading text-lg text-burgundy">Email</h3>
                <p className="text-ink/70 text-xs mt-1 break-all">{email}</p>
              </a>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
