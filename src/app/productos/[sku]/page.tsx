import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { obtenerProducto, obtenerConfigWeb } from "@/lib/api";
import { ProductoDetalleClient } from "@/components/ProductoDetalleClient";

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
  return {
    title: producto.nombre,
    description: `${producto.nombre} — ${producto.proveedor}. ${fmtMonto(producto.precioEft)} en efectivo.`,
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

  return (
    <div className="max-w-5xl mx-auto px-6 sm:px-10 py-12">
      <Link
        href="/productos"
        className="text-burgundy hover:text-gold text-sm inline-flex items-center gap-1.5 mb-6"
      >
        <ArrowLeft size={16} /> Volver al catálogo
      </Link>
      <ProductoDetalleClient producto={producto} config={config} />
    </div>
  );
}
