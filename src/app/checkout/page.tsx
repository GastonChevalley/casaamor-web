import type { Metadata } from "next";
import { CheckoutClient } from "@/components/CheckoutClient";
import { obtenerConfigWeb } from "@/lib/api";

export const metadata: Metadata = {
  title: "Finalizar compra",
  description: "Completá tus datos y elegí el método de pago.",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage() {
  // Lo de config se usa para textos del showroom + WhatsApp fallback.
  const config = await obtenerConfigWeb();
  return <CheckoutClient config={config} />;
}
