import type { Metadata } from "next";
import { CheckoutErrorClient } from "@/components/CheckoutResultClients";
import { obtenerConfigWeb } from "@/lib/api";

export const metadata: Metadata = {
  title: "Pago rechazado",
  description: "Tu pago no pudo procesarse. Probemos otra forma.",
  robots: { index: false, follow: false },
};

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function ErrorPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const config = await obtenerConfigWeb();
  const paymentId = typeof sp.payment_id === "string" ? sp.payment_id : "";
  return <CheckoutErrorClient paymentId={paymentId} whatsapp={config.contacto_whatsapp || ""} />;
}
