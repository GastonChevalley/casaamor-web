import type { Metadata } from "next";
import Link from "next/link";
import { obtenerConfigWeb } from "@/lib/api";

export const metadata: Metadata = {
  title: "Cambios y Devoluciones",
  description:
    "Política de cambios y devoluciones de CasaAmor: arrepentimiento (10 días), garantía por fallas y cómo te devolvemos el dinero.",
  alternates: { canonical: "/devoluciones" },
};

export default async function DevolucionesPage() {
  const config = await obtenerConfigWeb();
  const wa = String(config.contacto_whatsapp || "").replace(/[^0-9]/g, "");

  return (
    <div className="max-w-2xl mx-auto px-6 sm:px-10 py-10">
      <h1 className="font-heading text-3xl sm:text-4xl text-burgundy mb-6">Cambios y Devoluciones</h1>

      <div className="space-y-6 text-ink/80 leading-relaxed">
        <section>
          <h2 className="font-heading text-xl text-burgundy mb-1">Arrepentimiento (10 días)</h2>
          <p>
            Si te arrepentiste de tu compra, tenés <strong>10 días corridos</strong> desde que recibís
            el producto para pedir la devolución, <strong>sin dar explicaciones</strong>. Te devolvemos
            el <strong>100% del dinero</strong> y el envío de la devolución corre por nuestra cuenta.
            Pedilo desde el{" "}
            <Link href="/arrepentimiento" className="text-burgundy underline hover:text-gold">
              Botón de Arrepentimiento
            </Link>{" "}
            (también está en el pie de página).
          </p>
        </section>

        <section>
          <h2 className="font-heading text-xl text-burgundy mb-1">Producto fallado o que no llegó</h2>
          <p>
            Si tu pedido llega con una falla, no es lo que pediste, o no llega, escribinos con tu
            número de pedido y, si aplica, fotos. Según el caso te ofrecemos <strong>cambio,
            reparación o devolución del dinero</strong> (garantía legal de 6 meses en productos
            nuevos). El envío de la devolución también corre por nuestra cuenta.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-xl text-burgundy mb-1">Cómo te devolvemos la plata</h2>
          <p>
            El reembolso se hace por el mismo medio con el que pagaste (Mercado Pago / tarjeta). Si
            pagaste con tarjeta de crédito, puede tardar 1 o 2 resúmenes en aparecer, según tu banco.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-xl text-burgundy mb-1">Contacto</h2>
          <p>
            Te respondemos dentro de las 24 horas.{" "}
            {wa ? (
              <a
                href={`https://wa.me/${wa}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-burgundy underline hover:text-gold"
              >
                Escribinos por WhatsApp
              </a>
            ) : (
              "Escribinos por WhatsApp o email."
            )}
          </p>
        </section>
      </div>

      <p className="text-xs text-ink/50 mt-8 leading-relaxed">
        Ley 24.240 de Defensa del Consumidor (arts. 11-18 garantía; art. 34 revocación) · Resolución
        424/2020 de la Secretaría de Comercio Interior.
      </p>
    </div>
  );
}
