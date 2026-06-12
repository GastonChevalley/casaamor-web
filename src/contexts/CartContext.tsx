"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useCallback,
  type ReactNode,
} from "react";
import {
  type CartItem,
  buildLineId,
  calcularTotal,
  calcularTotalTn,
  calcularCantidadTotal,
} from "@/lib/cart";

/**
 * CartContext — store global del carrito.
 *
 * - Persistencia: localStorage (`casaamor_cart_v1`).
 * - Sincronización entre pestañas: listener de `storage` event.
 * - Acciones: agregar, sumar/restar/setear cantidad, eliminar línea, vaciar.
 *
 * El provider tiene que envolver toda la app (en RootLayout). Cualquier
 * componente cliente que llame `useCart()` se entera de cambios.
 */

const STORAGE_KEY = "casaamor_cart_v1";

type AddPayload = Omit<CartItem, "lineId" | "cantidad"> & {
  cantidad?: number;
};

type CartContextValue = {
  items: CartItem[];
  /** Total en precio EFT (efectivo/transferencia, con 20% off vs TN). */
  total: number;
  /** Total en precio TN (online/tarjeta/MP). Igual a `total` si los items
   *  no tienen `precioUnitTn` definido (carritos viejos pre-Addendum 89). */
  totalTn: number;
  cantidad: number;
  /** Agrega un producto. Si ya existe el mismo lineId, suma la cantidad. */
  agregar: (payload: AddPayload) => void;
  /** Cambia la cantidad de una línea existente. Si llega a 0, elimina la línea. */
  cambiarCantidad: (lineId: string, nuevaCantidad: number) => void;
  /** Elimina una línea por lineId. */
  eliminar: (lineId: string) => void;
  /** Vacía el carrito completo. */
  vaciar: () => void;
  /** Indica si el carrito terminó de hidratarse desde localStorage. */
  hidratado: boolean;
};

const CartContext = createContext<CartContextValue | null>(null);

function leerStorage(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Filtrar entradas malformadas defensivamente.
    return parsed.filter(
      (it): it is CartItem =>
        typeof it === "object" &&
        it !== null &&
        typeof it.lineId === "string" &&
        typeof it.sku === "string" &&
        typeof it.precioUnit === "number" &&
        typeof it.cantidad === "number" &&
        it.cantidad > 0,
    );
  } catch {
    return [];
  }
}

function guardarStorage(items: CartItem[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // localStorage puede fallar si el usuario tiene cuota llena o privacidad estricta.
    // Ignoramos — el carrito vive en memoria durante la sesión.
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hidratado, setHidratado] = useState(false);

  // Hidratar desde localStorage al montar (cliente).
  useEffect(() => {
    setItems(leerStorage());
    setHidratado(true);
  }, []);

  // Persistir cambios.
  useEffect(() => {
    if (hidratado) guardarStorage(items);
  }, [items, hidratado]);

  // Sincronización entre pestañas — si el usuario abre el sitio en 2 tabs.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) {
        setItems(leerStorage());
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const agregar = useCallback((payload: AddPayload) => {
    setItems((prev) => {
      const lineId = buildLineId(payload.sku, payload.variante);
      const idx = prev.findIndex((it) => it.lineId === lineId);
      const cantidadInc = payload.cantidad && payload.cantidad > 0 ? payload.cantidad : 1;
      if (idx >= 0) {
        const copia = [...prev];
        copia[idx] = {
          ...copia[idx],
          cantidad: copia[idx].cantidad + cantidadInc,
        };
        return copia;
      }
      return [
        ...prev,
        {
          lineId,
          sku: payload.sku,
          nombre: payload.nombre,
          variante: payload.variante || "",
          precioUnit: payload.precioUnit,
          precioUnitTn: payload.precioUnitTn,
          cantidad: cantidadInc,
          fotoUrl: payload.fotoUrl,
          slug: payload.slug,
          // Logística (B.2) — opcional. Si llega 0 o undefined,
          // calcularPaqueteCarrito usa defaults genéricos.
          pesoKg: payload.pesoKg,
          altoCm: payload.altoCm,
          anchoCm: payload.anchoCm,
          profundidadCm: payload.profundidadCm,
        },
      ];
    });
  }, []);

  const cambiarCantidad = useCallback((lineId: string, nuevaCantidad: number) => {
    setItems((prev) => {
      if (nuevaCantidad <= 0) {
        return prev.filter((it) => it.lineId !== lineId);
      }
      return prev.map((it) =>
        it.lineId === lineId ? { ...it, cantidad: Math.floor(nuevaCantidad) } : it,
      );
    });
  }, []);

  const eliminar = useCallback((lineId: string) => {
    setItems((prev) => prev.filter((it) => it.lineId !== lineId));
  }, []);

  const vaciar = useCallback(() => {
    setItems([]);
  }, []);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      total: calcularTotal(items),
      totalTn: calcularTotalTn(items),
      cantidad: calcularCantidadTotal(items),
      agregar,
      cambiarCantidad,
      eliminar,
      vaciar,
      hidratado,
    }),
    [items, agregar, cambiarCantidad, eliminar, vaciar, hidratado],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

/**
 * Hook para consumir el carrito desde cualquier componente cliente.
 * Lanza error si se usa fuera del CartProvider (señal clara de bug).
 */
export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart debe usarse dentro de <CartProvider>");
  }
  return ctx;
}
