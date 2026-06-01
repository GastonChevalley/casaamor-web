"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, X } from "lucide-react";
import type { Producto, Categoria } from "@/lib/api";
import { ProductoCard } from "./ProductoCard";

export function CatalogoClient({
  productos,
  categorias = [],
  catActualSlug = "",
  subActualSlug = "",
  cardEstilo,
}: {
  productos: Producto[];
  categorias?: Categoria[];
  catActualSlug?: string;
  subActualSlug?: string;
  cardEstilo?: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qInicial = searchParams?.get("q") || "";
  const [busqueda, setBusqueda] = useState(qInicial);
  const [soloOfertas, setSoloOfertas] = useState(false);

  // Sincronizar cambios externos del query string (ej: usuario hace otra búsqueda
  // desde el header estando ya en /productos).
  useEffect(() => {
    const next = searchParams?.get("q") || "";
    setBusqueda(next);
  }, [searchParams]);

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
      if (idsValidos) {
        // Filtro OR: el producto pasa si su categoría principal O alguna de las
        // extras coincide con el filtro. Equivalente a Shopify/TN/WooCommerce.
        const todasLasCats: string[] = [];
        if (p.categoriaId) todasLasCats.push(p.categoriaId);
        if (p.categoriaIdsExtra && p.categoriaIdsExtra.length) {
          p.categoriaIdsExtra.forEach((id) => todasLasCats.push(id));
        }
        if (!todasLasCats.some((id) => idsValidos.has(id))) return false;
      }
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
      <div className="sticky top-0 z-10 bg-cream-light/95 backdrop-blur-sm py-4 -mx-6 px-6 sm:-mx-10 sm:px-10 border-b border-burgundy/10 mb-6 sm:mb-8">
        <div className="flex flex-col gap-3">
          {/* Chip "Buscando" si hay query activa (proviene del header) */}
          {busqueda.trim() && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-ink/60">Buscando:</span>
              <button
                type="button"
                onClick={() => {
                  setBusqueda("");
                  if (typeof window !== "undefined") {
                    const params = new URLSearchParams(window.location.search);
                    params.delete("q");
                    const next = params.toString();
                    window.history.replaceState(
                      null,
                      "",
                      window.location.pathname + (next ? `?${next}` : ""),
                    );
                  }
                }}
                className="inline-flex items-center gap-1.5 bg-burgundy text-cream-light text-xs px-3 py-1 rounded-full hover:bg-burgundy-dark transition-colors"
                aria-label={`Quitar filtro de búsqueda "${busqueda}"`}
              >
                <span>&quot;{busqueda.trim()}&quot;</span>
                <X size={12} />
              </button>
            </div>
          )}
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
          {filtrados.map((p) => (
            <ProductoCard key={p.sku} producto={p} estilo={cardEstilo} />
          ))}
        </div>
      )}
    </div>
  );
}
