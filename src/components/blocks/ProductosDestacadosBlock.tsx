import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { obtenerCatalogo, type Producto } from "../../lib/api";
import { safeUrl } from "../../lib/sanitize";

export type ProductosDestacadosBlockConfig = {
  titulo?: string;
  subtitulo?: string;
  modo?: "destacados" | "skus" | "categoria";
  skus?: string[];
  categoria?: string;
  columnas?: 2 | 3 | 4;
  limite?: number;
};

function fmt(n: number): string {
  return "$" + Math.round(n).toLocaleString("es-AR");
}

export async function ProductosDestacadosBlock({
  config,
}: {
  config: ProductosDestacadosBlockConfig;
}) {
  const todos = await obtenerCatalogo();
  const cols = config.columnas || 3;
  const limite = config.limite || cols * 2;
  const modo = config.modo || "destacados";

  let productos: Producto[] = [];
  if (modo === "skus" && Array.isArray(config.skus)) {
    const set = new Set(config.skus.map(s => String(s).toUpperCase()));
    productos = todos.filter(p => set.has(String(p.sku).toUpperCase()));
  } else if (modo === "categoria" && config.categoria) {
    productos = todos.filter(p => p.categoria === config.categoria);
  } else {
    // destacados (campo destacado=true en el producto)
    productos = todos.filter(p => p.destacado === true);
    // Si no hay destacados marcados, fallback a primeros con stock
    if (!productos.length) {
      productos = todos.filter(p => p.stock > 0);
    }
  }
  productos = productos.slice(0, limite);

  const gridClass = {
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-3",
    4: "sm:grid-cols-2 lg:grid-cols-4",
  }[cols];

  return (
    <section className="max-w-6xl mx-auto px-6 sm:px-10 py-16">
      <header className="mb-8 text-center">
        {config.subtitulo && (
          <span className="text-xs uppercase tracking-[0.3em] text-rose font-semibold">
            {config.subtitulo}
          </span>
        )}
        {config.titulo && (
          <h2 className="font-heading text-3xl sm:text-4xl text-burgundy mt-2">
            {config.titulo}
          </h2>
        )}
      </header>

      {productos.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-burgundy/20 p-10 text-center bg-cream/30 text-ink/60">
          No hay productos para mostrar todavía.
        </div>
      ) : (
        <div className={`grid gap-6 grid-cols-1 ${gridClass}`}>
          {productos.map(p => (
            <Link
              key={p.sku}
              href={`/productos/${p.sku}`}
              className="group block rounded-2xl bg-white border border-cream hover:shadow-lg transition-shadow overflow-hidden"
            >
              <div className="aspect-square bg-cream/40 relative overflow-hidden">
                {(() => {
                  const fotoSafe = safeUrl(p.fotoUrl);
                  if (fotoSafe) {
                    return (
                      <Image
                        src={fotoSafe}
                        alt={p.nombre}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 33vw, 25vw"
                        className="object-cover group-hover:scale-105 transition-transform"
                      />
                    );
                  }
                  return (
                    <div className="absolute inset-0 flex items-center justify-center text-cream font-heading text-3xl">
                      {p.nombre.charAt(0)}
                    </div>
                  );
                })()}
                {p.oferta && p.descOfertaPct > 0 && (
                  <span className="absolute top-3 left-3 bg-gold text-burgundy text-xs font-bold px-2 py-1 rounded">
                    −{p.descOfertaPct}%
                  </span>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-heading text-burgundy text-base leading-tight group-hover:text-gold transition-colors">
                  {p.nombre}
                </h3>
                <p className="text-ink/60 text-xs mt-1">{p.proveedor}</p>
                <p className="text-burgundy font-semibold mt-2">{fmt(p.precioEft)}</p>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-10 text-center">
        <Link
          href="/productos"
          className="inline-flex items-center gap-2 text-burgundy font-semibold hover:text-gold transition-colors"
        >
          Ver todo el catálogo <ArrowRight size={18} />
        </Link>
      </div>
    </section>
  );
}
