"use client";

import Link from "next/link";
import { useState, useMemo, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight, MessageCircle, CreditCard, Truck, Ruler, ChevronDown, ShoppingBag, Check
} from "lucide-react";
import type { Producto, ConfigWeb, Variante } from "@/lib/api";
import { ProductoGaleria } from "@/components/ProductoGaleria";
import { renderMarkdownSeguro } from "@/lib/sanitize";
import { trackWhatsappClick, trackEvent } from "@/lib/analytics";
import { useCart } from "@/contexts/CartContext";

function fmtMonto(n: number): string {
  return "$" + Math.round(Number(n) || 0).toLocaleString("es-AR");
}

function labelTipo(tipo: string | null | undefined): string {
  if (tipo === "talle") return "Talle";
  if (tipo === "material") return "Material";
  return "Color";
}

export function ProductoDetalleClient({
  producto,
  config,
}: {
  producto: Producto;
  config: ConfigWeb;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const tieneVariantes = (producto.variantes?.length ?? 0) > 0;
  const variantes = producto.variantes ?? [];

  // SKU inicial: si la URL tiene ?sku=, usar ese. Sino, la primera variante con stock,
  // o la primera variante a secas. Para productos sin variantes, el SKU del producto.
  const skuInicial = useMemo(() => {
    if (!tieneVariantes) return producto.sku;
    const skuQuery = searchParams?.get("sku");
    if (skuQuery && variantes.some((v) => v.sku === skuQuery)) return skuQuery;
    const conStock = variantes.find((v) => v.disponible);
    return (conStock || variantes[0]).sku;
  }, [searchParams, tieneVariantes, variantes, producto.sku]);

  const [varianteSku, setVarianteSku] = useState<string>(skuInicial);

  // Sincronizar cambios externos (back/forward del browser)
  useEffect(() => {
    setVarianteSku(skuInicial);
  }, [skuInicial]);

  const varianteActual: Variante | null = useMemo(() => {
    if (!tieneVariantes) return null;
    return variantes.find((v) => v.sku === varianteSku) || variantes[0];
  }, [tieneVariantes, variantes, varianteSku]);

  // Precios + foto efectivos según variante seleccionada (o producto si no hay variantes)
  const datos = useMemo(() => {
    if (varianteActual) {
      return {
        precioEft: varianteActual.precioEft,
        precioTn: varianteActual.precioTn,
        stock: varianteActual.stock,
        oferta: varianteActual.oferta,
        descOfertaPct: varianteActual.descOfertaPct,
        fotos: (varianteActual.fotos && varianteActual.fotos.length > 0)
          ? varianteActual.fotos
          : (producto.fotos && producto.fotos.length > 0
              ? producto.fotos
              : (producto.fotoUrl ? [producto.fotoUrl] : [])),
        varianteValor: varianteActual.valor,
      };
    }
    return {
      precioEft: producto.precioEft,
      precioTn: producto.precioTn,
      stock: producto.stock,
      oferta: producto.oferta,
      descOfertaPct: producto.descOfertaPct,
      fotos: (producto.fotos && producto.fotos.length > 0
        ? producto.fotos
        : (producto.fotoUrl ? [producto.fotoUrl] : [])),
      varianteValor: "",
    };
  }, [varianteActual, producto]);

  const enOferta = !!datos.oferta && Number(datos.descOfertaPct) > 0;
  const precioEftFinal = enOferta
    ? Math.round(datos.precioEft * (1 - datos.descOfertaPct / 100))
    : datos.precioEft;
  const precioTnFinal = enOferta
    ? Math.round(datos.precioTn * (1 - datos.descOfertaPct / 100))
    : datos.precioTn;

  const cuotasN = Math.max(1, Number(config.cuotas_sin_interes) || 3);
  const cuotaMonto = Math.round(precioTnFinal / cuotasN);

  const whatsapp = config.contacto_whatsapp || "";
  const productoLabel = datos.varianteValor
    ? `${producto.nombre} ${datos.varianteValor}`
    : producto.nombre;
  const skuParaMensaje = varianteActual?.sku || producto.sku;
  const msg = encodeURIComponent(
    `Hola! Me interesa el producto "${productoLabel}" (SKU ${skuParaMensaje}). ¿Está disponible?`
  );
  const waLink = whatsapp
    ? `https://wa.me/${whatsapp.replace(/[^0-9]/g, "")}?text=${msg}`
    : null;

  function seleccionarVariante(sku: string) {
    setVarianteSku(sku);
    // Actualizar URL sin recargar (replace para no spamear history).
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.set("sku", sku);
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  // Carrito
  const { agregar } = useCart();
  const [agregadoFeedback, setAgregadoFeedback] = useState(false);
  const hayStock = (datos.stock || 0) > 0;

  function onAgregarAlCarrito() {
    if (!hayStock) return;
    agregar({
      sku: skuParaMensaje,
      nombre: producto.nombre,
      variante: varianteActual?.valor || "",
      precioUnit: precioEftFinal,
      precioUnitTn: precioTnFinal,
      fotoUrl: datos.fotos[0],
      slug: producto.sku,
      // Logística para cotizador (B.2)
      pesoKg: producto.pesoKg,
      altoCm: producto.altoCm,
      anchoCm: producto.anchoCm,
      profundidadCm: producto.profundidadCm,
    });
    trackEvent("add_to_cart", {
      sku: skuParaMensaje,
      nombre: producto.nombre,
      precio: precioEftFinal,
      variante: varianteActual?.valor || "",
    });
    // Feedback visual: cambiar el botón a "Agregado ✓" durante 2 segundos.
    setAgregadoFeedback(true);
    window.setTimeout(() => setAgregadoFeedback(false), 2000);
  }

  const stock = Number(datos.stock) || 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
      <ProductoGaleria
        fotos={datos.fotos}
        nombre={producto.nombre}
        badge={
          enOferta ? (
            <span className="absolute top-3 left-3 bg-gold text-burgundy text-sm font-semibold px-3 py-1.5 rounded z-10">
              −{datos.descOfertaPct}%
            </span>
          ) : null
        }
      />

      {/* Info */}
      <div>
        <h1 className="font-heading text-3xl sm:text-4xl text-burgundy leading-tight">
          {producto.nombre}
        </h1>

        {/* Stock badge */}
        <div className="mt-4">
          {stock === 0 ? (
            <span className="inline-flex items-center gap-1.5 bg-red-50 text-red-700 text-sm font-medium px-3 py-1 rounded-full">
              <span className="w-2 h-2 bg-red-500 rounded-full" /> Sin stock
            </span>
          ) : stock === 1 ? (
            <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 text-sm font-medium px-3 py-1 rounded-full">
              <span className="w-2 h-2 bg-amber-500 rounded-full" /> ¡Último disponible!
            </span>
          ) : stock <= 3 ? (
            <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 text-sm font-medium px-3 py-1 rounded-full">
              <span className="w-2 h-2 bg-amber-500 rounded-full" /> Quedan {stock}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 bg-green-50 text-green-700 text-sm font-medium px-3 py-1 rounded-full">
              <span className="w-2 h-2 bg-green-500 rounded-full" /> {stock} disponibles
            </span>
          )}
        </div>

        {/* Precios */}
        <div className="mt-6 space-y-2">
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="text-3xl font-semibold text-burgundy">
              {fmtMonto(precioEftFinal)}
            </span>
            {enOferta && (
              <span className="text-base text-ink/40 line-through">
                {fmtMonto(datos.precioEft)}
              </span>
            )}
            <span className="text-sm text-ink/60">en efectivo o transferencia</span>
          </div>
          <p className="text-sm text-ink/70">
            o <span className="font-semibold text-burgundy">{fmtMonto(precioTnFinal)}</span> con tarjeta / Mercado Pago
            {cuotasN > 1 && (
              <span className="text-ink/60"> · {cuotasN} cuotas sin interés de {fmtMonto(cuotaMonto)}</span>
            )}
          </p>
        </div>

        {/* Variantes (selector de chips) */}
        {tieneVariantes && (
          <div className="mt-6">
            <p className="text-sm text-ink/70 mb-2">
              {labelTipo(producto.varianteTipo)}:
              {" "}
              <span className="text-burgundy font-semibold">{datos.varianteValor}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {variantes.map((v) => {
                const activa = v.sku === varianteSku;
                const sinStock = !v.disponible;
                return (
                  <button
                    key={v.sku}
                    type="button"
                    onClick={() => !sinStock && seleccionarVariante(v.sku)}
                    disabled={sinStock}
                    aria-pressed={activa}
                    className={`px-4 py-1.5 rounded-full text-sm border transition-colors ${
                      activa
                        ? "bg-burgundy text-cream-light border-burgundy"
                        : sinStock
                        ? "bg-white text-ink/40 border-ink/10 line-through cursor-not-allowed"
                        : "bg-white text-burgundy border-burgundy/30 hover:border-burgundy"
                    }`}
                  >
                    {v.valor}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* CTA Carrito (primario) */}
        <button
          type="button"
          onClick={onAgregarAlCarrito}
          disabled={!hayStock}
          className={`mt-6 inline-flex items-center justify-center gap-2 w-full text-center font-semibold py-3 px-6 rounded-lg transition-colors ${
            !hayStock
              ? "bg-burgundy/30 text-cream-light/60 cursor-not-allowed"
              : agregadoFeedback
                ? "bg-emerald-700 hover:bg-emerald-800 text-cream-light"
                : "bg-burgundy hover:bg-burgundy-dark text-cream-light"
          }`}
        >
          {agregadoFeedback ? (
            <>
              <Check size={18} /> Agregado al carrito
            </>
          ) : (
            <>
              <ShoppingBag size={18} />
              {hayStock ? "Agregar al carrito" : "Sin stock"}
            </>
          )}
        </button>

        {/* CTA WhatsApp (secundario, para consultas) */}
        {waLink && (
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() =>
              trackWhatsappClick({
                sku: skuParaMensaje,
                nombre: productoLabel,
                precio: precioEftFinal,
                variante: varianteActual?.valor || "",
              })
            }
            className="mt-3 inline-flex items-center justify-center gap-2 w-full text-center bg-cream-light hover:bg-cream text-burgundy border border-burgundy/20 font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            <MessageCircle size={18} /> Consultar por WhatsApp
          </a>
        )}

        {/* Descripción */}
        {producto.descripcion && (
          <div
            className="mt-8 text-ink/80 leading-relaxed [&_strong]:font-semibold [&_strong]:text-burgundy [&_p]:mb-2 [&_p:last-child]:mb-0 [&_em]:italic"
            dangerouslySetInnerHTML={{ __html: renderMarkdownSeguro(producto.descripcion) }}
          />
        )}

        {/* Acordeón Medios de pago */}
        {config.medios_pago_texto && (
          <details className="mt-6 border-t border-burgundy/10 group">
            <summary className="flex items-center justify-between py-3 cursor-pointer text-burgundy font-semibold list-none">
              <span className="flex items-center gap-2">
                <CreditCard size={18} className="text-burgundy/70" /> Medios de pago
              </span>
              <ChevronDown size={18} className="text-burgundy/50 group-open:rotate-180 transition-transform" />
            </summary>
            <div
              className="pb-3 text-sm text-ink/75 leading-relaxed [&_strong]:font-semibold [&_strong]:text-burgundy [&_p]:mb-2 [&_p:last-child]:mb-0 [&_em]:italic"
              dangerouslySetInnerHTML={{ __html: renderMarkdownSeguro(config.medios_pago_texto) }}
            />
          </details>
        )}

        {/* Acordeón Medios de envío */}
        {config.medios_envio_texto && (
          <details className="border-t border-burgundy/10 group">
            <summary className="flex items-center justify-between py-3 cursor-pointer text-burgundy font-semibold list-none">
              <span className="flex items-center gap-2">
                <Truck size={18} className="text-burgundy/70" /> Medios de envío
              </span>
              <ChevronDown size={18} className="text-burgundy/50 group-open:rotate-180 transition-transform" />
            </summary>
            <div className="pb-3 text-sm text-ink/75 leading-relaxed [&_strong]:font-semibold [&_strong]:text-burgundy [&_p]:mb-2 [&_p:last-child]:mb-0 [&_em]:italic">
              <div dangerouslySetInnerHTML={{ __html: renderMarkdownSeguro(config.medios_envio_texto) }} />
              <Link href="/envios" className="inline-flex items-center gap-1 mt-2 text-burgundy hover:text-gold underline">
                Ver más detalles <ArrowRight size={14} />
              </Link>
            </div>
          </details>
        )}

        {/* Acordeón Medidas y detalles */}
        {producto.medidas && (
          <details className="border-t border-b border-burgundy/10 group">
            <summary className="flex items-center justify-between py-3 cursor-pointer text-burgundy font-semibold list-none">
              <span className="flex items-center gap-2">
                <Ruler size={18} className="text-burgundy/70" /> Medidas y detalles
              </span>
              <ChevronDown size={18} className="text-burgundy/50 group-open:rotate-180 transition-transform" />
            </summary>
            <div className="pb-3 text-sm text-ink/75 leading-relaxed whitespace-pre-line">
              {producto.medidas}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
