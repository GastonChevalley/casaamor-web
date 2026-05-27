"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Producto } from "@/lib/api";
import { cloudinaryUrl } from "@/lib/img";

function fmtMonto(n: number): string {
  return "$" + Math.round(Number(n) || 0).toLocaleString("es-AR");
}

function inicial(nombre: string): string {
  const limpio = (nombre || "?").trim().toUpperCase();
  return limpio.charAt(0) || "?";
}

export function ProductoCard({ producto }: { producto: Producto }) {
  const enOferta = !!producto.oferta && Number(producto.descOfertaPct) > 0;
  const precioConOferta = enOferta
    ? Math.round(producto.precioEft * (1 - producto.descOfertaPct / 100))
    : producto.precioEft;

  // Lista de fotos, con fallback a fotoUrl si fotos no llegó (backward-compat).
  const fotos = (producto.fotos && producto.fotos.length > 0)
    ? producto.fotos
    : (producto.fotoUrl ? [producto.fotoUrl] : []);

  // Hover cycle: cuando hay >= 2 fotos, ciclar entre ellas cada 1.2s mientras
  // se hace hover. Al sacar el mouse, vuelve a la primera con fade.
  const [idx, setIdx] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function onEnter() {
    if (fotos.length < 2) return;
    intervalRef.current = setInterval(() => {
      setIdx((i) => (i + 1) % fotos.length);
    }, 1200);
  }
  function onLeave() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIdx(0);
  }
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <Link
      href={`/productos/${encodeURIComponent(producto.sku)}`}
      className="group block rounded-2xl overflow-hidden bg-cream-light border border-burgundy/10 hover:border-burgundy/30 transition-colors"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <div className="relative aspect-square bg-cream flex items-center justify-center overflow-hidden">
        {fotos.length > 0 ? (
          fotos.map((u, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={u + "-" + i}
              src={cloudinaryUrl(u, "card")}
              alt={producto.nombre}
              loading="lazy"
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
                i === idx ? "opacity-100" : "opacity-0"
              }`}
            />
          ))
        ) : (
          <span className="font-heading text-7xl text-burgundy/15 select-none">
            {inicial(producto.nombre)}
          </span>
        )}
        {enOferta && (
          <span className="absolute top-2 left-2 bg-gold text-burgundy text-xs font-semibold px-2 py-1 rounded z-10">
            −{producto.descOfertaPct}%
          </span>
        )}
        {/* Indicador discreto de cantidad de fotos */}
        {fotos.length > 1 && (
          <div className="absolute bottom-2 right-2 flex gap-1 z-10">
            {fotos.map((_, i) => (
              <span
                key={i}
                className={`block w-1.5 h-1.5 rounded-full transition-colors ${
                  i === idx ? "bg-cream-light shadow" : "bg-cream-light/50"
                }`}
              />
            ))}
          </div>
        )}
      </div>
      <div className="p-3">
        <p className="text-xs uppercase tracking-wider text-ink/50 mb-1">
          {producto.proveedor}
        </p>
        <h3 className="font-heading text-burgundy text-base line-clamp-2 min-h-[2.5em] leading-tight">
          {producto.nombre}
        </h3>
        {/* Chip de variantes (grupo con N > 1) */}
        {producto.variantesCount && producto.variantesCount > 1 && (
          <p className="mt-1 text-xs text-rose font-medium">
            {producto.variantesCount} {producto.varianteTipo === "talle" ? "talles" : producto.varianteTipo === "material" ? "materiales" : "colores"}
          </p>
        )}
        <div className="mt-2 flex items-baseline gap-2 flex-wrap">
          {enOferta && (
            <span className="text-xs text-ink/40 line-through">
              {fmtMonto(producto.precioEft)}
            </span>
          )}
          {producto.precioEftMin != null && producto.precioEftMax != null && producto.precioEftMin !== producto.precioEftMax ? (
            <span className="text-lg font-semibold text-burgundy">
              <span className="text-xs text-ink/60 font-normal">Desde </span>
              {fmtMonto(producto.precioEftMin)}
            </span>
          ) : (
            <span className="text-lg font-semibold text-burgundy">
              {fmtMonto(precioConOferta)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
