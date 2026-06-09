/**
 * cart.ts — Tipos y helpers para el carrito de compras.
 *
 * El carrito vive en localStorage del cliente (sin auth). CartContext lo
 * provee globalmente. No hay backend persistente — si el usuario limpia el
 * navegador, pierde el carrito (comportamiento estándar de e-commerce sin
 * cuenta).
 *
 * Cuando arranque B.1.8 (integración MP), el carrito se serializa a un
 * preference que MP procesa. El stock se valida al construir la preference
 * (server-side) y el decremento real ocurre en el webhook tras pago aprobado.
 */

export type CartItem = {
  /** Identificador único por línea: combinación de sku + variante. */
  lineId: string;
  /** SKU del producto. Si tiene variantes, es el SKU del hijo seleccionado. */
  sku: string;
  /** Nombre del producto (snapshot al momento de agregar). */
  nombre: string;
  /** Valor de la variante si aplica (ej "AZUL", "M"). Vacío si no hay. */
  variante: string;
  /** Precio unitario EFT (efectivo/transferencia) — snapshot al agregar. */
  precioUnit: number;
  /** Precio unitario TN (online/tarjeta/MP) — snapshot al agregar.
   *  Si no se setea, se usa el mismo `precioUnit` (sin descuento por método).
   *  Esto permite mostrar dual pricing en el carrito y checkout. */
  precioUnitTn?: number;
  /** Cantidad solicitada. */
  cantidad: number;
  /** URL de la foto principal para mostrar miniatura en el carrito. */
  fotoUrl?: string;
  /** Slug del producto para link de vuelta al detalle. */
  slug?: string;
};

/**
 * Construye el lineId estándar combinando SKU + variante. Garantiza que
 * agregar el mismo producto con la misma variante se trate como suma de
 * cantidad (no duplicación de línea).
 */
export function buildLineId(sku: string, variante: string = ""): string {
  return variante ? `${sku}::${variante}` : sku;
}

/**
 * Suma el total monetario del carrito en precio EFT (efectivo/transferencia).
 */
export function calcularTotal(items: CartItem[]): number {
  return items.reduce((acc, item) => acc + item.precioUnit * item.cantidad, 0);
}

/**
 * Suma el total en precio TN (online/tarjeta/MP). Para items que no tienen
 * `precioUnitTn` (caso de carritos viejos en localStorage antes del Addendum 89),
 * usa `precioUnit` como fallback — el cliente ve los 2 totales iguales para
 * esos items hasta que renueve el carrito.
 */
export function calcularTotalTn(items: CartItem[]): number {
  return items.reduce(
    (acc, item) => acc + (item.precioUnitTn || item.precioUnit) * item.cantidad,
    0,
  );
}

/**
 * Suma la cantidad total de items (para mostrar en badge del icono).
 */
export function calcularCantidadTotal(items: CartItem[]): number {
  return items.reduce((acc, item) => acc + item.cantidad, 0);
}

/**
 * Formato monetario consistente con el resto del sitio.
 */
export function fmtMonto(n: number): string {
  return "$" + Math.round(Number(n) || 0).toLocaleString("es-AR");
}
