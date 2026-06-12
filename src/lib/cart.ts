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
  /** Peso unitario en kg para cotizador Correo (B.2). Default 0 = usar fallback. */
  pesoKg?: number;
  /** Dimensiones del paquete unitario en cm para cotizador (B.2). */
  altoCm?: number;
  anchoCm?: number;
  profundidadCm?: number;
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

/**
 * Dimensiones agregadas del paquete del carrito para cotizador Correo (B.2).
 *
 * Estrategia simple para evitar tener que armar un cálculo de "cuántas cajas".
 * Asumimos UN solo paquete (el más eficiente para boutique pequeña):
 *   - peso = suma de pesos × cantidad de cada item (mínimo 100 g)
 *   - dimensión = la MÁXIMA de cada dim entre items × cantidad de items para
 *     la dim más larga (apilamos largo + alto/2 para reflejar capas)
 *
 * Si un item no tiene peso/dim cargado, se asume el default genérico
 * (0.5 kg, 20×15×10 cm) para no devolver 0 que rompería la cotización.
 */
export type PaqueteCarrito = {
  pesoGramos: number;
  altoCm: number;
  anchoCm: number;
  profundidadCm: number;
  cantidadItems: number;
};

const DEFAULT_PESO_KG = 0.5;
const DEFAULT_DIM_CM = { alto: 15, ancho: 20, prof: 10 };

export function calcularPaqueteCarrito(items: CartItem[]): PaqueteCarrito {
  if (!items.length) {
    return { pesoGramos: 100, altoCm: 10, anchoCm: 10, profundidadCm: 10, cantidadItems: 0 };
  }
  let pesoKgTotal = 0;
  let maxAlto = 0;
  let maxAncho = 0;
  let maxProf = 0;
  let cantidadItems = 0;

  for (const it of items) {
    const peso = it.pesoKg && it.pesoKg > 0 ? it.pesoKg : DEFAULT_PESO_KG;
    const alto = it.altoCm && it.altoCm > 0 ? it.altoCm : DEFAULT_DIM_CM.alto;
    const ancho = it.anchoCm && it.anchoCm > 0 ? it.anchoCm : DEFAULT_DIM_CM.ancho;
    const prof = it.profundidadCm && it.profundidadCm > 0 ? it.profundidadCm : DEFAULT_DIM_CM.prof;
    pesoKgTotal += peso * it.cantidad;
    maxAlto = Math.max(maxAlto, alto);
    maxAncho = Math.max(maxAncho, ancho);
    maxProf = Math.max(maxProf, prof);
    cantidadItems += it.cantidad;
  }

  // Para múltiples unidades del mismo item, sumamos en la dimensión más larga
  // (aproximación simple: el paquete se "alarga" en lugar de "engordar").
  // Factor 1.1 por relleno de packaging (papel, burbuja).
  const padding = 1.1;
  let finalAlto = maxAlto;
  let finalAncho = Math.round(maxAncho * padding);
  let finalProf = Math.round(maxProf * padding);
  if (cantidadItems > 1) {
    const dimensiones: Array<["alto" | "ancho" | "prof", number]> = [
      ["alto", maxAlto],
      ["ancho", maxAncho],
      ["prof", maxProf],
    ];
    dimensiones.sort((a, b) => b[1] - a[1]); // dim más larga primero
    const mayor = dimensiones[0][0];
    const sumaPorRepeticiones = Math.round(dimensiones[0][1] * cantidadItems * padding);
    if (mayor === "alto") finalAlto = sumaPorRepeticiones;
    else if (mayor === "ancho") finalAncho = sumaPorRepeticiones;
    else finalProf = sumaPorRepeticiones;
  } else {
    finalAlto = Math.round(maxAlto * padding);
  }

  return {
    pesoGramos: Math.max(100, Math.round(pesoKgTotal * 1000)),
    altoCm: Math.max(5, finalAlto),
    anchoCm: Math.max(5, finalAncho),
    profundidadCm: Math.max(5, finalProf),
    cantidadItems,
  };
}
