import Link from "next/link";
import { Hero } from "../components/Hero";

export default function Home() {
  return (
    <>
      <Hero />

      <section className="max-w-6xl mx-auto px-6 sm:px-10 py-16">
        <header className="mb-8 text-center">
          <span className="text-xs uppercase tracking-[0.3em] text-rose font-semibold">
            Destacados
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl text-burgundy mt-2">
            Lo más amado del mes
          </h2>
          <p className="mt-3 text-ink/70 max-w-md mx-auto">
            Una selección curada de piezas que se llevan todas las miradas. Próximamente acá.
          </p>
        </header>

        <div className="grid gap-6 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-2xl bg-cream/40 border border-cream aspect-square flex items-center justify-center text-cream-dark/60 font-serif text-sm"
            >
              próximamente
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/productos"
            className="inline-flex items-center gap-2 text-burgundy font-semibold hover:text-gold transition-colors"
          >
            Ver todo el catálogo →
          </Link>
        </div>
      </section>

      <section className="bg-cream py-16">
        <div className="max-w-3xl mx-auto px-6 sm:px-10 text-center">
          <span className="text-xs uppercase tracking-[0.3em] text-rose font-semibold">
            Sobre nosotras
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl text-burgundy mt-2">
            Una boutique con historia propia
          </h2>
          <p className="mt-4 text-ink/80 leading-relaxed">
            CasaAmor nació de las ganas de dos amigas de llenar casas de objetos
            con personalidad. Cada pieza la elegimos a mano, la cuidamos como si
            fuese para nuestro propio living, y la enviamos con amor.
          </p>
          <Link
            href="/sobre"
            className="mt-6 inline-block text-burgundy underline underline-offset-4 decoration-gold hover:text-gold"
          >
            Leé nuestra historia
          </Link>
        </div>
      </section>
    </>
  );
}
