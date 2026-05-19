import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Catálogo",
  description: "Explorá todos los productos de CasaAmor — decoración con amor.",
};

export default function ProductosPage() {
  return (
    <div className="max-w-6xl mx-auto px-6 sm:px-10 py-16">
      <header className="mb-10">
        <span className="text-xs uppercase tracking-[0.3em] text-rose font-semibold">
          Catálogo
        </span>
        <h1 className="font-heading text-4xl sm:text-5xl text-burgundy mt-2">
          Nuestros productos
        </h1>
        <p className="mt-4 text-ink/70 max-w-2xl">
          Próximamente vas a poder ver acá nuestra colección completa, filtrar por
          categoría y agregar al carrito.
        </p>
      </header>

      <div className="rounded-2xl border-2 border-dashed border-burgundy/20 p-12 text-center bg-cream/30">
        <p className="text-burgundy font-heading text-xl mb-2">En construcción 🌸</p>
        <p className="text-ink/60">
          El catálogo se va a conectar con el sistema interno de CasaAmor en la próxima fase.
        </p>
      </div>
    </div>
  );
}
