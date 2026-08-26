"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { fmtMonto } from "@/lib/cart";
import { cloudinaryUrl } from "@/lib/img";

/**
 * Página de carrito.
 *
 * - Muestra estado vacío amigable con CTA al catálogo.
 * - Lista cada línea con miniatura + nombre + variante + precio unitario.
 * - Cada línea tiene stepper (− N +) con validación min 1.
 * - Botón Eliminar por línea.
 * - Footer con total + CTA "Ir a pagar" (link a /checkout).
 * - Mientras hidrata (lectura de localStorage), muestra placeholder para evitar
 *   flash de "carrito vacío" cuando en realidad hay items guardados.
 */
export function CarritoClient() {
  const { items, total, totalTn, cantidad, cambiarCantidad, eliminar, vaciar, hidratado } = useCart();
  // Mostrar dual pricing solo si hay diferencia real (>= 1% para evitar mostrar
  // "$10.850 vs $10.850" en items legacy sin precioUnitTn).
  const muestraDual = totalTn > total * 1.01;

  if (!hidratado) {
    return (
      <div className="max-w-4xl mx-auto px-6 sm:px-10 py-12">
        <div className="text-burgundy/60 text-center py-20">Cargando carrito…</div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-6 sm:px-10 py-16 text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-cream mb-6">
          <ShoppingBag size={36} className="text-burgundy/40" />
        </div>
        <h1 className="font-heading text-3xl text-burgundy mb-3">Tu carrito está vacío</h1>
        <p className="text-ink/70 mb-8 max-w-md mx-auto">
          Empezá a agregar productos desde el catálogo. Te guardamos lo que elijas para que puedas
          completarlo después.
        </p>
        <Link
          href="/productos"
          className="inline-flex items-center gap-2 bg-burgundy hover:bg-burgundy-dark text-cream-light font-semibold py-3 px-6 rounded-lg transition-colors"
        >
          Ver catálogo <ArrowRight size={18} />
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 sm:px-10 py-10">
      <Link
        href="/productos"
        className="text-burgundy hover:text-gold text-sm inline-flex items-center gap-1.5 mb-6"
      >
        <ArrowLeft size={16} /> Seguir comprando
      </Link>

      <div className="flex items-end justify-between mb-8">
        <h1 className="font-heading text-3xl sm:text-4xl text-burgundy">
          Tu carrito
        </h1>
        <span className="text-sm text-ink/60">
          {cantidad} {cantidad === 1 ? "producto" : "productos"}
        </span>
      </div>

      <div className="grid lg:grid-cols-[1fr,360px] gap-8">
        {/* Lista de items */}
        <ul className="divide-y divide-burgundy/10 border border-burgundy/10 rounded-xl bg-cream/30">
          {items.map((item) => {
            const thumb = item.fotoUrl ? cloudinaryUrl(item.fotoUrl, "thumb") : null;
            // El precio PRINCIPAL del item es el de efectivo/transferencia (precioUnit),
            // coherente con card y detalle (anchoring: destacar el más bajo). El de
            // tarjeta/MP se muestra como línea secundaria. Mismo eje en todo el recorrido.
            const precioEft = item.precioUnit;
            const precioTn = item.precioUnitTn || item.precioUnit;
            const subtotalEft = precioEft * item.cantidad;
            const subtotalTn = precioTn * item.cantidad;
            const linkHref = item.slug ? `/productos/${encodeURIComponent(item.slug)}` : null;
            return (
              <li key={item.lineId} className="p-4 sm:p-5 flex gap-4 items-center">
                {/* Miniatura */}
                <div className="shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden bg-cream-light flex items-center justify-center">
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumb}
                      alt={item.nombre}
                      width={96}
                      height={96}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ShoppingBag size={24} className="text-burgundy/30" />
                  )}
                </div>

                {/* Info + controles */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      {linkHref ? (
                        <Link
                          href={linkHref}
                          className="font-heading text-burgundy text-base sm:text-lg leading-snug hover:text-gold transition-colors line-clamp-2"
                        >
                          {item.nombre}
                        </Link>
                      ) : (
                        <span className="font-heading text-burgundy text-base sm:text-lg leading-snug line-clamp-2">
                          {item.nombre}
                        </span>
                      )}
                      {item.variante && (
                        <div className="text-xs uppercase tracking-wider text-ink/50 mt-1">
                          {item.variante}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => eliminar(item.lineId)}
                      aria-label={`Eliminar ${item.nombre}`}
                      className="shrink-0 text-burgundy/50 hover:text-red-700 transition-colors p-1"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>

                  <div className="flex items-end justify-between gap-3">
                    {/* Stepper */}
                    <div className="inline-flex items-center border border-burgundy/20 rounded-lg overflow-hidden">
                      <button
                        type="button"
                        onClick={() => cambiarCantidad(item.lineId, item.cantidad - 1)}
                        aria-label="Restar"
                        className="px-2 py-1.5 text-burgundy hover:bg-cream-light transition-colors disabled:opacity-30"
                        disabled={item.cantidad <= 1}
                      >
                        <Minus size={14} />
                      </button>
                      <span className="px-3 py-1 text-burgundy font-semibold min-w-[36px] text-center">
                        {item.cantidad}
                      </span>
                      <button
                        type="button"
                        onClick={() => cambiarCantidad(item.lineId, item.cantidad + 1)}
                        aria-label="Sumar"
                        className="px-2 py-1.5 text-burgundy hover:bg-cream-light transition-colors disabled:opacity-30"
                        disabled={
                          typeof item.stock === "number" &&
                          item.stock > 0 &&
                          item.cantidad >= item.stock
                        }
                      >
                        <Plus size={14} />
                      </button>
                    </div>

                    {/* Precio — efectivo principal, tarjeta secundario */}
                    <div className="text-right">
                      <div className="text-lg sm:text-xl font-semibold text-burgundy">
                        {fmtMonto(subtotalEft)}
                      </div>
                      {muestraDual && (
                        <div className="text-xs text-ink/55 mt-0.5">
                          o {fmtMonto(subtotalTn)} con tarjeta / MP
                        </div>
                      )}
                      {item.cantidad > 1 && (
                        <div className="text-xs text-ink/50 mt-0.5">
                          {fmtMonto(precioEft)} c/u
                        </div>
                      )}
                    </div>
                  </div>
                  {typeof item.stock === "number" &&
                    item.stock > 0 &&
                    item.cantidad >= item.stock && (
                      <p className="text-xs text-amber-700 mt-1.5">
                        Máximo disponible: {item.stock}{" "}
                        {item.stock === 1 ? "unidad" : "unidades"}
                      </p>
                    )}
                </div>
              </li>
            );
          })}
        </ul>

        {/* Resumen + CTA */}
        <aside className="lg:sticky lg:top-24 self-start space-y-4">
          <div className="border border-burgundy/10 rounded-xl bg-cream/30 p-5 sm:p-6">
            <h2 className="font-heading text-xl text-burgundy mb-4">Resumen</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink/70">Envío</dt>
                <dd className="text-ink/60 italic">se calcula en el checkout</dd>
              </div>
            </dl>
            <hr className="my-4 border-burgundy/10" />

            {muestraDual ? (
              // "Elegí cómo pagar" — dos formas de pagar lo mismo, SIN porcentajes.
              // El medio de pago no es "otro descuento" (eso confundía con las ofertas):
              // son dos montos finales y el cliente elige. Si el producto está en oferta,
              // ambos montos ya la incluyen, así que no hay nada que parezca apilarse.
              <div className="space-y-3">
                <p className="font-heading text-base text-burgundy">Elegí cómo pagar</p>
                {/* Transferencia / efectivo — destacado (es el más conveniente) */}
                <div className="rounded-lg bg-gold/10 border border-gold/30 p-3 -mx-1">
                  <div className="flex justify-between items-baseline">
                    <span className="font-heading text-sm text-burgundy">
                      Transferencia o efectivo
                    </span>
                    <span className="font-heading text-xl text-burgundy">{fmtMonto(total)}</span>
                  </div>
                  <p className="text-xs text-ink/70 mt-0.5">
                    ✓ Pagás menos · coordinás por WhatsApp en el siguiente paso
                  </p>
                </div>
                {/* Tarjeta / MP — lo que se cobra en el checkout online */}
                <div>
                  <div className="flex justify-between items-baseline">
                    <span className="font-heading text-sm text-burgundy">
                      Tarjeta / Mercado Pago
                    </span>
                    <span className="font-heading text-lg text-ink">{fmtMonto(totalTn)}</span>
                  </div>
                  <p className="text-xs text-ink/50 mt-0.5">
                    3 cuotas sin interés · pagás online en el siguiente paso
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex justify-between items-baseline">
                <span className="font-heading text-lg text-burgundy">Total</span>
                <span className="font-heading text-2xl text-burgundy">{fmtMonto(total)}</span>
              </div>
            )}

            <Link
              href="/checkout"
              className="mt-5 inline-flex items-center justify-center gap-2 w-full text-center bg-burgundy hover:bg-burgundy-dark text-cream-light font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              Ir a pagar <ArrowRight size={18} />
            </Link>

            <button
              type="button"
              onClick={() => {
                if (confirm("¿Vaciar el carrito? Vas a perder todos los productos.")) {
                  vaciar();
                }
              }}
              className="mt-3 w-full text-center text-xs text-burgundy/60 hover:text-red-700 transition-colors py-2"
            >
              Vaciar carrito
            </button>
          </div>

        </aside>
      </div>
    </div>
  );
}
