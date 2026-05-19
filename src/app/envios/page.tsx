import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Envíos",
};

export default function EnviosPage() {
  return (
    <article className="max-w-3xl mx-auto px-6 sm:px-10 py-16">
      <header className="mb-10">
        <span className="text-xs uppercase tracking-[0.3em] text-rose font-semibold">
          Envíos
        </span>
        <h1 className="font-serif text-4xl sm:text-5xl text-burgundy mt-2">
          Cómo te llega
        </h1>
      </header>

      <div className="space-y-6 text-ink/85 leading-relaxed">
        <section>
          <h2 className="font-serif text-2xl text-burgundy mb-2">A todo el país</h2>
          <p>
            Hacemos envíos a todo Argentina con Andreani, Correo Argentino o el método
            que prefieras. Te confirmamos el costo exacto al cerrar la compra.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-2xl text-burgundy mb-2">Retiro en local</h2>
          <p>
            ¿Estás cerca? Coordinamos retiro presencial sin costo. Avisanos por
            WhatsApp y te damos la dirección.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-2xl text-burgundy mb-2">Tiempos</h2>
          <p>
            CABA y GBA: 2-4 días hábiles. Interior: 4-7 días hábiles desde el pago acreditado.
          </p>
        </section>

        <section className="rounded-2xl bg-cream/40 p-5 border border-cream">
          <p className="text-sm text-ink/70">
            ¿Dudas? Escribinos por <a href="https://wa.me/5491100000000" className="text-burgundy underline decoration-gold">WhatsApp</a> y
            te orientamos.
          </p>
        </section>
      </div>
    </article>
  );
}
