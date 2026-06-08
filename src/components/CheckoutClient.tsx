"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ShoppingBag, Loader2 } from "lucide-react";
import { initMercadoPago, Payment } from "@mercadopago/sdk-react";
import type { ConfigWeb } from "@/lib/api";
import { useCart } from "@/contexts/CartContext";
import { fmtMonto } from "@/lib/cart";
import { trackEvent } from "@/lib/analytics";

const MP_PUBLIC_KEY = (process.env.NEXT_PUBLIC_MP_PUBLIC_KEY || "").trim();
const MP_ENABLED = MP_PUBLIC_KEY.length > 0;

// Inicializar SDK MP una sola vez en el cliente. initMercadoPago es no-op si
// la key está vacía — defensa en profundidad para no romper si falta env var.
let mpInited = false;
function asegurarMPInit(): boolean {
  if (mpInited) return true;
  if (!MP_ENABLED) return false;
  try {
    initMercadoPago(MP_PUBLIC_KEY, { locale: "es-AR" });
    mpInited = true;
    return true;
  } catch {
    return false;
  }
}

/**
 * Página de checkout.
 *
 * Estado actual (B.1.3 — sin credenciales MP todavía):
 *   - Form de datos cliente (nombre, email, telefono, dirección, notas).
 *   - Selector de envío con 3 opciones STUB (la cotización real llega en B.2).
 *   - Sin MP Brick — placeholder. Cuando lleguen las credenciales, se
 *     monta `<Payment />` de `@mercadopago/sdk-react` en el bloque "Pago".
 *
 * Cuando se conecte MP (B.1.8):
 *   - Submit del form → POST a `/api/mp/create-preference` con datos cliente +
 *     items + envío.
 *   - Respuesta trae `preferenceId` → se pasa al Payment Brick.
 *   - El brick maneja el flujo de cobro y redirige a /checkout/exito|pendiente|error.
 */
export function CheckoutClient({ config }: { config: ConfigWeb }) {
  const router = useRouter();
  const { items, total, cantidad, hidratado } = useCart();

  const [form, setForm] = useState({
    nombre: "",
    email: "",
    telefono: "",
    direccion: "",
    ciudad: "",
    codigoPostal: "",
    notas: "",
    envio: "showroom" as "showroom" | "domicilio" | "sucursal",
  });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preferenceId, setPreferenceId] = useState<string | null>(null);

  // Asegurar SDK MP inicializado del lado cliente
  useEffect(() => {
    asegurarMPInit();
  }, []);

  // Si el carrito queda vacío (eliminados todos los items mientras está en /checkout),
  // redirigir suavemente al catálogo.
  useEffect(() => {
    if (hidratado && items.length === 0) {
      router.replace("/productos");
    }
  }, [hidratado, items.length, router]);

  // Trackear inicio del checkout.
  useEffect(() => {
    if (hidratado && items.length > 0) {
      trackEvent("begin_checkout", {
        total,
        cantidad,
        items: items.map((i) => ({ sku: i.sku, cantidad: i.cantidad, precio: i.precioUnit })),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hidratado]);

  const wa = String(config.contacto_whatsapp || "").replace(/[^0-9]/g, "");
  const waLink = wa
    ? `https://wa.me/${wa}?text=${encodeURIComponent(
        "Hola CasaAmor, quiero coordinar una compra del carrito.",
      )}`
    : null;

  const totalConEnvio = useMemo(() => {
    // Por ahora envío manual a coordinar (0). En B.2 esto consulta /api/envios/cotizar.
    return total;
  }, [total]);

  function actualizar<K extends keyof typeof form>(key: K, valor: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: valor }));
  }

  function validar(): string | null {
    if (!form.nombre.trim()) return "Ingresá tu nombre.";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) return "Email inválido.";
    if (form.envio !== "showroom") {
      if (!form.direccion.trim()) return "Ingresá la dirección de envío.";
      if (!form.ciudad.trim()) return "Ingresá la ciudad.";
      if (!/^\d{4,5}$/.test(form.codigoPostal.trim())) return "Código postal inválido.";
    }
    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const err = validar();
    if (err) {
      setError(err);
      return;
    }
    setEnviando(true);
    trackEvent("add_payment_info", { total: totalConEnvio });

    // Si MP no está configurado (env var falta), fallback al WhatsApp.
    if (!MP_ENABLED) {
      setTimeout(() => {
        setEnviando(false);
        setError(
          "El pago online está en activación. Por ahora coordinamos la compra por WhatsApp con los datos que cargaste. Tocá el botón verde para finalizar.",
        );
      }, 400);
      return;
    }

    // Crear preference MP server-side con los items + datos cliente
    try {
      const r = await fetch("/api/mp/create-preference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((it) => ({
            sku: it.sku,
            nombre: it.nombre,
            cantidad: it.cantidad,
            precioUnit: it.precioUnit,
            variante: it.variante,
          })),
          cliente: {
            nombre: form.nombre,
            email: form.email,
            telefono: form.telefono,
            direccion: form.envio !== "showroom" ? form.direccion : "",
            ciudad: form.envio !== "showroom" ? form.ciudad : "",
            codigoPostal: form.envio !== "showroom" ? form.codigoPostal : "",
            notas: form.notas,
          },
          envio: form.envio,
        }),
      });
      const data = await r.json();
      setEnviando(false);
      if (!r.ok || !data?.ok || !data.preferenceId) {
        setError(
          data?.message ||
            "No pudimos iniciar el pago. Intentá de nuevo o coordiná por WhatsApp.",
        );
        return;
      }
      setPreferenceId(data.preferenceId as string);
    } catch {
      setEnviando(false);
      setError("Error de red. Verificá tu conexión e intentá de nuevo.");
    }
  }

  if (!hidratado) {
    return (
      <div className="max-w-5xl mx-auto px-6 sm:px-10 py-12">
        <div className="text-burgundy/60 text-center py-20">Cargando checkout…</div>
      </div>
    );
  }

  if (items.length === 0) {
    return null; // redirección ya en marcha
  }

  return (
    <div className="max-w-5xl mx-auto px-6 sm:px-10 py-10">
      <Link
        href="/carrito"
        className="text-burgundy hover:text-gold text-sm inline-flex items-center gap-1.5 mb-6"
      >
        <ArrowLeft size={16} /> Volver al carrito
      </Link>

      <h1 className="font-heading text-3xl sm:text-4xl text-burgundy mb-8">Finalizar compra</h1>

      <form onSubmit={onSubmit} className="grid lg:grid-cols-[1fr,360px] gap-8">
        <div className="space-y-8">
          {/* Datos del cliente */}
          <section className="border border-burgundy/10 rounded-xl bg-cream/30 p-5 sm:p-6">
            <h2 className="font-heading text-xl text-burgundy mb-4">Tus datos</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <Campo label="Nombre y apellido" required>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={(e) => actualizar("nombre", e.target.value)}
                  className={inputClass}
                  required
                />
              </Campo>
              <Campo label="Email" required>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => actualizar("email", e.target.value)}
                  className={inputClass}
                  required
                />
              </Campo>
              <Campo label="Teléfono / WhatsApp">
                <input
                  type="tel"
                  value={form.telefono}
                  onChange={(e) => actualizar("telefono", e.target.value)}
                  className={inputClass}
                  placeholder="+54 9 11..."
                />
              </Campo>
            </div>
          </section>

          {/* Envío */}
          <section className="border border-burgundy/10 rounded-xl bg-cream/30 p-5 sm:p-6">
            <h2 className="font-heading text-xl text-burgundy mb-4">Entrega</h2>
            <div className="space-y-3">
              <OpcionEnvio
                value="showroom"
                seleccionada={form.envio}
                onSeleccionar={(v) => actualizar("envio", v)}
                titulo="Retiro en showroom"
                descripcion="Coordinamos por WhatsApp. Sin costo de envío."
                precio={0}
              />
              <OpcionEnvio
                value="domicilio"
                seleccionada={form.envio}
                onSeleccionar={(v) => actualizar("envio", v)}
                titulo="Envío a domicilio"
                descripcion="Correo Argentino — todo el país. Cotización al pagar."
                precio={null}
              />
              <OpcionEnvio
                value="sucursal"
                seleccionada={form.envio}
                onSeleccionar={(v) => actualizar("envio", v)}
                titulo="Retiro en sucursal de Correo Argentino"
                descripcion="Más económico que domicilio. Cotización al pagar."
                precio={null}
              />
            </div>

            {form.envio !== "showroom" && (
              <div className="mt-4 grid sm:grid-cols-2 gap-4">
                <Campo label="Dirección" required className="sm:col-span-2">
                  <input
                    type="text"
                    value={form.direccion}
                    onChange={(e) => actualizar("direccion", e.target.value)}
                    className={inputClass}
                    placeholder="Calle, número, depto"
                    required
                  />
                </Campo>
                <Campo label="Ciudad" required>
                  <input
                    type="text"
                    value={form.ciudad}
                    onChange={(e) => actualizar("ciudad", e.target.value)}
                    className={inputClass}
                    required
                  />
                </Campo>
                <Campo label="Código postal" required>
                  <input
                    type="text"
                    value={form.codigoPostal}
                    onChange={(e) => actualizar("codigoPostal", e.target.value)}
                    className={inputClass}
                    inputMode="numeric"
                    pattern="\d{4,5}"
                    required
                  />
                </Campo>
              </div>
            )}

            <Campo label="Notas (opcional)" className="mt-4">
              <textarea
                value={form.notas}
                onChange={(e) => actualizar("notas", e.target.value)}
                className={`${inputClass} h-20`}
                placeholder="Aclaraciones para la entrega"
              />
            </Campo>
          </section>

          {/* Pago — Payment Brick de Mercado Pago */}
          <section className="border border-burgundy/10 rounded-xl bg-cream/30 p-5 sm:p-6">
            <h2 className="font-heading text-xl text-burgundy mb-2">Pago</h2>
            <p className="text-sm text-ink/70 mb-4">
              Pagá con tarjeta de crédito, débito, transferencia o efectivo (Rapipago / Pago Fácil) —
              todo a través de Mercado Pago. <strong>3 cuotas sin interés disponibles.</strong>
            </p>

            {/* Si MP no está configurado (env var falta), mostrar fallback informativo. */}
            {!MP_ENABLED && (
              <div className="rounded-lg bg-gold/10 border border-gold/30 p-4 text-sm text-ink/80">
                💡 <strong>El pago online está en activación.</strong> Mientras tanto, coordinamos la
                compra por WhatsApp con tus datos.
              </div>
            )}

            {/* Cuando hay preferenceId, montar el Payment Brick. */}
            {MP_ENABLED && preferenceId && (
              <div className="mt-4">
                <Payment
                  initialization={{
                    amount: totalConEnvio,
                    preferenceId: preferenceId,
                  }}
                  customization={{
                    paymentMethods: {
                      creditCard: "all",
                      debitCard: "all",
                      mercadoPago: "all",
                      ticket: "all",
                      bankTransfer: "all",
                      maxInstallments: 3,
                    },
                    visual: {
                      style: {
                        theme: "default",
                        customVariables: {
                          baseColor: "var(--brand-burgundy)",
                        },
                      },
                    },
                  }}
                  onSubmit={async () => {
                    // El Brick maneja el flujo internamente cuando hay preferenceId.
                    // Aquí solo trackeamos y dejamos que MP redirija a back_urls.
                    trackEvent("payment_brick_submit", {
                      preference_id: preferenceId,
                      total: totalConEnvio,
                    });
                  }}
                  onError={(err) => {
                    console.error("[mp brick] error", err);
                    setError("Error al cargar el medio de pago. Refrescá la página o coordiná por WhatsApp.");
                  }}
                  onReady={() => {
                    // Brick montado y listo
                  }}
                />
              </div>
            )}

            {/* Cuando MP está configurado pero todavía no hay preferenceId, mostrar instrucción. */}
            {MP_ENABLED && !preferenceId && (
              <div className="rounded-lg bg-cream-light border border-burgundy/15 p-4 text-sm text-ink/70">
                Completá los datos arriba y tocá <strong>Confirmar y pagar</strong> para elegir el
                medio de pago.
              </div>
            )}
          </section>
        </div>

        {/* Resumen + CTA */}
        <aside className="lg:sticky lg:top-24 self-start space-y-4">
          <div className="border border-burgundy/10 rounded-xl bg-cream/30 p-5 sm:p-6">
            <h2 className="font-heading text-xl text-burgundy mb-4">Resumen</h2>

            <ul className="space-y-3 mb-4 max-h-56 overflow-y-auto pr-1">
              {items.map((it) => (
                <li key={it.lineId} className="flex gap-3 text-sm">
                  <div className="shrink-0 w-12 h-12 rounded bg-cream-light flex items-center justify-center overflow-hidden">
                    {it.fotoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={it.fotoUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <ShoppingBag size={16} className="text-burgundy/30" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-burgundy line-clamp-1 leading-tight">{it.nombre}</div>
                    <div className="text-ink/60 text-xs">
                      {it.cantidad} × {fmtMonto(it.precioUnit)}
                    </div>
                  </div>
                  <div className="text-burgundy font-semibold whitespace-nowrap">
                    {fmtMonto(it.precioUnit * it.cantidad)}
                  </div>
                </li>
              ))}
            </ul>

            <hr className="my-4 border-burgundy/10" />

            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink/70">Subtotal</dt>
                <dd className="font-semibold text-ink">{fmtMonto(total)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink/70">Envío</dt>
                <dd className="text-ink/60 italic">
                  {form.envio === "showroom" ? "Sin costo" : "se calcula al pagar"}
                </dd>
              </div>
            </dl>
            <hr className="my-4 border-burgundy/10" />
            <div className="flex justify-between items-baseline mb-4">
              <span className="font-heading text-lg text-burgundy">Total</span>
              <span className="font-heading text-2xl text-burgundy">{fmtMonto(totalConEnvio)}</span>
            </div>

            <button
              type="submit"
              disabled={enviando}
              className="inline-flex items-center justify-center gap-2 w-full text-center bg-burgundy hover:bg-burgundy-dark disabled:bg-burgundy/40 disabled:cursor-not-allowed text-cream-light font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              {enviando ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> Procesando…
                </>
              ) : (
                "Confirmar y pagar"
              )}
            </button>

            {error && (
              <div className="mt-3 text-sm text-burgundy bg-rose/10 border border-rose/30 rounded p-3">
                {error}
                {waLink && (
                  <a
                    href={waLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block mt-2 text-center bg-emerald-700 hover:bg-emerald-800 text-cream-light font-semibold py-2 rounded transition-colors"
                  >
                    Coordinar por WhatsApp
                  </a>
                )}
              </div>
            )}
          </div>
        </aside>
      </form>
    </div>
  );
}

const inputClass =
  "w-full rounded-md border border-burgundy/20 bg-cream-light px-3 py-2 text-ink placeholder:text-ink/30 focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent";

function Campo({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className || ""}`}>
      <span className="text-xs uppercase tracking-wider text-ink/60 mb-1 block">
        {label}
        {required && <span className="text-red-700 ml-0.5">*</span>}
      </span>
      {children}
    </label>
  );
}

function OpcionEnvio({
  value,
  seleccionada,
  onSeleccionar,
  titulo,
  descripcion,
  precio,
}: {
  value: "showroom" | "domicilio" | "sucursal";
  seleccionada: "showroom" | "domicilio" | "sucursal";
  onSeleccionar: (v: "showroom" | "domicilio" | "sucursal") => void;
  titulo: string;
  descripcion: string;
  precio: number | null;
}) {
  const activa = seleccionada === value;
  return (
    <button
      type="button"
      onClick={() => onSeleccionar(value)}
      aria-pressed={activa}
      className={`block w-full text-left rounded-lg border-2 p-4 transition-colors ${
        activa
          ? "border-burgundy bg-cream-light"
          : "border-burgundy/15 bg-cream-light/50 hover:border-burgundy/30"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="font-semibold text-burgundy">{titulo}</div>
          <div className="text-sm text-ink/70 mt-0.5">{descripcion}</div>
        </div>
        <div className="text-right shrink-0">
          {precio !== null && (
            <div className="font-semibold text-burgundy">
              {precio === 0 ? "Gratis" : fmtMonto(precio)}
            </div>
          )}
          {precio === null && <div className="text-xs text-ink/50 italic">a calcular</div>}
        </div>
      </div>
    </button>
  );
}
