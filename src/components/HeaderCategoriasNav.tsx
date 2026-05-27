"use client";

import Link from "next/link";
import * as NavigationMenu from "@radix-ui/react-navigation-menu";
import type { Categoria } from "@/lib/api";

/**
 * Variante inline del CategoriaNav que vive DENTRO del Header (estilo TN).
 * Paleta clara sobre fondo burgundy del header.
 *
 * Si no hay categorías, no se renderiza nada — quien usa el componente debe
 * tener un fallback (ej el menú estático Menu sheet).
 */
export function HeaderCategoriasNav({ categorias }: { categorias: Categoria[] }) {
  if (!categorias || categorias.length === 0) return null;

  return (
    <NavigationMenu.Root
      aria-label="Categorías del catálogo"
      className="relative hidden md:flex flex-1 justify-center"
    >
      <NavigationMenu.List className="flex flex-wrap items-center gap-1 list-none">
        <NavigationMenu.Item>
          <NavigationMenu.Link asChild>
            <Link
              href="/productos"
              className="block px-3 py-1.5 rounded text-sm text-cream-light hover:bg-burgundy-dark transition-colors"
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
                    className="block px-3 py-1.5 rounded text-sm text-cream-light hover:bg-burgundy-dark transition-colors"
                  >
                    {cat.nombre}
                  </Link>
                </NavigationMenu.Link>
              </NavigationMenu.Item>
            );
          }
          return (
            <NavigationMenu.Item key={(cat.id || cat.slug) + "-" + idx}>
              <NavigationMenu.Trigger className="group inline-flex items-center gap-1 px-3 py-1.5 rounded text-sm text-cream-light hover:bg-burgundy-dark data-[state=open]:bg-burgundy-dark transition-colors outline-none focus-visible:ring-2 focus-visible:ring-cream-light/40">
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
              <NavigationMenu.Content className="data-[motion=from-start]:animate-[slideDownAndFade_220ms_cubic-bezier(0.16,1,0.3,1)] data-[motion=from-end]:animate-[slideDownAndFade_220ms_cubic-bezier(0.16,1,0.3,1)] data-[motion=to-start]:animate-[fadeOut_120ms] data-[motion=to-end]:animate-[fadeOut_120ms]">
                <div className="p-6">
                  {cat.descripcion && (
                    <p className="text-xs text-ink/70 mb-3 max-w-md">{cat.descripcion}</p>
                  )}
                  <ul
                    className={`grid gap-x-6 gap-y-1 list-none ${
                      cat.hijos.length > 4 ? "grid-cols-2 lg:grid-cols-3" : "grid-cols-1"
                    }`}
                  >
                    {cat.hijos.map((hijo, hidx) => (
                      <li key={(hijo.id || hijo.slug) + "-" + hidx}>
                        <NavigationMenu.Link asChild>
                          <Link
                            href={`/productos?cat=${encodeURIComponent(cat.slug)}&sub=${encodeURIComponent(hijo.slug)}`}
                            className="block px-3 py-2 rounded text-sm text-burgundy hover:bg-gold/20 hover:text-burgundy-dark transition-colors"
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

      {/* Viewport portalizado bajo el Header */}
      <div className="absolute top-full left-1/2 -translate-x-1/2 flex justify-center z-50 perspective-[2000px]">
        <NavigationMenu.Viewport
          className="relative mt-1 w-full max-w-3xl origin-top overflow-hidden rounded-lg border border-gold/30 bg-cream-light shadow-xl shadow-burgundy/10 data-[state=open]:animate-[scaleIn_220ms_cubic-bezier(0.16,1,0.3,1)] data-[state=closed]:animate-[scaleOut_120ms]"
          style={{ height: "var(--radix-navigation-menu-viewport-height)" }}
        />
      </div>
    </NavigationMenu.Root>
  );
}
