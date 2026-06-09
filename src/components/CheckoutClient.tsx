"use client";

import { useState, useMemo, useEffect, useRef, useCallback, memo } from "react";
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
  const { items, total, totalTn, cantidad, hidratado } = useCart();

  const [form, setForm] = useState({
    nombre: "",
    email: "",
    telefono: "",
    direccion: "",
    ciudad: "",
    codigoPostal: "",
    notas: "",
    envio: "showroom" as "showroom" | "domicilio" | "sucursal",
    /** Método de pago: 'mp' = Payment Brick · 'whatsapp' = coordinar transferencia/efectivo */
    metodoPago: "mp" as "mp" | "whatsapp",
  });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preferenceId, setPreferenceId] = useState<string | null>(null);
  // Snapshot del payer congelado en el momento de crear la preference.
  // CRÍTICO: NO se lee del form en tiempo real porque eso dispararía
  // re-renders del Brick en cada keystroke → bug de bricks duplicados.
  const [payerSnapshot, setPayerSnapshot] = useState<{
    email: string;
    firstName: string;
    lastName: string;
  } | null>(null);
  // External reference de la preference activa — la usamos en process-payment
  // para que el webhook pueda matchear el pago con la preference original.
  const [externalRefSnapshot, setExternalRefSnapshot] = useState<string | null>(null);
  const [brickListo, setBrickListo] = useState(false);
  const brickContainerRef = useRef<HTMLDivElement | null>(null);

  // Asegurar SDK MP inicializado del lado cliente
  useEffect(() => {
    asegurarMPInit();
  }, []);

  // Al desmontar CheckoutClient entero, intentar unmount del Brick por si
  // quedó residual (defensa en profundidad — el cleanup principal vive en
  // PaymentBrickIsolated). Esto cubre navigation fuera del checkout.
  useEffect(() => {
    return () => {
      try {
        const w = window as unknown as {
          paymentBrickController?: { unmount?: () => void };
        };
        w.paymentBrickController?.unmount?.();
      } catch {
        /* defensive */
      }
    };
  }, []);

  // Reset estado del brick cuando se setea preferenceId a null (volver atrás).
  useEffect(() => {
    if (preferenceId === null) {
      setBrickListo(false);
    }
  }, [preferenceId]);

  // Cuando se monta el Brick, scrollear suavemente para que el usuario vea
  // el siguiente paso (los datos quedaron arriba).
  useEffect(() => {
    if (preferenceId && brickContainerRef.current) {
      brickContainerRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [preferenceId]);

  // Solo mostrar opción dual cuando hay diferencia real >= 1% entre TN y EFT.
  const muestraDualPago = totalTn > total * 1.01;

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

  // Total según método de pago elegido. MP cobra precio TN (cubre comisión + cuotas SI).
  // WhatsApp cobra precio EFT (20% off — cliente coordina transferencia directa).
  const totalConEnvio = useMemo(() => {
    // Por ahora envío manual a coordinar (0). En B.2 esto consulta /api/envios/cotizar.
    return form.metodoPago === "mp" ? totalTn : total;
  }, [total, totalTn, form.metodoPago]);

  // Callbacks estables para PaymentBrickIsolated — useCallback evita que las
  // props cambien en cada render del padre y rompan la memoización del Brick.
  const onBrickReady = useCallback(() => {
    setBrickListo(true);
  }, []);
  const onBrickError = useCallback((err: unknown) => {
    console.error("[mp brick] error", err);
    setError(
      "Hubo un problema al cargar el medio de pago. Tocá 'Editar datos' arriba y volvé a intentar, o coordiná por WhatsApp.",
    );
    setPreferenceId(null);
    setPayerSnapshot(null);
    setExternalRefSnapshot(null);
  }, []);

  // Procesa el pago cuando el usuario aprieta "Pagar" del Brick.
  //
  // Dos flows posibles según el método elegido en el Brick:
  // 1) Tarjeta crédito/débito → Brick tokeniza la tarjeta y nos pasa el
  //    `formData.token`. Llamamos a /api/mp/process-payment → MP procesa →
  //    devuelve status → redirigimos a /checkout/exito|pendiente|error.
  // 2) Mercado Pago (Wallet) → MP redirige automáticamente a su hosted
  //    checkout usando preferenceId + back_urls. Acá no recibimos token y
  //    el Brick maneja el redirect solo.
  //
  // El callback debe devolver Promise<void>. Si tira, el Brick muestra el
  // error inline (estado de "rechazado" que permite reintentar).
  const onBrickSubmitProcess = useCallback(
    async (args: {
      selectedPaymentMethod?: string;
      formData?: {
        token?: string;
        payment_method_id?: string;
        issuer_id?: string;
        installments?: number;
        transaction_amount?: number;
        payer?: { email?: string; identification?: { type?: string; number?: string } };
      };
    }) => {
      const formData = args?.formData || {};
      const selected = args?.selectedPaymentMethod || "";

      trackEvent("payment_brick_submit", {
        preference_id: preferenceId,
        selected_method: selected,
        total: totalConEnvio,
      });

      // Sin token = método Wallet (Mercado Pago). El Brick redirige por su
      // cuenta usando preferenceId + back_urls. Nada que hacer acá.
      if (!formData.token) {
        return;
      }

      if (!externalRefSnapshot) {
        throw new Error("Falta external reference. Recargá la página.");
      }

      // Procesar tarjeta vía nuestro endpoint
      const r = await fetch("/api/mp/process-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: formData.token,
          payment_method_id: formData.payment_method_id,
          issuer_id: formData.issuer_id,
          installments: formData.installments || 1,
          transaction_amount: formData.transaction_amount || totalConEnvio,
          payer: {
            email: formData.payer?.email || payerSnapshot?.email,
            identification: formData.payer?.identification,
          },
          externalReference: externalRefSnapshot,
          description: `Compra CasaAmor (${items.length} ${items.length === 1 ? "ítem" : "ítems"})`,
        }),
      });

      const data = await r.json().catch(() => ({}));

      if (!r.ok || !data?.ok) {
        // Tirar error → Brick muestra mensaje inline + permite reintentar
        // con otra tarjeta sin perder el form ni la preference.
        throw new Error(
          data?.message || "No pudimos procesar el pago. Probá con otra tarjeta o coordiná por WhatsApp.",
        );
      }

      const status = String(data.status || "");
      const paymentId = String(data.paymentId || "");

      trackEvent("payment_processed", { status, paymentId, preference_id: preferenceId });

      // Redirigir a la página de resultado correspondiente
      if (status === "approved") {
        router.push(`/checkout/exito?payment_id=${paymentId}`);
      } else if (status === "in_process" || status === "pending") {
        router.push(`/checkout/pendiente?payment_id=${paymentId}`);
      } else {
        // rejected / cancelled — dejar al Brick mostrar el error inline
        // para que el cliente pueda reintentar con otra tarjeta sin salir.
        throw new Error(
          data.statusDetail === "cc_rejected_insufficient_amount"
            ? "Saldo insuficiente. Probá con otra tarjeta."
            : data.statusDetail === "cc_rejected_bad_filled_security_code"
              ? "Código de seguridad incorrecto."
              : data.statusDetail === "cc_rejected_bad_filled_date"
                ? "Fecha de vencimiento incorrecta."
                : "Tarjeta rechazada. Probá con otra o coordiná por WhatsApp.",
        );
      }
    },
    [preferenceId, totalConEnvio, externalRefSnapshot, payerSnapshot, items.length, router],
  );

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
    trackEvent("add_payment_info", { total: totalConEnvio, metodo: form.metodoPago });

    // Branch WhatsApp: armar mensaje con items + datos cliente + monto EFT
    // y abrir wa.me. NO crear preference MP.
    if (form.metodoPago === "whatsapp") {
      const wa = String(config.contacto_whatsapp || "").replace(/[^0-9]/g, "");
      if (!wa) {
        setEnviando(false);
        setError("Falta configurar el WhatsApp del negocio en ConfigWeb.");
        return;
      }
      const lineas = items.map(
        (it) =>
          `• ${it.cantidad}× ${it.nombre}${it.variante ? ` (${it.variante})` : ""} - $${Math.round(
            it.precioUnit * it.cantidad,
          ).toLocaleString("es-AR")}`,
      );
      const envioTxt =
        form.envio === "showroom"
          ? "Retiro en showroom"
          : form.envio === "domicilio"
            ? `Envío a domicilio (${form.direccion}, ${form.ciudad}, CP ${form.codigoPostal})`
            : `Retiro en sucursal Correo Argentino (${form.ciudad}, CP ${form.codigoPostal})`;
      const msg = [
        `Hola CasaAmor! Quiero coordinar una compra por transferencia / efectivo:`,
        "",
        `*Cliente:* ${form.nombre}`,
        `*Email:* ${form.email}`,
        form.telefono ? `*Tel:* ${form.telefono}` : null,
        "",
        `*Productos:*`,
        ...lineas,
        "",
        `*Total efectivo / transferencia (20% OFF):* $${Math.round(total).toLocaleString("es-AR")}`,
        `*Entrega:* ${envioTxt}`,
        form.notas ? `*Notas:* ${form.notas}` : null,
      ]
        .filter(Boolean)
        .join("\n");
      const waUrl = `https://wa.me/${wa}?text=${encodeURIComponent(msg)}`;
      trackEvent("checkout_whatsapp_selected", { total });
      setEnviando(false);
      window.open(waUrl, "_blank");
      return;
    }

    // Branch MP: si MP no está configurado, fallback al WhatsApp con aviso.
    if (!MP_ENABLED) {
      setTimeout(() => {
        setEnviando(false);
        setError(
          "El pago online está en activación. Cambiá a 'Transferencia o efectivo' arriba y coordinamos por WhatsApp.",
        );
      }, 400);
      return;
    }

    // Crear preference MP server-side con los items + datos cliente
    // IMPORTANTE: enviar precioUnitTn (no precioUnit) para que MP cobre el precio
    // que cubre la comisión + cuotas SI.
    try {
      const r = await fetch("/api/mp/create-preference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((it) => ({
            sku: it.sku,
            nombre: it.nombre,
            cantidad: it.cantidad,
            precioUnit: it.precioUnitTn || it.precioUnit,
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
            "No pudimos iniciar el pago. Intentá de nuevo o probá la opción de transferencia.",
        );
        return;
      }
      // Snapshot del payer + externalReference JUSTO antes de montar el Brick.
      // A partir de acá el form puede cambiar (el cliente edita un campo) sin
      // afectar al Brick (que ya está congelado en memo con key=preferenceId).
      const partes = form.nombre.trim().split(/\s+/);
      setPayerSnapshot({
        email: form.email.trim(),
        firstName: partes[0] || "",
        lastName: partes.slice(1).join(" ") || "",
      });
      setExternalRefSnapshot((data.externalReference as string) || null);
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

          {/* Selector "¿Cómo querés pagar?" + Pago */}
          <section className="border border-burgundy/10 rounded-xl bg-cream/30 p-5 sm:p-6">
            <h2 className="font-heading text-xl text-burgundy mb-4">¿Cómo querés pagar?</h2>

            {muestraDualPago ? (
              <div className="space-y-3">
                {/* Opción MP */}
                <button
                  type="button"
                  onClick={() => {
                    actualizar("metodoPago", "mp");
                    // Si cambia de WA a MP, resetear preferenceId para que se cree de nuevo
                    if (form.metodoPago === "whatsapp") setPreferenceId(null);
                  }}
                  aria-pressed={form.metodoPago === "mp"}
                  className={`w-full text-left rounded-lg border-2 p-4 transition-colors ${
                    form.metodoPago === "mp"
                      ? "border-burgundy bg-cream-light"
                      : "border-burgundy/15 bg-cream-light/50 hover:border-burgundy/30"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-burgundy">Online con tarjeta o Mercado Pago</div>
                      <div className="text-sm text-ink/70 mt-0.5">
                        Tarjeta de crédito (3 cuotas SI) · débito · Mercado Pago
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-semibold text-burgundy">{fmtMonto(totalTn)}</div>
                      <div className="text-xs text-ink/50">3 cuotas SI</div>
                    </div>
                  </div>
                </button>

                {/* Opción WhatsApp / Transferencia */}
                <button
                  type="button"
                  onClick={() => {
                    actualizar("metodoPago", "whatsapp");
                    setPreferenceId(null);
                  }}
                  aria-pressed={form.metodoPago === "whatsapp"}
                  className={`w-full text-left rounded-lg border-2 p-4 transition-colors ${
                    form.metodoPago === "whatsapp"
                      ? "border-burgundy bg-gold/10"
                      : "border-burgundy/15 bg-cream-light/50 hover:border-burgundy/30"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-burgundy">
                        Transferencia bancaria o efectivo en showroom
                      </div>
                      <div className="text-sm text-ink/70 mt-0.5">
                        Coordinamos por WhatsApp. Te pasamos CBU y reservamos el pedido.
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-semibold text-burgundy">{fmtMonto(total)}</div>
                      <div className="text-xs text-emerald-700 font-medium">20% OFF</div>
                    </div>
                  </div>
                </button>
              </div>
            ) : (
              <p className="text-sm text-ink/70 mb-4">
                Pagá con tarjeta de crédito, débito, transferencia o efectivo (Rapipago / Pago Fácil) —
                todo a través de Mercado Pago. <strong>3 cuotas sin interés disponibles.</strong>
              </p>
            )}

            {/* Si MP no está configurado, mostrar fallback informativo (solo aplica a opción MP) */}
            {!MP_ENABLED && form.metodoPago === "mp" && (
              <div className="mt-4 rounded-lg bg-gold/10 border border-gold/30 p-4 text-sm text-ink/80">
                💡 <strong>El pago online está en activación.</strong> Cambiá a "Transferencia o
                efectivo" arriba para coordinar la compra por WhatsApp.
              </div>
            )}

            {/* Cuando hay preferenceId (rama MP), montar el Payment Brick. */}
            {MP_ENABLED && form.metodoPago === "mp" && preferenceId && (
              <div className="mt-4" ref={brickContainerRef}>
                {/* Header del step de pago: indica claramente que el brick es el único punto de submit */}
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="text-sm text-ink/70">
                    Elegí abajo cómo querés pagar y tocá <strong>Pagar</strong>.
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPreferenceId(null);
                      setPayerSnapshot(null);
                      setExternalRefSnapshot(null);
                      setError(null);
                    }}
                    className="text-xs text-burgundy hover:text-gold underline inline-flex items-center gap-1 shrink-0"
                  >
                    <ArrowLeft size={12} /> Editar datos
                  </button>
                </div>

                {/* Container del brick con overlay de loading hasta onReady.
                    El Brick está aislado en PaymentBrickIsolated (memo) y
                    montado con key={preferenceId} → se desmonta y vuelve a
                    montar SOLO cuando cambia la preference. Cualquier
                    re-render del padre por tipeo en el form NO lo afecta. */}
                <div className="relative min-h-[280px]">
                  {!brickListo && (
                    <div
                      className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-cream-light/95 rounded-lg border border-burgundy/15 z-10"
                      aria-live="polite"
                    >
                      <Loader2 className="animate-spin text-burgundy" size={28} />
                      <div className="text-sm text-burgundy/70">Cargando opciones de pago…</div>
                    </div>
                  )}
                  {payerSnapshot && (
                    <PaymentBrickIsolated
                      key={preferenceId}
                      preferenceId={preferenceId}
                      amount={totalConEnvio}
                      payerEmail={payerSnapshot.email}
                      payerFirstName={payerSnapshot.firstName}
                      payerLastName={payerSnapshot.lastName}
                      onReady={onBrickReady}
                      onError={onBrickError}
                      onSubmitProcess={onBrickSubmitProcess}
                    />
                  )}
                </div>
              </div>
            )}

            {/* Cuando MP está configurado y elegido pero todavía no hay preferenceId */}
            {MP_ENABLED && form.metodoPago === "mp" && !preferenceId && (
              <div className="mt-4 rounded-lg bg-cream-light border border-burgundy/15 p-4 text-sm text-ink/70">
                Completá los datos arriba y tocá <strong>Continuar al pago</strong> para elegir el
                medio de pago.
              </div>
            )}

            {/* Branch WhatsApp seleccionado: aviso pre-submit */}
            {form.metodoPago === "whatsapp" && (
              <div className="mt-4 rounded-lg bg-cream-light border border-burgundy/15 p-4 text-sm text-ink/70">
                Al tocar <strong>Confirmar</strong> abajo, se abre WhatsApp con tu pedido pre-armado.
                Coordinás transferencia o entrega con Mora/Lara directamente.
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
                <dd className="font-semibold text-ink">
                  {fmtMonto(form.metodoPago === "mp" ? totalTn : total)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink/70">Envío</dt>
                <dd className="text-ink/60 italic">
                  {form.envio === "showroom" ? "Sin costo" : "se calcula al pagar"}
                </dd>
              </div>
              {muestraDualPago && form.metodoPago === "whatsapp" && (
                <div className="flex justify-between text-emerald-700">
                  <dt>Descuento transferencia</dt>
                  <dd>−{fmtMonto(totalTn - total)}</dd>
                </div>
              )}
            </dl>
            <hr className="my-4 border-burgundy/10" />
            <div className="flex justify-between items-baseline mb-4">
              <span className="font-heading text-lg text-burgundy">Total</span>
              <span className="font-heading text-2xl text-burgundy">{fmtMonto(totalConEnvio)}</span>
            </div>

            {/* CTA principal: se oculta cuando ya se montó el Payment Brick
                (el Brick tiene su botón "Pagar" nativo, único punto de submit).
                Esto evita el bug del doble botón que creaba 2 preferences. */}
            {!(form.metodoPago === "mp" && preferenceId) && (
              <button
                type="submit"
                disabled={enviando}
                className={`inline-flex items-center justify-center gap-2 w-full text-center font-semibold py-3 px-6 rounded-lg transition-colors text-cream-light disabled:opacity-60 disabled:cursor-not-allowed ${
                  form.metodoPago === "whatsapp"
                    ? "bg-emerald-700 hover:bg-emerald-800"
                    : "bg-burgundy hover:bg-burgundy-dark"
                }`}
              >
                {enviando ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    {form.metodoPago === "whatsapp" ? "Abriendo WhatsApp…" : "Creando pago…"}
                  </>
                ) : form.metodoPago === "whatsapp" ? (
                  <>Coordinar por WhatsApp {fmtMonto(total)}</>
                ) : (
                  <>Continuar al pago {fmtMonto(totalTn)}</>
                )}
              </button>
            )}

            {/* Cuando el Brick está montado, mostrar un nota recordatoria abajo
                del resumen para que la dueña/cliente sepa dónde está el botón. */}
            {form.metodoPago === "mp" && preferenceId && (
              <div className="text-center text-xs text-ink/60 mt-2">
                ⬆️ Completá el pago en el formulario de arriba
              </div>
            )}

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

/**
 * Wrapper aislado del Payment Brick de MP.
 *
 * Crítico: este componente está MEMOIZADO y se monta con `key={preferenceId}`
 * desde el padre. Sin esto, cada keystroke del form (email, nombre, etc.)
 * re-renderea el CheckoutClient, lo que dispara un re-render del `<Payment />`
 * con un `initialization` object nuevo cada vez, y el SDK de MP monta un
 * segundo iframe sin desmontar el anterior — apareciendo 2 bricks superpuestos.
 *
 * El cleanup `window.paymentBrickController.unmount()` vive ACÁ, no en el padre,
 * para que se dispare exactamente cuando este componente se desmonta (cambio
 * de preferenceId o salida del checkout).
 *
 * Ver: https://www.mercadopago.com.co/developers/en/docs/checkout-bricks/additional-content/possible-errors
 */
type BrickSubmitArgs = {
  selectedPaymentMethod?: string;
  formData?: {
    token?: string;
    payment_method_id?: string;
    issuer_id?: string;
    installments?: number;
    transaction_amount?: number;
    payer?: { email?: string; identification?: { type?: string; number?: string } };
  };
};

type PaymentBrickProps = {
  preferenceId: string;
  amount: number;
  payerEmail: string;
  payerFirstName: string;
  payerLastName: string;
  onReady: () => void;
  onError: (err: unknown) => void;
  /**
   * Procesa el submit del Brick. Si la promesa rechaza, el Brick muestra
   * el error inline y permite reintentar (no perdemos la preference).
   */
  onSubmitProcess: (args: BrickSubmitArgs) => Promise<void>;
};

const PaymentBrickIsolated = memo(function PaymentBrickIsolated({
  preferenceId,
  amount,
  payerEmail,
  payerFirstName,
  payerLastName,
  onReady,
  onError,
  onSubmitProcess,
}: PaymentBrickProps) {
  // Cleanup específico del Brick al desmontar (cambio de preferenceId via
  // key={preferenceId} en el padre, o salida del checkout).
  useEffect(() => {
    return () => {
      try {
        const w = window as unknown as {
          paymentBrickController?: { unmount?: () => void };
        };
        w.paymentBrickController?.unmount?.();
      } catch {
        /* defensive */
      }
    };
  }, []);

  // initialization estable: estos valores vienen de props que son snapshot
  // (no del form en tiempo real). Aún así memoizamos para evitar referencias
  // nuevas en cada render del wrapper.
  const initialization = useMemo(
    () => ({
      amount,
      preferenceId,
      payer: {
        email: payerEmail,
        firstName: payerFirstName,
        lastName: payerLastName,
      },
    }),
    [amount, preferenceId, payerEmail, payerFirstName, payerLastName],
  );

  const customization = useMemo(
    () => ({
      paymentMethods: {
        creditCard: "all" as const,
        debitCard: "all" as const,
        mercadoPago: "all" as const,
        // ticket (Rapipago / Pago Fácil) deshabilitado: si el cliente quiere
        // pagar en efectivo / transferencia directa, usa la opción WhatsApp
        // del selector de arriba (precio EFT con 20% off, sin comisión MP).
        ticket: [] as never[],
        bankTransfer: "all" as const,
        maxInstallments: 3,
      },
      visual: {
        style: {
          theme: "default" as const,
          customVariables: {
            // Color de acento (botones, radio activo, etc).
            baseColor: "var(--brand-burgundy)",
            // Fondo del form del Brick — matchea el `bg-cream-light` del sitio.
            formBackgroundColor: "var(--brand-cream-light)",
            // Texto principal — usar el mismo "ink" de la paleta.
            textPrimaryColor: "var(--brand-ink)",
            // Borde sutil burgundy/15 para alinear con el resto del checkout.
            outlinePrimaryColor: "rgba(124, 36, 64, 0.15)",
            // Border-radius coherente con los cards del sitio (lg = 12px).
            borderRadiusMedium: "12px",
          },
        },
      },
    }),
    [],
  );

  // Forwardea el submit del Brick al callback del padre, preservando los args
  // que MP nos pasa ({selectedPaymentMethod, formData}). Si el callback rechaza,
  // el Brick muestra el error inline y permite reintentar sin recargar.
  const handleSubmit = useCallback(
    async (args: BrickSubmitArgs) => {
      await onSubmitProcess(args);
    },
    [onSubmitProcess],
  );

  return (
    <Payment
      initialization={initialization}
      customization={customization}
      onSubmit={handleSubmit}
      onError={onError}
      onReady={onReady}
    />
  );
});

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
