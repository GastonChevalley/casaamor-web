import Link from "next/link";
import { safeUrl, safeHandle, safePhone } from "../../lib/sanitize";

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
  const waSafe = safePhone(whatsapp);
  const igSafe = safeHandle(instagram);
  const emailSafe =
    email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : "";
  const verHref = safeUrl(config.linkVer);

  const showWa = config.mostrarWhatsapp !== false && waSafe;
  const showIg = config.mostrarInstagram !== false && igSafe;
  const showEmail = config.mostrarEmail !== false && emailSafe;
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

        {verHref && (
          <Link
            href={verHref}
            className="mt-6 inline-block text-burgundy underline underline-offset-4 decoration-gold hover:text-gold"
          >
            {config.linkVerTexto || "Saber más"}
          </Link>
        )}

        {hayChannels && (
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {showWa && (
              <a
                href={`https://wa.me/${waSafe}`}
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
                href={`https://instagram.com/${igSafe}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-2xl border border-burgundy/15 bg-white/60 p-5 hover:bg-white transition-colors"
              >
                <h3 className="font-heading text-lg text-burgundy">Instagram</h3>
                <p className="text-ink/70 text-xs mt-1">@{igSafe}</p>
              </a>
            )}
            {showEmail && (
              <a
                href={`mailto:${emailSafe}`}
                className="rounded-2xl border border-burgundy/15 bg-white/60 p-5 hover:bg-white transition-colors"
              >
                <h3 className="font-heading text-lg text-burgundy">Email</h3>
                <p className="text-ink/70 text-xs mt-1 break-all">{emailSafe}</p>
              </a>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
