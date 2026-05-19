import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  obtenerPagina,
  obtenerPaginas,
  obtenerConfigWeb,
} from "../../lib/api";
import { BlockRenderer } from "../../components/BlockRenderer";

type Params = Promise<{ slug?: string[] }>;

/** Convierte el [...slug] de Next ("[]" | ["sobre"] | ["foo", "bar"]) en un slug "/" o "/sobre" */
function paramsASlug(slugArr?: string[]): string {
  if (!slugArr || slugArr.length === 0) return "/";
  return "/" + slugArr.join("/");
}

export async function generateStaticParams() {
  const paginas = await obtenerPaginas();
  return paginas.map(p => {
    const slug = p.slug === "/" ? [] : p.slug.replace(/^\//, "").split("/");
    return { slug };
  });
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const pagina = await obtenerPagina(paramsASlug(slug));
  if (!pagina) {
    return { title: "No encontrada" };
  }
  return {
    title: pagina.title,
    description: pagina.meta || undefined,
  };
}

export default async function PaginaDinamica({ params }: { params: Params }) {
  const { slug } = await params;
  const slugStr = paramsASlug(slug);

  const [pagina, config] = await Promise.all([
    obtenerPagina(slugStr),
    obtenerConfigWeb(),
  ]);

  if (!pagina) {
    notFound();
  }

  return (
    <>
      {pagina.blocks.map((b, i) => (
        <BlockRenderer key={i} block={b} config={config} />
      ))}
    </>
  );
}
