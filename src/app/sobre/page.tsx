import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sobre nosotras",
};

export default function SobrePage() {
  return (
    <article className="max-w-3xl mx-auto px-6 sm:px-10 py-16">
      <header className="mb-10">
        <span className="text-xs uppercase tracking-[0.3em] text-rose font-semibold">
          Sobre nosotras
        </span>
        <h1 className="font-serif text-4xl sm:text-5xl text-burgundy mt-2">
          La historia de CasaAmor
        </h1>
      </header>

      <div className="prose prose-stone max-w-none space-y-5 text-ink/85 leading-relaxed">
        <p>
          CasaAmor empezó como una conversación entre dos amigas: ¿por qué tan
          poca decoración con personalidad y a buen precio? Ese fue el chispazo.
        </p>
        <p>
          Hoy seleccionamos cada producto a mano. Tenemos proveedores de confianza,
          buscamos materiales reales y diseños que duren. Nada es masivo, nada es
          al azar.
        </p>
        <p>
          Si elegís CasaAmor, no estás comprando un objeto — estás invitando una
          historia a tu casa.
        </p>
        <p className="italic text-burgundy">
          — Mora y Lara
        </p>
      </div>
    </article>
  );
}
