import type { Metadata } from "next";
import Link from "next/link";
import { obtenerConfigWeb } from "@/lib/api";
import { ArrepentimientoClient } from "@/components/ArrepentimientoClient";

export const metadata: Metadata = {
  title: "Botón de Arrepentimiento",
  description:
    "Solicitá la revocación de tu compra dentro de los 10 días de recibirla, sin dar explicaciones (Resolución 424/2020).",
  alternates: { canonical: "/arrepentimiento" },
};

export default async function ArrepentimientoPage() {
  const config = await obtenerConfigWeb();

  return (
    <div className="max-w-2xl mx-auto px-6 sm:px-10 py-10">
      <h1 className="font-heading text-3xl sm:text-4xl text-burgundy mb-3">Botón de Arrepentimiento</h1>
      <p className="text-ink/80 leading-relaxed mb-4">
        Si te arrepentiste de tu compra, tenés <strong>10 días corridos</strong> desde que recibís el
        producto para pedir la devolución, <strong>sin dar explicaciones</strong>. Te devolvemos el{" "}
        <strong>100% del dinero</strong> y el costo del envío de la devolución corre por nuestra cuenta.
      </p>
      <p className="text-ink/70 text-sm leading-relaxed mb-6">
        Completá el formulario (no hace falta registrarse) y te damos un <strong>código de trámite en
        el acto</strong>. Te lo enviamos también por email y nos comunicamos con vos dentro de las 24
        horas. Ver también nuestra{" "}
        <Link href="/devoluciones" className="text-burgundy underline hover:text-gold">
          política de cambios y devoluciones
        </Link>
        .
      </p>

      <ArrepentimientoClient whatsapp={config.contacto_whatsapp} />

      <p className="text-xs text-ink/50 mt-6 leading-relaxed">
        Derecho de revocación — art. 34, Ley 24.240 de Defensa del Consumidor, y Resolución 424/2020
        de la Secretaría de Comercio Interior.
      </p>
    </div>
  );
}
