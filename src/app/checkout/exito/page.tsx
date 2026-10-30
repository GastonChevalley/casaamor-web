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
  // Número de pedido: lo manda el checkout (tarjeta) o MP al volver (billetera,
  // en external_reference / ref como "pw:<id>").
  const ref = [sp.pedido, sp.external_reference, sp.ref].find((x) => typeof x === "string") as string | undefined;
  const pedidoId = String(ref || "").replace(/^pw:/, "");
  return <CheckoutExitoClient paymentId={paymentId} pedidoId={/^PW-/.test(pedidoId) ? pedidoId : ""} />;
}
