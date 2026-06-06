import type { Metadata } from "next";
import { CheckoutExitoClient } from "@/components/CheckoutResultClients";

export const metadata: Metadata = {
  title: "¡Compra exitosa!",
  description: "Tu pago fue acreditado.",
  robots: { index: false, follow: false },
};

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function ExitoPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const paymentId = typeof sp.payment_id === "string" ? sp.payment_id : "";
  return <CheckoutExitoClient paymentId={paymentId} />;
}
