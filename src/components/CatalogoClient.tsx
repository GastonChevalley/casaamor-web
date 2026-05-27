"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Check } from "lucide-react";
import type { Producto, Categoria } from "@/lib/api";
import { ProductoCard } from "./ProductoCard";

export function CatalogoClient({
  productos,
  categorias = [],
  catActualSlug = "",
  subActualSlug = "",
}: {
  productos: Producto[];
  categorias?: Categoria[];
  catActualSlug?: string;
  subActualSlug?: string;
}) {
  const router = useRouter();
  const [busqueda, setBusqueda] = useState("");
  const [soloOfertas, setSoloOfertas] = useState(false);

  const catActual = useMemo(
    () => categorias.find((c) => c.slug === catActualSlug) || null,
    [categorias, catActualSlug],
  );
  const subActual = useMemo(
    () => (catActual ? catActual.hijos.find((h) => h.slug === subActualSlug) || null : null),
    [catActual, subActualSlug],
  );

  // Set de ids de categoría que pasan el filtro actual.
  // Si hay sub: solo ese id. Si hay cat sin sub: el id del cat + ids de todos sus hijos.
  const idsValidos = useMemo<Set<string> | null>(() => {
    if (subActual) return new Set([subActual.id]);
    if (catActual) {
      const ids = new Set<string>([catActual.id]);
      catActual.hijos.forEach((h) => ids.add(h.id));
      return ids;
    }
    return null; // null = sin filtro de categoría
  }, [catActual, subActual]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return productos.filter((p) => {
      if (idsValidos && (!p.categoriaId || !idsValidos.has(p.categoriaId))) return false;
      if (soloOfertas && !(p.oferta && p.descOfertaPct > 0)) return false;
      if (q) {
        const hay =
          (p.nombre || "").toLowerCase().includes(q) ||
          (p.sku || "").toLowerCase().includes(q);
        if (!hay) return false;
      }
      return true;
    });
  }, [productos, busqueda, soloOfertas, idsValidos]);

  // Chips de subcategorías: si estamos dentro de una categoría, mostramos sus hijos.
  // Si no hay categoría seleccionada, mostramos las categorías top.
  const chips = useMemo(() => {
    if (catActual) {
      return catActual.hijos.map((h) => ({
        slug: h.slug,
        nombre: h.nombre,
        isSub: true,
      }));
    }
    return categorias.map((c) => ({
      slug: c.slug,
      nombre: c.nombre,
      isSub: false,
    }));
  }, [catActual, categorias]);

  function clickChip(slug: string, isSub: boolean) {
    if (isSub) {
      const newSub = subActualSlug === slug ? "" : slug;
      const url = newSub
        ? `/productos?cat=${encodeURIComponent(catActualSlug)}&sub=${encodeURIComponent(newSub)}`
        : `/productos?cat=${encodeURIComponent(catActualSlug)}`;
      router.push(url);
    } else {
      const newCat = catActualSlug === slug ? "" : slug;
      const url = newCat ? `/productos?cat=${encodeURIComponent(newCat)}` : "/productos";
      router.push(url);
    }
  }

  return (
    <div>
      {/* Filtros */}
      <div className="sticky top-0 z-10 bg-cream-light/95 backdrop-blur-sm py-4 -mx-6 px-6 sm:-mx-10 sm:px-10 border-b border-burgundy/10 mb-8">
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-burgundy/40 pointer-events-none" />
            <input
              type="search"
              placeholder="Buscar por nombre o SKU..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-burgundy/20 bg-white text-ink placeholder:text-ink/40 focus:outline-none focus:border-burgundy/40"
            />
          </div>
          {chips.length > 0 && (
            <div className="flex flex-wrap gap-2 items-center">
              {chips.map((chip, idx) => {
                const activo = chip.isSub
                  ? subActualSlug === chip.slug
                  : catActualSlug === chip.slug;
                return (
                  <button
                    key={(chip.isSub ? "sub-" : "top-") + chip.slug + "-" + idx}
                    onClick={() => clickChip(chip.slug, chip.isSub)}
                    className={`text-xs px-3 py-1 rounded-full border ${
                      activo
                        ? "bg-burgundy text-cream-light border-burgundy"
                        : "bg-white text-burgundy border-burgundy/20 hover:border-burgundy/40"
                    }`}
                  >
                    {chip.nombre}
                  </button>
                );
              })}
              <button
                onClick={() => setSoloOfertas((v) => !v)}
                className={`text-xs px-3 py-1 rounded-full border ml-auto inline-flex items-center gap-1 ${
                  soloOfertas
                    ? "bg-gold text-burgundy border-gold"
                    : "bg-white text-burgundy border-burgundy/20 hover:border-burgundy/40"
                }`}
              >
                {soloOfertas && <Check size={12} />} En oferta
              </button>
            </div>
          )}
          <p className="text-xs text-ink/50">
            {filtrados.length} de {productos.length} productos
          </p>
        </div>
      </div>

      {/* Grid */}
      {filtrados.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-burgundy/20 p-12 text-center bg-cream/30">
          <p className="text-burgundy font-heading text-xl mb-2">Sin resultados</p>
          <p className="text-ink/60">Probá con otra búsqueda o quitá los filtros.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {filtrados.map((p) => (
            <ProductoCard key={p.sku} producto={p} />
          ))}
        </div>
      )}
    </div>
  );
}
