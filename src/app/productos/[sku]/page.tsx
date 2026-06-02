import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { obtenerProducto, obtenerConfigWeb } from "@/lib/api";
import { ProductoDetalleClient } from "@/components/ProductoDetalleClient";
import { RelacionadosSection } from "@/components/RelacionadosSection";
import { siteUrl } from "@/lib/site";

type Params = Promise<{ sku: string }>;

function fmtMonto(n: number): string {
  return "$" + Math.round(Number(n) || 0).toLocaleString("es-AR");
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { sku } = await params;
  const skuDecoded = decodeURIComponent(sku);
  const producto = await obtenerProducto(skuDecoded);
  if (!producto) return { title: "Producto no encontrado" };

  const fotos = producto.fotos && producto.fotos.length > 0
    ? producto.fotos
    : producto.fotoUrl ? [producto.fotoUrl] : [];
  const descripcionBase = producto.descripcion?.trim() ||
    `${producto.nombre} — ${producto.proveedor}. ${fmtMonto(producto.precioEft)} en efectivo.`;
  const descripcion = descripcionBase.length > 160
    ? descripcionBase.slice(0, 157) + "…"
    : descripcionBase;
  const canonical = `/productos/${encodeURIComponent(producto.sku)}`;

  // Si el producto tiene fotos propias → las usa para OG/Twitter.
  // Si no → Next.js cae automático a `app/opengraph-image.tsx` (default del sitio).
  const ogImages = fotos.length
    ? fotos.slice(0, 4).map((url) => ({ url, width: 1200, height: 1200, alt: producto.nombre }))
    : undefined;
  const twitterImages = fotos.length ? [fotos[0]] : undefined;

  return {
    title: producto.nombre,
    description: descripcion,
    alternates: { canonical },
    openGraph: {
      type: "website", // Next 16: 'product' aún no soportado en tipos — usamos 'website' válido.
      title: `${producto.nombre} — CasaAmor`,
      description: descripcion,
      url: siteUrl(canonical),
      ...(ogImages && { images: ogImages }),
    },
    twitter: {
      card: "summary_large_image",
      title: `${producto.nombre} — CasaAmor`,
      description: descripcion,
      ...(twitterImages && { images: twitterImages }),
    },
  };
}

export default async function ProductoDetallePage({ params }: { params: Params }) {
  const { sku } = await params;
  const skuDecoded = decodeURIComponent(sku);
  const [producto, config] = await Promise.all([
    obtenerProducto(skuDecoded),
    obtenerConfigWeb(),
  ]);

  if (!producto) notFound();

  // Schema.org Product JSON-LD (Addendum 80 / Fase A SEO).
  // Google muestra precio + stock + brand en los resultados orgánicos.
  const fotos = producto.fotos && producto.fotos.length > 0
    ? producto.fotos
    : producto.fotoUrl ? [producto.fotoUrl] : [];
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: producto.nombre,
    sku: producto.sku,
    description: producto.descripcion?.trim() ||
      `${producto.nombre} — ${producto.proveedor}.`,
    image: fotos.length > 0 ? fotos.slice(0, 4) : undefined,
    brand: producto.proveedor
      ? { "@type": "Brand", name: producto.proveedor }
      : undefined,
    offers: {
      "@type": "Offer",
      url: siteUrl(`/productos/${encodeURIComponent(producto.sku)}`),
      priceCurrency: "ARS",
      price: Math.round(producto.precioEft || 0),
      availability: (producto.stock || 0) > 0
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: {
        "@type": "Organization",
        name: config.site_title || "CasaAmor",
      },
    },
  };

  // RelacionadosSection vive FUERA del max-w-5xl del detalle para tener su propio
  // ancho (max-w-6xl, alineado al catálogo). Si no hay relacionados → no renderiza.
  const cardEstilo = config.card_estilo || "clasico";
  return (
    <>
      {/* JSON-LD inline en el body — válido para Googlebot y demás crawlers. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <div className="max-w-5xl mx-auto px-6 sm:px-10 py-12">
        <Link
          href="/productos"
          className="text-burgundy hover:text-gold text-sm inline-flex items-center gap-1.5 mb-6"
        >
          <ArrowLeft size={16} /> Volver al catálogo
        </Link>
        <ProductoDetalleClient producto={producto} config={config} />
      </div>
      <RelacionadosSection
        productos={producto.relacionados || []}
        cardEstilo={cardEstilo}
      />
    </>
  );
}
