import type { Metadata } from "next";
import Link from "next/link";

type Params = Promise<{ sku: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { sku } = await params;
  return {
    title: `Producto ${sku}`,
  };
}

export default async function ProductoDetallePage({ params }: { params: Params }) {
  const { sku } = await params;
  return (
    <div className="max-w-6xl mx-auto px-6 sm:px-10 py-16">
      <Link
        href="/productos"
        className="text-burgundy hover:text-gold text-sm inline-flex items-center gap-1 mb-6"
      >
        ← Volver al catálogo
      </Link>

      <div className="rounded-2xl border-2 border-dashed border-burgundy/20 p-12 text-center bg-cream/30">
        <p className="text-burgundy font-serif text-xl mb-2">
          Producto {sku}
        </p>
        <p className="text-ink/60">
          La página de producto se va a armar en la próxima fase (galería, descripción,
          variantes, agregar al carrito).
        </p>
      </div>
    </div>
  );
}
