"use client";

import Link from "next/link";
import { useEffect } from "react";
import { CheckCircle2, Clock, XCircle, ArrowRight, MessageCircle } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { trackEvent } from "@/lib/analytics";

/**
 * Páginas de resultado del checkout — todas son client components porque
 * limpian el carrito al montar y disparan eventos GA4. Comparten estructura
 * visual para mantener consistencia.
 *
 * MP redirige acá con query params típicos: payment_id, status,
 * preference_id, external_reference. Solo usamos payment_id por ahora.
 */

function PageShell({
  iconColor,
  Icon,
  title,
  subtitle,
  children,
}: {
  iconColor: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  subtitle: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="max-w-2xl mx-auto px-6 sm:px-10 py-16 text-center">
      <div
        className={`inline-flex items-center justify-center w-20 h-20 rounded-full ${iconColor} mb-6`}
      >
        <Icon size={40} className="text-cream-light" />
      </div>
      <h1 className="font-heading text-3xl sm:text-4xl text-burgundy mb-3">{title}</h1>
      <p className="text-ink/70 max-w-md mx-auto mb-8">{subtitle}</p>
      {children}
    </div>
  );
}

export function CheckoutExitoClient({ paymentId }: { paymentId: string }) {
  const { vaciar } = useCart();
  useEffect(() => {
    // Solo limpiar el carrito si el éxito viene con un payment_id real (no acceso directo).
    if (paymentId) {
      vaciar();
      trackEvent("purchase", { payment_id: paymentId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentId]);

  return (
    <PageShell
      iconColor="bg-emerald-700"
      Icon={CheckCircle2}
      title="¡Listo! Pago confirmado"
      subtitle="Tu pago se acreditó correctamente. Te enviamos un email con el detalle de la compra y los pasos para recibir o retirar tus productos."
    >
      {paymentId && (
        <p className="text-xs text-ink/50 mb-6">
          Número de operación: <code className="font-mono">{paymentId}</code>
        </p>
      )}
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link
          href="/productos"
          className="inline-flex items-center justify-center gap-2 bg-burgundy hover:bg-burgundy-dark text-cream-light font-semibold py-3 px-6 rounded-lg transition-colors"
        >
          Seguir comprando <ArrowRight size={18} />
        </Link>
        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 bg-cream-light hover:bg-cream text-burgundy border border-burgundy/20 font-semibold py-3 px-6 rounded-lg transition-colors"
        >
          Volver al inicio
        </Link>
      </div>
    </PageShell>
  );
}

export function CheckoutPendienteClient({ paymentId }: { paymentId: string }) {
  useEffect(() => {
    if (paymentId) trackEvent("purchase_pending", { payment_id: paymentId });
  }, [paymentId]);

  return (
    <PageShell
      iconColor="bg-amber-600"
      Icon={Clock}
      title="Tu pago está en proceso"
      subtitle="Cuando tu pago se confirme, vas a recibir un email con la confirmación y los pasos siguientes. Si pagás en efectivo (Rapipago/Pago Fácil), recordá completarlo dentro de las próximas 72 horas."
    >
      {paymentId && (
        <p className="text-xs text-ink/50 mb-6">
          Número de operación: <code className="font-mono">{paymentId}</code>
        </p>
      )}
      <Link
        href="/productos"
        className="inline-flex items-center justify-center gap-2 bg-burgundy hover:bg-burgundy-dark text-cream-light font-semibold py-3 px-6 rounded-lg transition-colors"
      >
        Volver al catálogo <ArrowRight size={18} />
      </Link>
    </PageShell>
  );
}

export function CheckoutErrorClient({
  paymentId,
  whatsapp,
}: {
  paymentId: string;
  whatsapp: string;
}) {
  useEffect(() => {
    if (paymentId) trackEvent("purchase_failed", { payment_id: paymentId });
  }, [paymentId]);

  const wa = (whatsapp || "").replace(/[^0-9]/g, "");
  const waLink = wa
    ? `https://wa.me/${wa}?text=${encodeURIComponent(
        "Hola CasaAmor, intenté completar una compra y el pago no se procesó. Quiero coordinar otra forma.",
      )}`
    : null;

  return (
    <PageShell
      iconColor="bg-red-700"
      Icon={XCircle}
      title="No pudimos procesar el pago"
      subtitle="Puede ser un problema con la tarjeta, fondos insuficientes o que el banco rechazó la operación. Tu carrito sigue guardado — podés intentar con otra tarjeta o coordinar la compra por WhatsApp."
    >
      {paymentId && (
        <p className="text-xs text-ink/50 mb-6">
          Número de operación: <code className="font-mono">{paymentId}</code>
        </p>
      )}
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link
          href="/carrito"
          className="inline-flex items-center justify-center gap-2 bg-burgundy hover:bg-burgundy-dark text-cream-light font-semibold py-3 px-6 rounded-lg transition-colors"
        >
          Volver al carrito
        </Link>
        {waLink && (
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-cream-light font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            <MessageCircle size={18} /> Coordinar por WhatsApp
          </a>
        )}
      </div>
    </PageShell>
  );
}
