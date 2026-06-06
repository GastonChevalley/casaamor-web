import type { Metadata } from "next";
import { CarritoClient } from "@/components/CarritoClient";

export const metadata: Metadata = {
  title: "Tu carrito",
  description: "Productos elegidos para tu compra en CasaAmor.",
  // Las páginas privadas/transaccionales no se indexan.
  robots: { index: false, follow: false },
};

export default function CarritoPage() {
  return <CarritoClient />;
}
