"use client";

import Link from "next/link";
import * as NavigationMenu from "@radix-ui/react-navigation-menu";
import type { Categoria } from "@/lib/api";

/**
 * Barra de categorías del catálogo, debajo del Header.
 *
 * Desktop (md+): Radix NavigationMenu. Addendum 76 — cada panel se posiciona
 * DEBAJO de su trigger (no en un Viewport centralizado), patrón Shopify/Vercel.
 * Sin zona muerta entre trigger y panel.
 *
 * Mobile: <details><summary> nativos por accesibilidad + cero JS extra.
 *
 * Los `icono` (emojis) de las categorías NO se renderizan acá — son data
 * interna útil para que la dueña identifique categorías en la PWA admin.
 */
export function CategoriaNav({ categorias }: { categorias: Categoria[] }) {
  if (!categorias || categorias.length === 0) return null;

  return (
    <>
      {/* DESKTOP */}
      <NavigationMenu.Root
        aria-label="Categorías del catálogo"
        className="hidden md:flex justify-center bg-cream border-y border-burgundy/10 z-10"
      >
        <NavigationMenu.List className="flex flex-wrap justify-center items-center gap-1 px-4 py-2 list-none">
          <NavigationMenu.Item>
            <NavigationMenu.Link asChild>
              <Link
                href="/productos"
                className="block px-4 py-2 rounded text-sm font-heading text-burgundy hover:bg-burgundy/10 transition-colors"
              >
                Todos
              </Link>
            </NavigationMenu.Link>
          </NavigationMenu.Item>

          {categorias.map((cat, idx) => {
            const tieneHijos = cat.hijos && cat.hijos.length > 0;
            if (!tieneHijos) {
              return (
                <NavigationMenu.Item key={(cat.id || cat.slug) + "-" + idx}>
                  <NavigationMenu.Link asChild>
                    <Link
                      href={`/productos?cat=${encodeURIComponent(cat.slug)}`}
                      className="block px-4 py-2 rounded text-sm font-heading text-burgundy hover:bg-burgundy/10 transition-colors"
                    >
                      {cat.nombre}
                    </Link>
                  </NavigationMenu.Link>
                </NavigationMenu.Item>
              );
            }
            return (
              <NavigationMenu.Item
                key={(cat.id || cat.slug) + "-" + idx}
                className="relative"
              >
                <NavigationMenu.Trigger
                  className="group inline-flex items-center gap-1 px-4 py-2 rounded text-sm font-heading text-burgundy hover:bg-burgundy/10 data-[state=open]:bg-burgundy data-[state=open]:text-cream-light transition-colors outline-none focus-visible:ring-2 focus-visible:ring-burgundy/40"
                >
                  {cat.nombre}
                  <svg
                    aria-hidden
                    className="h-3 w-3 transition-transform duration-200 group-data-[state=open]:rotate-180"
                    viewBox="0 0 12 12"
                    fill="none"
                  >
                    <path d="M3 5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </NavigationMenu.Trigger>
                <NavigationMenu.Content
                  className="absolute top-full left-0 mt-1 min-w-[220px] origin-top overflow-hidden rounded-lg border border-gold/30 bg-[var(--brand-dropdown-bg)] shadow-xl shadow-burgundy/10 z-50 data-[state=open]:animate-[slideDownAndFade_220ms_cubic-bezier(0.16,1,0.3,1)] data-[state=closed]:animate-[fadeOut_120ms]"
                >
                  <div className="p-4">
                    {cat.descripcion && (
                      <p className="text-xs text-ink/60 mb-3 max-w-md leading-snug px-1">{cat.descripcion}</p>
                    )}
                    <ul
                      className={`grid gap-x-4 gap-y-0.5 list-none ${
                        cat.hijos.length > 6 ? "grid-cols-2" : "grid-cols-1"
                      }`}
                    >
                      {cat.hijos.map((hijo, hidx) => (
                        <li key={(hijo.id || hijo.slug) + "-" + hidx}>
                          <NavigationMenu.Link asChild>
                            <Link
                              href={`/productos?cat=${encodeURIComponent(cat.slug)}&sub=${encodeURIComponent(hijo.slug)}`}
                              className="block px-4 py-2.5 rounded-md text-sm text-burgundy whitespace-nowrap hover:bg-cream hover:text-burgundy-dark transition-colors"
                            >
                              {hijo.nombre}
                            </Link>
                          </NavigationMenu.Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                </NavigationMenu.Content>
              </NavigationMenu.Item>
            );
          })}
        </NavigationMenu.List>
      </NavigationMenu.Root>

      {/* MOBILE: ahora las categorías viven dentro del hamburguesa de Header (MobileNav.tsx) */}
    </>
  );
}
