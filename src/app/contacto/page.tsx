import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contacto",
};

export default function ContactoPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 sm:px-10 py-16">
      <header className="mb-10">
        <span className="text-xs uppercase tracking-[0.3em] text-rose font-semibold">
          Contacto
        </span>
        <h1 className="font-serif text-4xl sm:text-5xl text-burgundy mt-2">
          Hablemos
        </h1>
      </header>

      <div className="grid gap-6 sm:grid-cols-2">
        <a
          href="https://wa.me/5491100000000"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-2xl border border-burgundy/15 bg-cream/30 p-6 hover:bg-cream/60 transition-colors"
        >
          <h2 className="font-serif text-xl text-burgundy mb-1">WhatsApp</h2>
          <p className="text-ink/70 text-sm">
            La forma más rápida. Te respondemos en horario comercial.
          </p>
        </a>

        <a
          href="https://instagram.com/casaamor"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-2xl border border-burgundy/15 bg-cream/30 p-6 hover:bg-cream/60 transition-colors"
        >
          <h2 className="font-serif text-xl text-burgundy mb-1">Instagram</h2>
          <p className="text-ink/70 text-sm">
            Mirá novedades, productos nuevos y mandanos un DM.
          </p>
        </a>

        <a
          href="mailto:hola@casaamor.com.ar"
          className="rounded-2xl border border-burgundy/15 bg-cream/30 p-6 hover:bg-cream/60 transition-colors sm:col-span-2"
        >
          <h2 className="font-serif text-xl text-burgundy mb-1">Email</h2>
          <p className="text-ink/70 text-sm">hola@casaamor.com.ar</p>
        </a>
      </div>
    </div>
  );
}
