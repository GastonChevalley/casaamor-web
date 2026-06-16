"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ShoppingBag, Check } from "lucide-react";
import type { Producto, Variante } from "@/lib/api";
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

  // ── Variantes (estilo Tienda Nube: selector inline + precio dinámico) ──
  // Un grupo con N>1 variantes muestra chips para elegir y el precio/foto/stock
  // se actualizan según la variante activa, igual que el detalle del producto.
  const variantes: Variante[] = producto.variantes ?? [];
  const tieneVariantes = !!(producto.variantesCount && producto.variantesCount > 1) && variantes.length > 0;

  // SKU de variante inicial: primera con stock, o la primera a secas.
  const skuInicial = useMemo(() => {
    if (!tieneVariantes) return producto.sku;
    const conStock = variantes.find((v) => v.disponible);
    return (conStock || variantes[0]).sku;
  }, [tieneVariantes, variantes, producto.sku]);

  const [varianteSku, setVarianteSku] = useState<string>(skuInicial);
  useEffect(() => {
    setVarianteSku(skuInicial);
  }, [skuInicial]);

  const varianteActual: Variante | null = useMemo(() => {
    if (!tieneVariantes) return null;
    return variantes.find((v) => v.sku === varianteSku) || variantes[0];
  }, [tieneVariantes, variantes, varianteSku]);

  // Datos efectivos según variante activa (o el producto si no hay variantes).
  const datos = useMemo(() => {
    if (varianteActual) {
      return {
        precioEft: varianteActual.precioEft,
        precioTn: varianteActual.precioTn,
        stock: varianteActual.stock,
        oferta: varianteActual.oferta,
        descOfertaPct: varianteActual.descOfertaPct,
        fotos:
          varianteActual.fotos && varianteActual.fotos.length > 0
            ? varianteActual.fotos
            : producto.fotos && producto.fotos.length > 0
              ? producto.fotos
              : producto.fotoUrl
                ? [producto.fotoUrl]
                : [],
        valor: varianteActual.valor,
      };
    }
    return {
      precioEft: producto.precioEft,
      precioTn: producto.precioTn,
      stock: producto.stock,
      oferta: producto.oferta,
      descOfertaPct: producto.descOfertaPct,
      fotos:
        producto.fotos && producto.fotos.length > 0
          ? producto.fotos
          : producto.fotoUrl
            ? [producto.fotoUrl]
            : [],
      valor: "",
    };
  }, [varianteActual, producto]);

  const enOferta = !!datos.oferta && Number(datos.descOfertaPct) > 0;
  const precioEftConOferta = enOferta
    ? Math.round(datos.precioEft * (1 - datos.descOfertaPct / 100))
    : datos.precioEft;
  const precioTnConOferta = enOferta
    ? Math.round(datos.precioTn * (1 - datos.descOfertaPct / 100))
    : datos.precioTn;
  const cuotaMonto = Math.round(precioTnConOferta / 3);

  const fotos = datos.fotos;

  // Hover cycle: cuando hay >= 2 fotos, ciclar entre ellas cada 1.2s mientras
  // se hace hover. Al sacar el mouse, vuelve a la primera con fade.
  const [idx, setIdx] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset del índice de foto al cambiar de variante (las fotos cambian).
  useEffect(() => {
    setIdx(0);
  }, [varianteSku]);

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
    if (datos.stock <= 0) return;
    agregar({
      sku: varianteActual?.sku || producto.sku,
      nombre: producto.nombre,
      variante: varianteActual?.valor || "",
      precioUnit: precioEftConOferta,
      precioUnitTn: precioTnConOferta,
      fotoUrl: fotos[0],
      slug: producto.sku,
      // Logística para cotizador (B.2)
      pesoKg: producto.pesoKg,
      altoCm: producto.altoCm,
      anchoCm: producto.anchoCm,
      profundidadCm: producto.profundidadCm,
    });
    setAgregado(true);
    if (agregadoTimerRef.current) clearTimeout(agregadoTimerRef.current);
    agregadoTimerRef.current = setTimeout(() => setAgregado(false), 1500);
  }

  function onSeleccionarVariante(e: React.MouseEvent, sku: string) {
    // Los chips viven dentro del <Link> de la card → frenar la navegación.
    e.preventDefault();
    e.stopPropagation();
    setVarianteSku(sku);
  }

  const hayStock = datos.stock > 0;
  const mostrarQuickAdd = hayStock;

  return (
    <Link
      href={`/productos/${encodeURIComponent(producto.sku)}`}
      className={`group block ${cardClasses.container}`}
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
            −{datos.descOfertaPct}%
          </span>
        )}
        {!hayStock && (
          <span className="absolute top-3 right-3 bg-ink/80 text-cream-light text-[10px] font-semibold px-2 py-1 rounded z-10">
            SIN STOCK
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

      {/* Bloque info — altura natural, sin estirar */}
      <div className="p-4 sm:p-3 flex flex-col gap-2">
        {/* Nombre: 1 sola línea con ellipsis si es muy largo. */}
        <h3
          className="font-heading text-burgundy text-sm sm:text-base line-clamp-1 leading-snug"
          title={producto.nombre}
        >
          {producto.nombre}
        </h3>

        {/* Bloque de precios: SIEMPRE las 3 líneas (EFT, TN, cuotas), tanto
            para productos simples como para la variante activa de un grupo.
            El precio se actualiza al elegir variante. */}
        <div className="flex flex-col gap-0.5">
          {enOferta && (
            <span className="text-xs line-through leading-tight text-ink/40">
              {fmtMonto(datos.precioEft)}
            </span>
          )}
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
          {/* L3: cuotas — auxiliar */}
          <p className="text-[11px] text-ink/60 leading-tight">
            3 cuotas s/ interés de {fmtMonto(cuotaMonto)}
          </p>
        </div>

        {/* Selector de variantes inline (chips). Solo en grupos. */}
        {tieneVariantes && (
          <div className="flex flex-wrap gap-1.5">
            {variantes.map((v) => {
              const activa = v.sku === varianteSku;
              const sinStock = !v.disponible;
              return (
                <button
                  key={v.sku}
                  type="button"
                  onClick={(e) => !sinStock && onSeleccionarVariante(e, v.sku)}
                  disabled={sinStock}
                  aria-pressed={activa}
                  title={sinStock ? `${v.valor} (sin stock)` : v.valor}
                  className={`px-2 py-0.5 rounded-full text-[11px] border transition-colors ${
                    activa
                      ? "bg-burgundy text-cream-light border-burgundy"
                      : sinStock
                        ? "bg-white text-ink/30 border-ink/10 line-through cursor-not-allowed"
                        : "bg-white text-burgundy border-burgundy/30 hover:border-burgundy"
                  }`}
                >
                  {v.valor}
                </button>
              );
            })}
          </div>
        )}

        {/* Botón quick-add — agrega la variante activa (o el producto simple). */}
        {mostrarQuickAdd ? (
          <button
            type="button"
            onClick={onAgregar}
            aria-label={`Agregar ${producto.nombre}${datos.valor ? ` ${datos.valor}` : ""} al carrito`}
            className={`mt-1 w-full h-10 inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold text-xs sm:text-sm whitespace-nowrap transition-colors ${
              agregado
                ? "bg-emerald-700 text-cream-light"
                : "bg-burgundy hover:bg-burgundy-dark text-cream-light"
            }`}
          >
            {agregado ? (
              <>
                <Check className="size-4" />
                <span>Agregado</span>
              </>
            ) : (
              <>
                <ShoppingBag className="size-3.5 sm:size-4" />
                <span className="sm:hidden">Agregar</span>
                <span className="hidden sm:inline">Agregar al carrito</span>
              </>
            )}
          </button>
        ) : null}
      </div>
    </Link>
  );
}
