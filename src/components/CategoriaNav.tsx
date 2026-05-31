"use client";

import Link from "next/link";
import * as NavigationMenu from "@radix-ui/react-navigation-menu";
import type { Categoria } from "@/lib/api";

/**
 * Barra de categorías del catálogo, debajo del Header.
 *
 * Desktop (md+): Radix NavigationMenu con Viewport portalizado que flota sobre
 * el resto del sitio (resuelve el bug del dropdown que quedaba contenido en
 * un padre con overflow). Animación slide+fade al abrir.
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
        className="hidden md:flex relative justify-center bg-cream border-y border-burgundy/10 z-10"
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
              <NavigationMenu.Item key={(cat.id || cat.slug) + "-" + idx}>
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
                  className="data-[motion=from-start]:animate-[slideDownAndFade_220ms_cubic-bezier(0.16,1,0.3,1)] data-[motion=from-end]:animate-[slideDownAndFade_220ms_cubic-bezier(0.16,1,0.3,1)] data-[motion=to-start]:animate-[fadeOut_120ms] data-[motion=to-end]:animate-[fadeOut_120ms]"
                >
                  <div className="p-4 min-w-[220px]">
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

          <NavigationMenu.Indicator
            className="top-full z-[1] flex h-2 items-end justify-center overflow-hidden transition-[width,transform] duration-250 data-[state=hidden]:opacity-0 data-[state=visible]:opacity-100"
          >
            <div className="relative top-[55%] h-2 w-2 rotate-45 rounded-tl-sm bg-cream-light border-l border-t border-gold/30" />
          </NavigationMenu.Indicator>
        </NavigationMenu.List>

        {/* Viewport portalizado: posicionado debajo de la List, full-width */}
        <div className="absolute top-full left-0 right-0 flex justify-center z-50 perspective-[2000px]">
          <NavigationMenu.Viewport
            className="relative mt-1 w-full max-w-3xl origin-top overflow-hidden rounded-b-lg border border-gold/30 bg-cream-light shadow-xl shadow-burgundy/10 data-[state=open]:animate-[scaleIn_220ms_cubic-bezier(0.16,1,0.3,1)] data-[state=closed]:animate-[scaleOut_120ms]"
            style={{ height: "var(--radix-navigation-menu-viewport-height)" }}
          />
        </div>
      </NavigationMenu.Root>

      {/* MOBILE: ahora las categorías viven dentro del hamburguesa de Header (MobileNav.tsx) */}
    </>
  );
}
