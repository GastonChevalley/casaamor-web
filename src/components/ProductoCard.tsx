"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ShoppingBag, Check } from "lucide-react";
import type { Producto } from "@/lib/api";
import { cloudinaryUrl } from "@/lib/img";
import { useCart } from "@/contexts/CartContext";

function fmtMonto(n: number): string {
  return "$" + Math.round(Number(n) || 0).toLocaleString("es-AR");
}

function inicial(nombre: string): string {
  const limpio = (nombre || "?").trim().toUpperCase();
  return limpio.charAt(0) || "?";
}

export type CardEstilo = "minimal" | "clasico" | "soft";

// 3 presets editables desde el PWA (ConfigWeb.card_estilo).
// Definidos como combinaciones probadas en lugar de exponer
// border-radius / shadow / bg individualmente (Addendum 69).
const CARD_STYLES: Record<CardEstilo, { container: string; image: string }> = {
  minimal: {
    container:
      "rounded-xl overflow-hidden bg-white border border-cream hover:shadow-md transition-shadow",
    image: "bg-cream/40",
  },
  clasico: {
    container:
      "rounded-3xl overflow-hidden bg-cream-light shadow-sm hover:shadow-md transition-shadow ring-1 ring-burgundy/5",
    image: "bg-cream",
  },
  soft: {
    container:
      "rounded-[2rem] overflow-hidden bg-cream-light/60 shadow-md hover:shadow-xl transition-shadow border border-cream/40",
    image: "bg-cream/60",
  },
};

function resolveEstilo(estilo: string | undefined | null): CardEstilo {
  if (estilo === "minimal" || estilo === "soft") return estilo;
  return "clasico";
}

export function ProductoCard({
  producto,
  estilo,
}: {
  producto: Producto;
  estilo?: string | null;
}) {
  const styleKey = resolveEstilo(estilo);
  const cardClasses = CARD_STYLES[styleKey];
  const enOferta = !!producto.oferta && Number(producto.descOfertaPct) > 0;
  const precioEftConOferta = enOferta
    ? Math.round(producto.precioEft * (1 - producto.descOfertaPct / 100))
    : producto.precioEft;
  const precioTnConOferta = enOferta
    ? Math.round(producto.precioTn * (1 - producto.descOfertaPct / 100))
    : producto.precioTn;
  const cuotaMonto = Math.round(precioTnConOferta / 3);

  // Producto grupo con N>1 variantes: la card linkea al detalle, no permite
  // quick-add (decidir variante desde el grid es alta fricción → Baymard).
  const tieneVariantes = !!(producto.variantesCount && producto.variantesCount > 1);

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

  // Quick-add
  const { agregar } = useCart();
  const [agregado, setAgregado] = useState(false);
  const agregadoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (agregadoTimerRef.current) clearTimeout(agregadoTimerRef.current);
    };
  }, []);

  function onAgregar(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (tieneVariantes) return; // defensivo, el botón no debería estar visible
    agregar({
      sku: producto.sku,
      nombre: producto.nombre,
      variante: "",
      precioUnit: precioEftConOferta,
      precioUnitTn: precioTnConOferta,
      fotoUrl: fotos[0],
      slug: producto.sku,
    });
    setAgregado(true);
    if (agregadoTimerRef.current) clearTimeout(agregadoTimerRef.current);
    agregadoTimerRef.current = setTimeout(() => setAgregado(false), 1500);
  }

  const mostrarQuickAdd = !tieneVariantes && producto.stock > 0;

  // ESTRATEGIA DE ALINEACIÓN (decisión Plan agent):
  // - Card root: h-full flex flex-col → ocupa todo el alto que le da el grid.
  // - Foto: aspect-square arriba.
  // - Bloque info: flex-1 flex flex-col → toma el alto sobrante.
  //   · Nombre: min-h-[2.75em] (2 líneas reservadas).
  //   · Chip variantes: siempre renderizado, invisible si no aplica.
  //   · Bloque precios: min-h fijo con 4 líneas (tachado oferta + 3 precios) —
  //     SIEMPRE las 3 líneas de precio se muestran (efectivo / tarjeta / cuotas).
  //     Cuando NO hay diferencia, la línea TN repite el monto EFT (mantiene
  //     simetría visual entre cards). Cuando hay variantes, mostramos "Desde $X"
  //     en línea 1 y las otras quedan invisible para preservar alto.
  //   · Botón: mt-auto → empujado al fondo. Si no hay quick-add, spacer con
  //     misma altura para alinear con cards vecinas que sí tienen botón.

  return (
    <Link
      href={`/productos/${encodeURIComponent(producto.sku)}`}
      className={`group block h-full flex flex-col ${cardClasses.container}`}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <div className={`relative aspect-square ${cardClasses.image} flex items-center justify-center overflow-hidden`}>
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
          <span className="absolute top-3 left-3 bg-gold text-burgundy text-[11px] font-semibold px-2 py-1 rounded z-10">
            −{producto.descOfertaPct}%
          </span>
        )}
        {/* Indicador discreto de cantidad de fotos */}
        {fotos.length > 1 && (
          <div className="absolute bottom-3 right-3 flex gap-1 z-10">
            {fotos.map((_, i) => (
              <span
                key={i}
                className={`block w-2 h-2 sm:w-1.5 sm:h-1.5 rounded-full transition-colors ${
                  i === idx ? "bg-cream-light shadow" : "bg-cream-light/50"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Bloque info — flex-1 para tomar todo el alto sobrante de la card */}
      <div className="p-4 sm:p-3 flex flex-1 flex-col gap-2">
        {/* Nombre: 2 líneas reservadas siempre */}
        <h3 className="font-heading text-burgundy text-sm sm:text-base line-clamp-2 leading-snug min-h-[2.75em]">
          {producto.nombre}
        </h3>

        {/* Chip de variantes: siempre renderizado (invisible si no aplica)
            para mantener el mismo alto entre cards con y sin variantes */}
        <p
          className={`text-xs text-rose font-medium leading-tight ${
            tieneVariantes ? "" : "invisible"
          }`}
          aria-hidden={!tieneVariantes}
        >
          {tieneVariantes
            ? `${producto.variantesCount} ${
                producto.varianteTipo === "talle"
                  ? "talles"
                  : producto.varianteTipo === "material"
                    ? "materiales"
                    : "colores"
              }`
            : "·"}
        </p>

        {/* Bloque de precios: 4 líneas con alto FIJO reservado (1 tachado + 3 precios) */}
        <div className="flex flex-col gap-0.5 min-h-[5rem]">
          {/* L0 (reservada): tachado oferta o invisible para mantener simetría */}
          <span
            className={`text-xs line-through leading-tight text-ink/40 ${
              enOferta && !tieneVariantes ? "" : "invisible"
            }`}
            aria-hidden={!(enOferta && !tieneVariantes)}
          >
            {fmtMonto(producto.precioEft)}
          </span>

          {tieneVariantes ? (
            <>
              {/* L1: "Desde $X" para grupos con rango */}
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className="text-[15px] font-semibold text-burgundy">
                  <span className="text-xs text-ink/60 font-normal">Desde </span>
                  {fmtMonto(producto.precioEftMin ?? precioEftConOferta)}
                </span>
              </div>
              {/* L2 y L3 invisible para preservar el min-h de 5rem */}
              <span className="text-[13px] invisible" aria-hidden="true">
                ·
              </span>
              <span className="text-[11px] invisible" aria-hidden="true">
                ·
              </span>
            </>
          ) : (
            <>
              {/* L1: precio EFT (anchor) + label */}
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className="text-[15px] font-semibold text-burgundy">
                  {fmtMonto(precioEftConOferta)}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-ink/50">
                  efectivo / transferencia
                </span>
              </div>
              {/* L2: precio TN + label */}
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className="text-[13px] font-medium text-ink">
                  {fmtMonto(precioTnConOferta)}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-ink/50">
                  MP / tarjeta
                </span>
              </div>
              {/* L3: cuotas — texto auxiliar */}
              <p className="text-[11px] text-ink/60 leading-tight">
                3 cuotas s/ interés de {fmtMonto(cuotaMonto)}
              </p>
            </>
          )}
        </div>

        {/* Botón / spacer — siempre al fondo (mt-auto) con alto fijo reservado.
            Esto garantiza que TODAS las cards de la fila tengan el botón al
            mismo alto exacto, sin importar las diferencias de texto arriba. */}
        <div className="mt-auto pt-1">
          {mostrarQuickAdd ? (
            <button
              type="button"
              onClick={onAgregar}
              aria-label={`Agregar ${producto.nombre} al carrito`}
              className={`w-full h-10 inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold text-sm transition-colors ${
                agregado
                  ? "bg-emerald-700 text-cream-light"
                  : "bg-burgundy hover:bg-burgundy-dark text-cream-light"
              }`}
            >
              {agregado ? (
                <>
                  <Check size={16} /> Agregado
                </>
              ) : (
                <>
                  <ShoppingBag size={16} /> Agregar al carrito
                </>
              )}
            </button>
          ) : (
            // Spacer cuando NO hay botón (variantes o sin stock).
            // Mantiene el mismo alto que el botón para alinear con vecinas.
            <div className="w-full h-10" aria-hidden="true" />
          )}
        </div>
      </div>
    </Link>
  );
}
