import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { obtenerCatalogo, obtenerConfigWeb, type Producto } from "../../lib/api";
import { ProductoCard } from "../ProductoCard";

export type ProductosDestacadosBlockConfig = {
  titulo?: string;
  subtitulo?: string;
  modo?: "destacados" | "skus" | "categoria";
  skus?: string[];
  categoria?: string;
  columnas?: 2 | 3 | 4;
  limite?: number;
};

export async function ProductosDestacadosBlock({
  config,
}: {
  config: ProductosDestacadosBlockConfig;
}) {
  const [todos, configWeb] = await Promise.all([
    obtenerCatalogo(),
    obtenerConfigWeb(),
  ]);
  // Prioridad de columnas: config del bloque (JSON) > key global > default 3.
  const colsGlobal = Number(configWeb.card_columnas_home) || 0;
  const cols = (config.columnas || colsGlobal || 3) as 2 | 3 | 4;
  const limite = config.limite || cols * 2;
  const modo = config.modo || "destacados";
  // Estilo del home: key propia con fallback a la del catálogo (backward compat).
  const cardEstilo = configWeb.card_estilo_home || configWeb.card_estilo || "clasico";

  let productos: Producto[] = [];
  if (modo === "skus" && Array.isArray(config.skus)) {
    const set = new Set(config.skus.map((s) => String(s).toUpperCase()));
    productos = todos.filter((p) => set.has(String(p.sku).toUpperCase()));
  } else if (modo === "categoria" && config.categoria) {
    productos = todos.filter((p) => p.categoria === config.categoria);
  } else {
    // destacados (campo destacado=true en el producto)
    productos = todos.filter((p) => p.destacado === true);
    // Si no hay destacados marcados, fallback a primeros con stock
    if (!productos.length) {
      productos = todos.filter((p) => p.stock > 0);
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
        <div className={`grid gap-3 sm:gap-6 grid-cols-2 ${gridClass}`}>
          {productos.map((p) => (
            <ProductoCard key={p.sku} producto={p} estilo={cardEstilo} />
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
