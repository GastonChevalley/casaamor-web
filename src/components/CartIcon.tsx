"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { useCart } from "@/contexts/CartContext";

/**
 * Icono de carrito para el header.
 *
 * - Renderiza el badge con la cantidad total de items SOLO cuando el carrito
 *   está hidratado desde localStorage (evita "flash" del badge en cero al
 *   cargar la página inicialmente).
 * - Link directo a /carrito.
 */
export function CartIcon() {
  const { cantidad, hidratado } = useCart();
  const mostrarBadge = hidratado && cantidad > 0;

  return (
    <Link
      href="/carrito"
      aria-label={`Carrito${mostrarBadge ? ` con ${cantidad} producto${cantidad > 1 ? "s" : ""}` : ""}`}
      className="relative inline-flex items-center justify-center p-2 text-cream-light/85 hover:text-gold transition-colors"
    >
      <ShoppingBag size={22} aria-hidden />
      {mostrarBadge && (
        <span
          className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-gold text-burgundy text-[10px] font-bold leading-none inline-flex items-center justify-center"
          aria-hidden
        >
          {cantidad > 99 ? "99+" : cantidad}
        </span>
      )}
    </Link>
  );
}
