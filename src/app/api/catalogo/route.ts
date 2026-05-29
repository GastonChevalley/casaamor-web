import { NextResponse } from "next/server";
import { obtenerCatalogo, type Producto } from "@/lib/api";

/**
 * Devuelve el catálogo público en versión lite — solo los campos necesarios
 * para el dropdown de búsqueda del header. Reusa el cache + revalidate del SSR.
 *
 * Si en el futuro el catálogo crece >300 items, considerar paginación o
 * un endpoint de búsqueda server-side.
 */
export async function GET() {
  const productos = await obtenerCatalogo();
  // Versión lite: solo lo que el dropdown renderiza.
  const lite = productos.map((p: Producto) => ({
    sku: p.sku,
    nombre: p.nombre,
    proveedor: p.proveedor,
    fotoUrl: p.fotoUrl || "",
    precioEft: p.precioEft,
    precioTn: p.precioTn,
    oferta: p.oferta,
    descOfertaPct: p.descOfertaPct,
  }));
  return NextResponse.json({ productos: lite });
}
