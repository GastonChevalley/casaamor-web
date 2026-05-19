import Link from "next/link";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-rose text-cream-light">
      <div className="max-w-6xl mx-auto px-6 sm:px-10 py-20 sm:py-32 grid gap-10 sm:grid-cols-2 sm:items-center">
        <div className="space-y-5 sm:space-y-7">
          <span className="inline-block text-xs uppercase tracking-[0.3em] opacity-80">
            Boutique de decoración
          </span>
          <h1 className="font-serif text-5xl sm:text-6xl font-bold leading-[1.05] text-cream-light">
            Decoración con
            <span className="block text-gold">amor</span>
          </h1>
          <p className="max-w-md text-base sm:text-lg opacity-90 leading-relaxed">
            Piezas únicas, hechas con cariño y elegidas con criterio. Para tu casa,
            para regalar, para sentir.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/productos"
              className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-gold text-burgundy font-semibold hover:bg-cream-light transition-colors shadow-md"
            >
              Ver catálogo
            </Link>
            <a
              href="https://wa.me/5491100000000"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center px-6 py-3 rounded-full border border-cream-light/40 hover:bg-cream-light/10 transition-colors"
            >
              Consultar por WhatsApp
            </a>
          </div>
        </div>

        <div className="hidden sm:flex justify-center">
          <div className="relative size-72 rounded-full bg-burgundy/30 backdrop-blur-sm flex items-center justify-center shadow-2xl">
            <div className="absolute inset-3 rounded-full bg-rose/40 flex items-center justify-center">
              <span className="font-serif text-7xl font-bold text-cream-light/95">
                CASA
                <br />
                <span className="text-gold">AMOR</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
