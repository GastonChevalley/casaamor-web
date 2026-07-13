"use client";

import { useState, useMemo, useEffect, useRef, useCallback, memo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ShoppingBag, Loader2 } from "lucide-react";
import { initMercadoPago, Payment } from "@mercadopago/sdk-react";
import type { ConfigWeb } from "@/lib/api";
import { useCart } from "@/contexts/CartContext";
import { fmtMonto, calcularPaqueteCarrito } from "@/lib/cart";
import { trackEvent } from "@/lib/analytics";

type OpcionEnvioRemota = {
  tipo: "domicilio" | "sucursal";
  precio: number;
  plazoMinDias: number;
  plazoMaxDias: number;
  transportista: string;
  descripcion: string;
};

const MP_PUBLIC_KEY = (process.env.NEXT_PUBLIC_MP_PUBLIC_KEY || "").trim();
const MP_ENABLED = MP_PUBLIC_KEY.length > 0;

// ─── Interruptor del envío con Correo Argentino ────────────────────────────
// true = cotización en vivo con la API de Mi Correo Negocios (MiCorreo v1). El
// useEffect llama a /api/envios/cotizar → esa ruta pega a la API oficial (o cae
// al estimador local si faltara alguna credencial). Requiere en Vercel las env
// vars MCN_API_USER / MCN_API_PASSWORD / MCN_CUSTOMER_ID (ver
// @/lib/correo-argentino). Poner en `false` vuelve a "Envío a convenir" por WhatsApp.
const ENVIO_CORREO_HABILITADO = true;

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
/**
 * Clave idempotente para el pedido por transferencia, estable entre remounts del
 * componente y reintentos tras error de red (evita crear dos pedidos + doble
 * reserva de stock). Se guarda en sessionStorage atada a la "firma" del carrito:
 * si el carrito cambia, se genera una clave nueva; si es el mismo, se reutiliza.
 * Se limpia al concretar el pedido (pwClearIdempotency).
 */
function pwIdempotencyKey(cartSig: string): string {
  try {
    const raw = sessionStorage.getItem("pw_idem");
    if (raw) {
      const o = JSON.parse(raw) as { key?: string; cartSig?: string };
      if (o && o.cartSig === cartSig && o.key) return o.key;
    }
  } catch {
    /* sessionStorage no disponible */
  }
  const key = `pw-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  try {
    sessionStorage.setItem("pw_idem", JSON.stringify({ key, cartSig }));
  } catch {
    /* ignore */
  }
  return key;
}
function pwClearIdempotency() {
  try {
    sessionStorage.removeItem("pw_idem");
  } catch {
    /* ignore */
  }
}

export function CheckoutClient({ config }: { config: ConfigWeb }) {
  const router = useRouter();
  const { items, total, totalTn, cantidad, hidratado, vaciar } = useCart();

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
  // Éxito del pedido por transferencia/efectivo (pantalla de confirmación).
  const [pedidoOk, setPedidoOk] = useState<{ pedidoId: string | null; waUrl: string; ok: boolean } | null>(null);
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
  // Snapshot del monto congelado al crear la preference. CRÍTICO: si pasáramos
  // `totalConEnvio` directo al Brick, cualquier edición posterior del CP o del
  // método de envío recalcula totalConEnvio → react.memo del PaymentBrickIsolated
  // detecta amount nuevo → re-render → useMemo de `initialization` da nuevo
  // objeto → SDK MP desmonta+remonta el iframe → card_token vivo se invalida
  // → siguiente "Pagar" devuelve 400 "Card Token not found". Congelar el monto
  // acá garantiza identidad estable mientras el Brick está montado.
  const [amountSnapshot, setAmountSnapshot] = useState<number | null>(null);
  const [brickListo, setBrickListo] = useState(false);
  const brickContainerRef = useRef<HTMLDivElement | null>(null);
  // Lock para prevenir doble-submit del Brick. Si el usuario apreta "Pagar" 2
  // veces o el SDK dispara onSubmit dos veces, el primer POST consume el
  // card_token y el segundo falla con "Card Token not found". Este ref bloquea
  // mientras hay una request en vuelo.
  const procesandoPagoRef = useRef<boolean>(false);
  // Lock por token: si el SDK MP dispara onSubmit dos veces con el MISMO
  // card_token (bug conocido GitHub #137), el segundo dispatch se ignora
  // ANTES del fetch, evitando que MP reciba 2 POSTs con el mismo token.
  // El boolean `procesandoPagoRef` no alcanza solo porque hay una micro-
  // ventana entre la primera lectura `=== false` y el set `= true` durante
  // la cual el segundo dispatch puede pasar el guard. Usar el token mismo
  // como sentinel ELIMINA esa ventana porque la comparación es contra un
  // string único por tarjeta.
  const ultimoTokenProcesadoRef = useRef<string | null>(null);

  // CRÍTICO — anti re-mount del Brick.
  // El SDK del Payment Brick tiene `onSubmit` en su useEffect deps internas
  // (verificado en source de @mercadopago/sdk-react). Si el callback cambia
  // de referencia, el Brick se DESMONTA Y REMONTA mid-flight, lo que puede
  // disparar onSubmit 2 veces → el primer POST consume el card_token → el
  // segundo POST falla con "Card Token not found".
  //
  // Solución: el callback `onBrickSubmitProcess` se memoiza con deps=[] y
  // lee los valores volátiles desde este ref (que se mantiene sincronizado
  // por un useEffect). Así el callback NUNCA cambia de identidad → el SDK
  // del Brick no remonta → token sigue válido → único POST exitoso.
  const submitDataRef = useRef<{
    preferenceId: string | null;
    externalRefSnapshot: string | null;
    payerEmail: string;
    totalConEnvio: number;
    itemsLength: number;
    // Items del carrito en formato simple (sku + nombre + cantidad + precio
    // + variante opcional). CRÍTICO para que Apps Script matchee SKU y
    // decremente stock en hoja Productos via additional_info.items de MP.
    cartItems: Array<{
      sku: string;
      nombre: string;
      cantidad: number;
      precioUnit: number;
      variante?: string;
    }>;
  }>({
    preferenceId: null,
    externalRefSnapshot: null,
    payerEmail: "",
    totalConEnvio: 0,
    itemsLength: 0,
    cartItems: [],
  });
  // Key para force-remount del Brick como fallback si algo se atasca.
  // Bumpeamos en onBrickError (workaround documentado por MP: discussion #137).
  const [paymentKey, setPaymentKey] = useState<string>("1");

  // ─── Cotización envío Correo Argentino (B.2) ──────────────────────────────
  const [cotizacion, setCotizacion] = useState<{
    domicilio: OpcionEnvioRemota | null;
    sucursal: OpcionEnvioRemota | null;
  }>({ domicilio: null, sucursal: null });
  const [cargandoCotizacion, setCargandoCotizacion] = useState(false);
  const [errorCotizacion, setErrorCotizacion] = useState<string | null>(null);

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
      procesandoPagoRef.current = false; // liberar lock al desmontar brick
    }
  }, [preferenceId]);

  // Cuando se monta el Brick, scrollear al contenedor. Usamos scrollIntoView
  // simple — el offset del header sticky lo maneja `scroll-mt-*` en el JSX
  // (CSS scroll-margin-top), que es lo único que respeta correctamente el
  // browser mobile cuando el address bar se contrae con el scroll.
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
    if (hidratado && items.length === 0 && !pedidoOk) {
      router.replace("/productos");
    }
  }, [hidratado, items.length, router, pedidoOk]);

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

  // Costo del envío según opción elegida + cotización vigente.
  const costoEnvio = useMemo(() => {
    if (!ENVIO_CORREO_HABILITADO) return 0;  // envío a convenir → sin cargo en el checkout
    if (form.envio === "showroom") return 0;
    const opc = cotizacion[form.envio];
    return opc?.precio || 0;
  }, [form.envio, cotizacion]);

  // Total según método de pago elegido. MP cobra precio TN (cubre comisión + cuotas SI).
  // WhatsApp cobra precio EFT (20% off — cliente coordina transferencia directa).
  // Suma el costo del envío al final (showroom = 0).
  const totalConEnvio = useMemo(() => {
    const subtotal = form.metodoPago === "mp" ? totalTn : total;
    return subtotal + costoEnvio;
  }, [total, totalTn, form.metodoPago, costoEnvio]);

  // Cotizar envío Correo Argentino con debounce — se dispara cuando el CP es
  // válido (4-5 dígitos) y el método de envío es domicilio/sucursal. Reusa
  // cotización entre cambios de "domicilio" y "sucursal" porque el endpoint
  // devuelve ambas en una sola llamada.
  useEffect(() => {
    if (!ENVIO_CORREO_HABILITADO) return;  // envío a convenir → no se cotiza con Correo
    if (form.envio === "showroom") {
      setCotizacion({ domicilio: null, sucursal: null });
      setErrorCotizacion(null);
      setCargandoCotizacion(false);
      return;
    }
    const cp = (form.codigoPostal || "").trim();
    if (!/^\d{4,5}$/.test(cp) || items.length === 0) {
      setCotizacion({ domicilio: null, sucursal: null });
      setErrorCotizacion(null);
      setCargandoCotizacion(false);
      return;
    }
    const paquete = calcularPaqueteCarrito(items);
    setCargandoCotizacion(true);
    setErrorCotizacion(null);
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const r = await fetch("/api/envios/cotizar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: ctrl.signal,
          body: JSON.stringify({
            cpDestino: cp,
            pesoGramos: paquete.pesoGramos,
            altoCm: paquete.altoCm,
            anchoCm: paquete.anchoCm,
            profundidadCm: paquete.profundidadCm,
            tipoEntrega: "ambas",
          }),
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok || !data?.ok) {
          throw new Error(data?.message || "No pudimos cotizar el envío.");
        }
        const ops: OpcionEnvioRemota[] = Array.isArray(data.opciones) ? data.opciones : [];
        setCotizacion({
          domicilio: ops.find((o) => o.tipo === "domicilio") || null,
          sucursal: ops.find((o) => o.tipo === "sucursal") || null,
        });
        setCargandoCotizacion(false);
      } catch (err) {
        if ((err as { name?: string })?.name === "AbortError") return;
        setErrorCotizacion(
          err instanceof Error ? err.message : "No pudimos cotizar el envío.",
        );
        setCotizacion({ domicilio: null, sucursal: null });
        setCargandoCotizacion(false);
      }
    }, 400);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [form.codigoPostal, form.envio, items]);

  // Sincronizar submitDataRef con los valores actuales — corre en cada render
  // pero solo TOCA el ref (no dispara re-render). El callback onBrickSubmit
  // siempre leerá los valores actualizados aunque su identidad nunca cambie.
  useEffect(() => {
    submitDataRef.current = {
      preferenceId,
      externalRefSnapshot,
      payerEmail: payerSnapshot?.email || "",
      // El monto que se cobra es el congelado al crear la preference, no el
      // recalculado en vivo. Si cambiamos a totalConEnvio acá, podríamos
      // cobrar un monto distinto al que vio el Brick → inconsistencia.
      totalConEnvio: amountSnapshot ?? totalConEnvio,
      itemsLength: items.length,
      // Snapshot del carrito para que el webhook tenga el detalle de SKUs.
      cartItems: items.map((it) => ({
        sku: it.sku,
        nombre: it.nombre,
        cantidad: it.cantidad,
        precioUnit: it.precioUnit,
        variante: it.variante,
      })),
    };
  });

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
    // Force-remount del Brick (workaround MP discussion #137).
    setPaymentKey(String(Date.now()));
    setPreferenceId(null);
    setPayerSnapshot(null);
    setExternalRefSnapshot(null);
    setAmountSnapshot(null);
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
      // CRÍTICO: leer valores volátiles desde el REF, no desde closure.
      // Si los leyera desde closure, el useCallback necesitaría deps que
      // cambian (preferenceId, totalConEnvio, etc.) → cada render recrearía
      // este callback → el SDK del Brick lo ve como prop nueva → DESMONTA Y
      // REMONTA el Brick mid-flight → doble dispatch de onSubmit → primer
      // POST consume el card_token → segundo POST falla con "Card Token not
      // found".
      const snap = submitDataRef.current;
      const formData = args?.formData || {};
      const selected = args?.selectedPaymentMethod || "";

      // Limpiar error previo si está intentando de nuevo
      setError(null);

      // eslint-disable-next-line no-console
      console.log("[checkout] onSubmit recibido", {
        selected,
        hasToken: !!formData.token,
        paymentMethodId: formData.payment_method_id,
        installments: formData.installments,
        amount: formData.transaction_amount,
      });

      trackEvent("payment_brick_submit", {
        preference_id: snap.preferenceId,
        selected_method: selected,
        total: snap.totalConEnvio,
      });

      // Sin token = método Wallet (Mercado Pago). El Brick redirige por su
      // cuenta usando preferenceId + back_urls. Nada que hacer acá.
      if (!formData.token) {
        // eslint-disable-next-line no-console
        console.log("[checkout] sin token, Wallet redirige por back_urls");
        return;
      }

      if (!snap.externalRefSnapshot) {
        const msg = "Falta external reference. Tocá 'Editar datos' y volvé a continuar al pago.";
        setError(msg);
        throw new Error(msg);
      }

      // CRÍTICO — Lock por token (Addendum 88 B.1.x). Si el SDK MP dispara
      // onSubmit dos veces con el MISMO card_token (bug GitHub #137), la
      // segunda llamada se silencia ANTES del fetch. Confirmado por el
      // reporte de Metrics de MP del 14/06: dos POSTs simultáneos a
      // /v1/payments en el mismo segundo, uno con 201 y otro con 400
      // "Card Token not found" — clásico doble dispatch.
      if (ultimoTokenProcesadoRef.current === formData.token) {
        // eslint-disable-next-line no-console
        console.warn("[checkout] doble dispatch del mismo token ignorado en silencio");
        return; // return (no throw) — el primer dispatch ya está procesando
      }
      ultimoTokenProcesadoRef.current = formData.token;

      // Lock booleano secundario para reintentos con OTRA tarjeta mientras
      // la primera está en vuelo (race más rara, pero defensa en profundidad).
      if (procesandoPagoRef.current) {
        // eslint-disable-next-line no-console
        console.warn("[checkout] segundo submit detectado, REJECT para que el Brick resetee");
        throw new Error("Procesando un pago anterior. Esperá unos segundos.");
      }
      procesandoPagoRef.current = true;

      // Procesar tarjeta vía nuestro endpoint
      let r: Response;
      try {
        r = await fetch("/api/mp/process-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            token: formData.token,
            payment_method_id: formData.payment_method_id,
            issuer_id: formData.issuer_id,
            installments: formData.installments || 1,
            transaction_amount: formData.transaction_amount || snap.totalConEnvio,
            payer: {
              email: formData.payer?.email || snap.payerEmail,
              identification: formData.payer?.identification,
            },
            externalReference: snap.externalRefSnapshot,
            description: `Compra CasaAmor (${snap.itemsLength} ${snap.itemsLength === 1 ? "ítem" : "ítems"})`,
            // CRÍTICO: items del carrito → MP guarda additional_info.items →
            // webhook recibe SKU + nombre + cantidad → Apps Script decrementa
            // stock en Productos. Sin esto, la venta entra sin detalle y el
            // stock no se descuenta.
            items: snap.cartItems,
          }),
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[checkout] fetch falló (red/CORS/SSO)", err);
        procesandoPagoRef.current = false; // liberar lock para reintento
        const msg = "No pudimos contactar el servidor de pagos. Verificá tu conexión y reintentá.";
        setError(msg);
        throw new Error(msg);
      }

      // eslint-disable-next-line no-console
      console.log("[checkout] response status", r.status);

      const text = await r.text().catch(() => "");
      let data: {
        ok?: boolean;
        message?: string;
        status?: string;
        paymentId?: string;
        statusDetail?: string;
        error?: string;
        debug?: { mpHttpStatus?: number; mpMessage?: string; mpCausa?: string };
      } = {};
      try {
        data = JSON.parse(text);
      } catch {
        // Si la respuesta no es JSON (ej. HTML de Vercel SSO o error de Next),
        // mostramos algo útil en lugar de "tarjeta rechazada".
        const isHtml = text.toLowerCase().includes("<!doctype html") || text.toLowerCase().includes("<html");
        const msg = isHtml
          ? "El servidor devolvió una página HTML en lugar de JSON (probablemente login Vercel o ruta inexistente). Avisame en pantalla."
          : `Respuesta del servidor no es JSON (HTTP ${r.status}): ${text.slice(0, 200)}`;
        setError(msg);
        // eslint-disable-next-line no-console
        console.error("[checkout] respuesta no-JSON", { status: r.status, body: text.slice(0, 500) });
        throw new Error(msg);
      }

      if (!r.ok || !data?.ok) {
        // eslint-disable-next-line no-console
        console.error("[checkout] backend devolvió error", { status: r.status, data });
        procesandoPagoRef.current = false; // liberar lock para reintento
        const dbg = data?.debug;
        // Detectar errores conocidos del flow (token expirado / no encontrado)
        // y dar un mensaje accionable en lugar del genérico de MP.
        const causaMP = String(dbg?.mpCausa || dbg?.mpMessage || "").toLowerCase();
        const esTokenInvalido =
          causaMP.includes("card token not found") ||
          causaMP.includes("invalid token") ||
          causaMP.includes("token has expired");
        let msg: string;
        if (esTokenInvalido) {
          msg =
            "Tu tarjeta se desincronizó (el token expira a los ~7 minutos). " +
            "Tocá 'Editar datos' arriba, volvé a 'Continuar al pago' y completá la tarjeta de nuevo SIN demorarte. " +
            "Apretá 'Pagar' una sola vez.";
        } else {
          // Mensaje principal viene del backend (ya incluye detalle MP si aplica)
          const baseMsg =
            data?.message ||
            data?.error ||
            `Error HTTP ${r.status}. Probá con otra tarjeta o coordiná por WhatsApp.`;
          // Si el backend pasó debug detallado, anexarlo al mensaje visible
          msg = dbg
            ? `${baseMsg}\n\n🔍 Detalle técnico:\n• MP HTTP ${dbg.mpHttpStatus}: ${dbg.mpMessage || "(sin mensaje)"}${dbg.mpCausa ? `\n• Causa: ${dbg.mpCausa}` : ""}`
            : baseMsg;
        }
        setError(msg);
        throw new Error(msg);
      }

      const status = String(data.status || "");
      const paymentId = String(data.paymentId || "");

      // eslint-disable-next-line no-console
      console.log("[checkout] pago procesado", { status, paymentId });
      trackEvent("payment_processed", { status, paymentId, preference_id: snap.preferenceId });

      // Redirigir a la página de resultado correspondiente
      if (status === "approved") {
        router.push(`/checkout/exito?payment_id=${paymentId}`);
      } else if (status === "in_process" || status === "pending") {
        router.push(`/checkout/pendiente?payment_id=${paymentId}`);
      } else {
        // rejected / cancelled — dejar al Brick mostrar el error inline
        // para que el cliente pueda reintentar con otra tarjeta sin salir.
        const sd = String(data.statusDetail || "");
        // Log VISIBLE para diagnóstico — la cliente puede mandar screenshot
        // de DevTools Console con esta línea y sabemos exactamente la causa.
        // eslint-disable-next-line no-console
        console.error("[checkout][MP RECHAZO]", {
          status,
          status_detail: sd,
          paymentId,
          preference_id: snap.preferenceId,
        });
        const friendly =
          sd === "cc_rejected_insufficient_amount"
            ? "Saldo insuficiente. Probá con otra tarjeta."
            : sd === "cc_rejected_bad_filled_security_code"
              ? "Código de seguridad (CVV) incorrecto. Revisá los 3 números del dorso."
              : sd === "cc_rejected_bad_filled_date"
                ? "Fecha de vencimiento incorrecta."
                : sd === "cc_rejected_bad_filled_card_number"
                  ? "Número de tarjeta incorrecto. Revisalo y reintentá."
                  : sd === "cc_rejected_bad_filled_other"
                    ? "Algún dato de la tarjeta es incorrecto. Revisá todos los campos."
                    : sd === "cc_rejected_call_for_authorize"
                      ? "Tu banco bloqueó el pago por seguridad. Llamá al 0800 del banco, autorizá un cobro de CasaAmor y reintentá. (Es común en el primer cobro a un comercio nuevo)."
                      : sd === "cc_rejected_high_risk"
                        ? "Mercado Pago detectó riesgo. Probá con otra tarjeta o coordiná por WhatsApp."
                        : sd === "cc_rejected_card_disabled"
                          ? "Tu tarjeta no está activa. Llamá al banco para habilitarla."
                          : sd === "cc_rejected_blacklist"
                            ? "Esta tarjeta no puede usarse para pagar. Probá con otra."
                            : sd === "cc_rejected_duplicated_payment"
                              ? "Ya hiciste este pago hace unos segundos. Esperá unos minutos antes de reintentar."
                              : sd === "cc_rejected_max_attempts"
                                ? "Llegaste al máximo de intentos. Probá con otra tarjeta o esperá unos minutos."
                                : sd === "cc_rejected_other_reason"
                                  ? "Tu banco rechazó el pago. Llamá al banco o probá con otra tarjeta."
                                  : `Pago rechazado por MP (código: ${sd || "desconocido"}). Probá con otra tarjeta o coordiná por WhatsApp.`;
        procesandoPagoRef.current = false; // liberar lock para reintento
        setError(friendly);
        throw new Error(friendly);
      }
    },
    // CRÍTICO: deps vacías. Todo lo volátil viene de submitDataRef + router
    // es estable. El callback nunca cambia de identidad → el SDK del Brick
    // no remonta → token mantiene validez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [router],
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
          ? "Retiro en local (Benavidez / Pacheco)"
          : form.envio === "domicilio"
            ? `Envío a domicilio${ENVIO_CORREO_HABILITADO ? "" : " (a convenir)"} (${form.direccion}, ${form.ciudad}, CP ${form.codigoPostal})`
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
        costoEnvio > 0
          ? `*Subtotal productos:* $${Math.round(total).toLocaleString("es-AR")}`
          : null,
        costoEnvio > 0 ? `*Envío:* $${Math.round(costoEnvio).toLocaleString("es-AR")}` : null,
        `*Total a transferir:* $${Math.round(total + costoEnvio).toLocaleString("es-AR")}`,
        `*Entrega:* ${envioTxt}`,
        form.notas ? `*Notas:* ${form.notas}` : null,
      ]
        .filter(Boolean)
        .join("\n");
      const waUrl = `https://wa.me/${wa}?text=${encodeURIComponent(msg)}`;
      trackEvent("checkout_whatsapp_selected", { total });

      // Crear el pedido en el backend: lo registra como "pendiente de pago",
      // RESERVA el stock y manda el email con los datos para transferir. La clave
      // idempotente se deriva del carrito para no duplicar el pedido en reintentos.
      const cartSig = items.map((i) => `${i.sku}:${i.cantidad}`).join("|") + "|" + form.email;
      const idempotencyKey = pwIdempotencyKey(cartSig);
      const entregaDetalle =
        form.envio === "showroom"
          ? ""
          : `${form.direccion}, ${form.ciudad}, CP ${form.codigoPostal}`;
      try {
        const r = await fetch("/api/pedidos/crear", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cliente: { nombre: form.nombre, email: form.email, telefono: form.telefono },
            items: items.map((it) => ({
              sku: it.sku,
              nombre: it.nombre,
              cantidad: it.cantidad,
              precioUnit: it.precioUnit,
              variante: it.variante,
            })),
            total,
            envioCosto: costoEnvio,
            entrega: form.envio,
            entregaDetalle,
            notas: form.notas,
            idempotencyKey,
          }),
        });
        const data = await r.json().catch(() => ({}));
        setEnviando(false);
        if (r.ok && data?.ok) {
          trackEvent("checkout_pedido_creado", { total });
          pwClearIdempotency();
          vaciar();
          setPedidoOk({ pedidoId: data.pedidoId || null, waUrl, ok: true });
          window.scrollTo(0, 0);
          return;
        }
        // No se pudo registrar el pedido: no perder la venta → igual ofrecemos
        // coordinar por WhatsApp (el carrito se mantiene por si quiere reintentar).
        trackEvent("checkout_pedido_error", { total });
        setPedidoOk({ pedidoId: null, waUrl, ok: false });
        window.scrollTo(0, 0);
        return;
      } catch {
        setEnviando(false);
        setPedidoOk({ pedidoId: null, waUrl, ok: false });
        window.scrollTo(0, 0);
        return;
      }
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
      // Congelar el monto que vio el Brick. NUNCA leer totalConEnvio en el JSX
      // del Brick — esa ref fluctúa con CP/envío y dispara remounts mid-flight.
      setAmountSnapshot(totalConEnvio);
      setPreferenceId(data.preferenceId as string);
    } catch {
      setEnviando(false);
      setError("Error de red. Verificá tu conexión e intentá de nuevo.");
    }
  }

  // Pantalla de confirmación tras crear un pedido por transferencia/efectivo.
  if (pedidoOk) {
    return (
      <div className="max-w-xl mx-auto px-6 sm:px-10 py-16 text-center">
        <div className="text-5xl mb-4">{pedidoOk.ok ? "🧾" : "💬"}</div>
        <h1 className="font-heading text-3xl text-burgundy mb-3">
          {pedidoOk.ok ? "¡Pedido recibido!" : "Coordinemos por WhatsApp"}
        </h1>
        {pedidoOk.ok ? (
          <p className="text-ink/70 mb-2">
            Te enviamos un email con los datos para transferir.
            {pedidoOk.pedidoId ? (
              <>
                {" "}
                Tu pedido <b className="text-burgundy">{pedidoOk.pedidoId}</b> queda reservado.
              </>
            ) : null}
          </p>
        ) : (
          <p className="text-ink/70 mb-2">
            No pudimos registrar el pedido automáticamente, pero escribinos por WhatsApp y lo
            coordinamos en el momento. Tu carrito quedó guardado.
          </p>
        )}
        <p className="text-ink/60 text-sm mb-8">
          {pedidoOk.ok
            ? "También podés mandarnos el comprobante directo por WhatsApp:"
            : "Tocá el botón para abrir el chat con nosotros:"}
        </p>
        <a
          href={pedidoOk.waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-[#25D366] hover:brightness-95 text-white font-semibold px-6 py-3 rounded-lg transition"
        >
          Abrir WhatsApp
        </a>
        <div className="mt-8">
          <Link href="/productos" className="text-burgundy hover:text-gold text-sm">
            Seguir comprando
          </Link>
        </div>
      </div>
    );
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
                titulo="Retiro en local"
                descripcion="Sin cargo · Benavidez / Pacheco, con cita previa. Coordinamos por WhatsApp."
                precio={0}
              />
              {ENVIO_CORREO_HABILITADO ? (
                <>
                  <OpcionEnvio
                    value="domicilio"
                    seleccionada={form.envio}
                    onSeleccionar={(v) => actualizar("envio", v)}
                    titulo="Envío a domicilio"
                    descripcion={
                      cotizacion.domicilio
                        ? `Correo Argentino — Llega en ${cotizacion.domicilio.plazoMinDias}-${cotizacion.domicilio.plazoMaxDias} días hábiles.`
                        : "Correo Argentino — Ingresá el CP para cotizar."
                    }
                    precio={cotizacion.domicilio?.precio ?? null}
                  />
                  <OpcionEnvio
                    value="sucursal"
                    seleccionada={form.envio}
                    onSeleccionar={(v) => actualizar("envio", v)}
                    titulo="Retiro en sucursal de Correo Argentino"
                    descripcion={
                      cotizacion.sucursal
                        ? `Más económico que domicilio. Llega en ${cotizacion.sucursal.plazoMinDias}-${cotizacion.sucursal.plazoMaxDias} días hábiles.`
                        : "Más económico que domicilio. Ingresá el CP para cotizar."
                    }
                    precio={cotizacion.sucursal?.precio ?? null}
                  />
                </>
              ) : (
                <OpcionEnvio
                  value="domicilio"
                  seleccionada={form.envio}
                  onSeleccionar={(v) => actualizar("envio", v)}
                  titulo="Envío a domicilio"
                  descripcion="A convenir — coordinamos el costo por WhatsApp según tu localidad."
                  precio={null}
                  textoSinPrecio="a convenir"
                />
              )}
            </div>

            {/* Feedback de cotización (loading / error) — solo con Correo Argentino activo */}
            {ENVIO_CORREO_HABILITADO && form.envio !== "showroom" && (
              <div className="mt-3 text-sm">
                {cargandoCotizacion && (
                  <div className="inline-flex items-center gap-2 text-ink/70">
                    <Loader2 size={14} className="animate-spin" />
                    Cotizando envío…
                  </div>
                )}
                {!cargandoCotizacion && errorCotizacion && (
                  <div className="text-burgundy bg-rose/10 border border-rose/30 rounded p-2">
                    {errorCotizacion}
                  </div>
                )}
                {!cargandoCotizacion && !errorCotizacion && !cotizacion.domicilio && !cotizacion.sucursal && (
                  <div className="text-ink/60 italic">
                    Ingresá el código postal abajo para ver el costo del envío.
                  </div>
                )}
              </div>
            )}

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
                    if (form.metodoPago === "whatsapp") {
                      setPreferenceId(null);
                      setAmountSnapshot(null);
                    }
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
                    setAmountSnapshot(null);
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
                      <div className="text-xs text-emerald-700 font-medium">✓ pagás menos</div>
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
              <div
                className="mt-4 scroll-mt-[160px] md:scroll-mt-[110px]"
                ref={brickContainerRef}
              >
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
                      setAmountSnapshot(null);
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
                  {payerSnapshot && amountSnapshot !== null && (
                    <PaymentBrickIsolated
                      // key compuesto: preferenceId + paymentKey. Bumpear paymentKey
                      // (en onBrickError) fuerza un remount limpio del Brick.
                      key={`${preferenceId}-${paymentKey}`}
                      preferenceId={preferenceId}
                      // CRÍTICO: amountSnapshot (no totalConEnvio). Si pasáramos
                      // totalConEnvio acá, cualquier edición posterior del CP o
                      // método de envío recalcula amount → react.memo deja
                      // pasar el render → useMemo de initialization da nuevo
                      // objeto → SDK MP remonta el iframe → token vivo se
                      // invalida → 400 "Card Token not found" al apretar Pagar.
                      amount={amountSnapshot}
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
              {items.map((it) => {
                // El precio del item se adapta al método elegido, igual que el
                // subtotal y el total. Si es online (mp) → precio tarjeta; si es
                // transferencia/efectivo (whatsapp) → precio efectivo. Así el
                // resumen SIEMPRE cuadra (item × cantidad = subtotal = total).
                const precioItem =
                  form.metodoPago === "mp" ? it.precioUnitTn || it.precioUnit : it.precioUnit;
                return (
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
                        {it.cantidad} × {fmtMonto(precioItem)}
                      </div>
                    </div>
                    <div className="text-burgundy font-semibold whitespace-nowrap">
                      {fmtMonto(precioItem * it.cantidad)}
                    </div>
                  </li>
                );
              })}
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
                <dd className={costoEnvio > 0 ? "font-semibold text-ink" : "text-ink/60 italic"}>
                  {form.envio === "showroom"
                    ? "Sin costo"
                    : cargandoCotizacion
                      ? "Cotizando…"
                      : costoEnvio > 0
                        ? fmtMonto(costoEnvio)
                        : "Ingresá CP"}
                </dd>
              </div>
              {/* Nota del método elegido (sin línea de "descuento" para no
                  descuadrar: el subtotal ya está en el precio del método, y la
                  comparación de precios vive en el selector de arriba). */}
              {muestraDualPago && (
                <div className="flex justify-between text-ink/55 text-xs pt-0.5">
                  <dt>
                    {form.metodoPago === "mp"
                      ? "Pagás online con tarjeta / MP"
                      : "Pagás por transferencia o efectivo"}
                  </dt>
                  <dd>
                    {form.metodoPago === "mp"
                      ? `o ${fmtMonto(total)} por transferencia`
                      : `✓ pagás menos`}
                  </dd>
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
              <div className="mt-3 text-sm text-burgundy bg-rose/10 border border-rose/30 rounded p-3 whitespace-pre-wrap">
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
  textoSinPrecio,
}: {
  value: "showroom" | "domicilio" | "sucursal";
  seleccionada: "showroom" | "domicilio" | "sucursal";
  onSeleccionar: (v: "showroom" | "domicilio" | "sucursal") => void;
  titulo: string;
  descripcion: string;
  precio: number | null;
  textoSinPrecio?: string;
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
          {precio === null && <div className="text-xs text-ink/50 italic">{textoSinPrecio ?? "a calcular"}</div>}
        </div>
      </div>
    </button>
  );
}
