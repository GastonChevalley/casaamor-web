import type { Metadata } from "next";
import { CheckoutPendienteClient } from "@/components/CheckoutResultClients";

export const metadata: Metadata = {
  title: "Pago pendiente",
  description: "Tu pago está siendo procesado.",
  robots: { index: false, follow: false },
};

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function PendientePage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const paymentId = typeof sp.payment_id === "string" ? sp.payment_id : "";
  return <CheckoutPendienteClient paymentId={paymentId} />;
}
