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
  /** Stock disponible al momento de agregar (snapshot). Tope de cantidad en el
   *  carrito. Es orientativo (puede quedar viejo) — el server revalida al comprar. */
  stock?: number;
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
 * Asumimos UN solo paquete (lo más común para boutique pequeña). Modelo POR
 * VOLUMEN: peso = suma de pesos × cantidad; y la caja se dimensiona por el volumen
 * total de los productos (+ aire de packaging), como un cubo cuyos lados no bajan
 * del item más grande. Esto evita el bug del modelo viejo, que "apilaba" la
 * dimensión más larga × cantidad y para muchas unidades chicas superaba el límite
 * de 150 cm de Correo (ej: 21 frascos de 13 cm daban 300 cm → cotización bloqueada).
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
  let volTotalCm3 = 0;
  let maxAlto = 0;
  let maxAncho = 0;
  let maxProf = 0;
  let cantidadItems = 0;

  for (const it of items) {
    const peso = it.pesoKg && it.pesoKg > 0 ? it.pesoKg : DEFAULT_PESO_KG;
    const alto = it.altoCm && it.altoCm > 0 ? it.altoCm : DEFAULT_DIM_CM.alto;
    const ancho = it.anchoCm && it.anchoCm > 0 ? it.anchoCm : DEFAULT_DIM_CM.ancho;
    const prof = it.profundidadCm && it.profundidadCm > 0 ? it.profundidadCm : DEFAULT_DIM_CM.prof;
    const cant = Math.max(1, Math.floor(it.cantidad || 1));
    pesoKgTotal += peso * cant;
    volTotalCm3 += alto * ancho * prof * cant;
    maxAlto = Math.max(maxAlto, alto);
    maxAncho = Math.max(maxAncho, ancho);
    maxProf = Math.max(maxProf, prof);
    cantidadItems += cant;
  }

  const pesoGramos = Math.max(100, Math.round(pesoKgTotal * 1000));

  // 1 sola unidad → el paquete es el item + un 10% de relleno.
  if (cantidadItems <= 1) {
    const p = 1.1;
    return {
      pesoGramos,
      altoCm: Math.max(5, Math.round(maxAlto * p)),
      anchoCm: Math.max(5, Math.round(maxAncho * p)),
      profundidadCm: Math.max(5, Math.round(maxProf * p)),
      cantidadItems,
    };
  }

  // Varias unidades → caja por VOLUMEN (no "apilar la dimensión más larga", que se
  // disparaba y superaba el límite de 150 cm de Correo para muchas unidades chicas).
  // Armamos una caja tipo cubo cuyo volumen ≈ volumen real de los productos + aire
  // de packaging; cada lado no puede ser menor que el item más grande en ese eje.
  // El precio de Correo lo domina el mayor entre peso real y peso volumétrico, así
  // que la forma exacta importa poco mientras la caja tenga el volumen correcto.
  const PACKING = 1.35; // relleno + aire entre productos
  const ladoCubo = Math.ceil(Math.cbrt(volTotalCm3 * PACKING));

  return {
    pesoGramos,
    altoCm: Math.max(5, maxAlto, ladoCubo),
    anchoCm: Math.max(5, maxAncho, ladoCubo),
    profundidadCm: Math.max(5, maxProf, ladoCubo),
    cantidadItems,
  };
}
