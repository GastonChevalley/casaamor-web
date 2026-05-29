"use client";

import { ArrowRight } from "lucide-react";
import { cloudinaryUrl } from "@/lib/img";
import type { ProductoLite } from "@/lib/clientCatalogo";

function fmtMonto(n: number): string {
  return "$" + Math.round(Number(n) || 0).toLocaleString("es-AR");
}

function inicial(nombre: string): string {
  const limpio = (nombre || "?").trim().toUpperCase();
  return limpio.charAt(0) || "?";
}

/**
 * Dropdown que aparece debajo del input de búsqueda con resultados en vivo.
 * Se posiciona absolute en desktop (dentro de HeaderSearch) o inline en mobile
 * (dentro del MobileNav overlay) según la prop `inline`.
 */
export function SearchDropdown({
  matches,
  total,
  q,
  loading,
  activeIdx,
  inline = false,
  onSelect,
  onSeeAll,
}: {
  matches: ProductoLite[];
  total: number;
  q: string;
  loading: boolean;
  activeIdx: number;
  inline?: boolean;
  onSelect: (sku: string) => void;
  onSeeAll: () => void;
}) {
  const container = inline
    ? "relative bg-cream-light rounded-xl ring-1 ring-burgundy/10 mt-2 overflow-hidden"
    : "absolute top-full mt-2 left-0 right-0 bg-cream-light rounded-xl shadow-xl ring-1 ring-burgundy/10 overflow-hidden z-30";

  if (loading) {
    return (
      <div className={container}>
        <div className="p-2 space-y-1" role="status" aria-busy="true">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 p-2 animate-pulse">
              <div className="w-14 h-14 rounded-lg bg-burgundy/10 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-burgundy/10 rounded w-3/4" />
                <div className="h-3 bg-burgundy/10 rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className={container}>
        <div className="p-4 text-center text-sm text-ink/60">
          Sin resultados para <span className="font-semibold text-burgundy">&quot;{q}&quot;</span>.
          <br />
          <button
            type="button"
            onClick={onSeeAll}
            className="mt-2 text-burgundy hover:text-gold underline text-sm"
          >
            Ver todo el catálogo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={container} role="listbox" aria-label="Resultados de búsqueda">
      <div className="px-3 py-2 border-b border-burgundy/5 bg-cream/40">
        <p className="text-[10px] uppercase tracking-[0.15em] text-ink/40">
          Resultados
        </p>
      </div>
      <ul className="max-h-[60vh] overflow-y-auto divide-y divide-burgundy/5">
        {matches.map((p, idx) => {
          const enOferta = !!p.oferta && Number(p.descOfertaPct) > 0;
          const precioFinal = enOferta
            ? Math.round(p.precioEft * (1 - p.descOfertaPct / 100))
            : p.precioEft;
          const activo = idx === activeIdx;
          return (
            <li key={p.sku} id={`search-opt-${idx}`} role="option" aria-selected={activo}>
              <button
                type="button"
                onClick={() => onSelect(p.sku)}
                className={`w-full flex items-center gap-3 p-3 text-left transition-colors ${
                  activo ? "bg-cream" : "hover:bg-cream/60"
                }`}
              >
                <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-cream flex items-center justify-center shrink-0">
                  {p.fotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={cloudinaryUrl(p.fotoUrl, "thumb")}
                      alt={p.nombre}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="font-heading text-2xl text-burgundy/30 select-none">
                      {inicial(p.nombre)}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-ink/40 truncate">
                    {p.proveedor}
                  </p>
                  <p className="font-heading text-sm text-burgundy line-clamp-2 leading-snug">
                    {p.nombre}
                  </p>
                  <div className="flex items-baseline gap-2 mt-1">
                    {enOferta && (
                      <span className="text-[11px] text-ink/40 line-through">
                        {fmtMonto(p.precioEft)}
                      </span>
                    )}
                    <span className="text-sm font-semibold text-burgundy">
                      {fmtMonto(precioFinal)}
                    </span>
                    {enOferta && (
                      <span className="text-[10px] bg-gold text-burgundy font-semibold px-1.5 py-0.5 rounded">
                        −{p.descOfertaPct}%
                      </span>
                    )}
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={onSeeAll}
        className="w-full bg-burgundy hover:bg-burgundy-dark text-cream-light text-sm font-semibold py-3 px-4 transition-colors flex items-center justify-center gap-2"
      >
        Ver todos los resultados ({total}) <ArrowRight size={16} />
      </button>
    </div>
  );
}
