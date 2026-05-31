import type { Metadata } from "next";
import { obtenerCatalogo, obtenerCategorias, obtenerConfigWeb } from "@/lib/api";
import { CatalogoClient } from "@/components/CatalogoClient";

type SearchParams = Promise<{ cat?: string; sub?: string }>;

function _matchCat<T extends { slug: string }>(slug: string | undefined, lista: T[]): T | null {
  if (!slug) return null;
  return lista.find((c) => c.slug === slug) || null;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const { cat, sub } = await searchParams;
  const categorias = await obtenerCategorias();
  const catActual = _matchCat(cat, categorias);
  const subActual = catActual ? _matchCat(sub, catActual.hijos) : null;

  if (subActual && catActual) {
    return {
      title: `${subActual.nombre} · ${catActual.nombre}`,
      description: subActual.descripcion || `Productos de ${subActual.nombre} en CasaAmor.`,
    };
  }
  if (catActual) {
    return {
      title: catActual.nombre,
      description: catActual.descripcion || `Productos de ${catActual.nombre} en CasaAmor.`,
    };
  }
  return {
    title: "Catálogo",
    description: "Explorá todos los productos de CasaAmor — decoración con amor.",
  };
}

export default async function ProductosPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { cat, sub } = await searchParams;
  const [productos, categorias, configWeb] = await Promise.all([
    obtenerCatalogo(),
    obtenerCategorias(),
    obtenerConfigWeb(),
  ]);
  const cardEstilo = configWeb.card_estilo || "clasico";

  const catActual = _matchCat(cat, categorias);
  const subActual = catActual ? _matchCat(sub, catActual.hijos) : null;

  // Breadcrumb + título dinámico
  const titulo = subActual?.nombre || catActual?.nombre || "Nuestros productos";
  const subtitulo =
    subActual?.descripcion ||
    catActual?.descripcion ||
    "Piezas únicas, elegidas a mano. Mirá la colección completa y consultá por WhatsApp para reservar.";

  return (
    <div className="max-w-6xl mx-auto px-6 sm:px-10 py-8 sm:py-12">
      <nav aria-label="Breadcrumb" className="text-xs text-ink/50 mb-2">
        <a href="/productos" className="hover:text-burgundy">Catálogo</a>
        {catActual && (
          <>
            {" › "}
            <a
              href={`/productos?cat=${encodeURIComponent(catActual.slug)}`}
              className="hover:text-burgundy"
            >
              {catActual.nombre}
            </a>
          </>
        )}
        {subActual && (
          <>
            {" › "}
            <span className="text-burgundy">{subActual.nombre}</span>
          </>
        )}
      </nav>

      <header className="mb-8">
        <span className="text-xs uppercase tracking-[0.3em] text-rose font-semibold">
          Catálogo
        </span>
        <h1 className="font-heading text-4xl sm:text-5xl text-burgundy mt-2">
          {titulo}
        </h1>
        <p className="mt-4 text-ink/70 max-w-2xl">{subtitulo}</p>
      </header>

      {productos.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-burgundy/20 p-12 text-center bg-cream/30">
          <p className="text-burgundy font-heading text-xl mb-2">
            Catálogo en preparación 🌸
          </p>
          <p className="text-ink/60">
            Estamos cargando los productos. Volvé en unos minutos.
          </p>
        </div>
      ) : (
        <CatalogoClient
          productos={productos}
          categorias={categorias}
          catActualSlug={catActual?.slug || ""}
          subActualSlug={subActual?.slug || ""}
          cardEstilo={cardEstilo}
        />
      )}
    </div>
  );
}
