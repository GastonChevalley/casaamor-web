import type { Producto } from "@/lib/api";
import { ProductoCard } from "./ProductoCard";

/**
 * Sección "También te puede interesar" al pie del detalle del producto.
 * Render only si hay al menos 1 relacionado (limpio: no muestra placeholder vacío).
 * Reusa ProductoCard con el cardEstilo global → consistencia visual con el catálogo.
 *
 * Server Component (cero JS en cliente).
 */
export function RelacionadosSection({
  productos,
  cardEstilo,
}: {
  productos: Producto[];
  cardEstilo?: string | null;
}) {
  if (!productos || productos.length === 0) return null;
  return (
    <section className="max-w-6xl mx-auto px-6 sm:px-10 pb-16 pt-4">
      <h2 className="font-heading text-2xl sm:text-3xl text-burgundy text-center mb-8">
        También te puede interesar
      </h2>
      <div className="grid items-stretch grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
        {productos.slice(0, 4).map((p) => (
          <ProductoCard key={p.sku} producto={p} estilo={cardEstilo} />
        ))}
      </div>
    </section>
  );
}
