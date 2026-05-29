"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { Menu, X, ChevronDown } from "lucide-react";
import type { Categoria, MenuItem } from "../lib/api";
import { safeUrl } from "../lib/sanitize";
import { HeaderSearch } from "./HeaderSearch";

/**
 * Hamburguesa mobile-only. Abre un overlay full-screen con buscador opcional,
 * menú principal y categorías como acordeón.
 */
export function MobileNav({
  menu,
  categorias,
  mostrarBuscador,
  buscadorPlaceholder,
}: {
  menu: MenuItem[];
  categorias: Categoria[] | null;
  mostrarBuscador: boolean;
  buscadorPlaceholder: string;
}) {
  const [open, setOpen] = useState(false);

  // Bloquear scroll del body cuando el overlay está abierto.
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  // Cerrar con Escape.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {/* Botón hamburger - solo mobile */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir menú"
        className="md:hidden p-2 -ml-2 rounded text-cream-light hover:bg-burgundy-dark transition-colors"
      >
        <Menu size={24} />
      </button>

      {/* Overlay full-screen */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50 bg-burgundy text-cream-light flex flex-col">
          {/* Top: cerrar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-cream-light/15">
            <span className="font-heading text-lg">Menú</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Cerrar menú"
              className="p-2 -mr-2 rounded hover:bg-burgundy-dark transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          {/* Buscador */}
          {mostrarBuscador && (
            <div className="px-4 py-4 border-b border-cream-light/15">
              <Suspense fallback={<div className="w-full h-9 rounded-full bg-cream-light/10" />}>
                <HeaderSearch
                  placeholder={buscadorPlaceholder}
                  inline
                  onNavigate={() => setOpen(false)}
                />
              </Suspense>
            </div>
          )}

          {/* Body scrolleable */}
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {/* Menú principal */}
            {menu.length > 0 && (
              <nav className="space-y-1 mb-4">
                {menu.map((item) => {
                  const href = safeUrl(item.href);
                  if (!href) return null;
                  return (
                    <Link
                      key={`${item.orden}-${href}`}
                      href={href}
                      target={item.target || undefined}
                      rel={item.target === "_blank" ? "noopener noreferrer" : undefined}
                      onClick={() => setOpen(false)}
                      className="block px-3 py-3 rounded hover:bg-burgundy-dark transition-colors font-heading text-base"
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            )}

            {/* Categorías */}
            {categorias && categorias.length > 0 && (
              <>
                <div className="border-t border-cream-light/15 pt-3 mb-2">
                  <p className="text-xs uppercase tracking-wider text-cream-light/60 px-3 mb-2">
                    Categorías
                  </p>
                </div>

                <Link
                  href="/productos"
                  onClick={() => setOpen(false)}
                  className="block px-3 py-2 rounded hover:bg-burgundy-dark transition-colors text-sm"
                >
                  Todos los productos
                </Link>

                {categorias.map((cat) => {
                  const tieneHijos = cat.hijos && cat.hijos.length > 0;
                  if (!tieneHijos) {
                    return (
                      <Link
                        key={cat.id}
                        href={`/productos?cat=${encodeURIComponent(cat.slug)}`}
                        onClick={() => setOpen(false)}
                        className="block px-3 py-2 rounded hover:bg-burgundy-dark transition-colors text-sm"
                      >
                        {cat.nombre}
                      </Link>
                    );
                  }
                  return (
                    <details
                      key={cat.id}
                      className="group rounded hover:bg-burgundy-dark/50 transition-colors"
                    >
                      <summary className="flex items-center justify-between cursor-pointer px-3 py-2 text-sm list-none">
                        <span>{cat.nombre}</span>
                        <ChevronDown
                          size={16}
                          className="text-cream-light/60 group-open:rotate-180 transition-transform"
                        />
                      </summary>
                      <div className="pl-4 pr-2 pb-2 space-y-0.5">
                        <Link
                          href={`/productos?cat=${encodeURIComponent(cat.slug)}`}
                          onClick={() => setOpen(false)}
                          className="block px-3 py-1.5 rounded hover:bg-burgundy text-xs text-cream-light/80"
                        >
                          Ver todo en {cat.nombre}
                        </Link>
                        {cat.hijos.map((sub) => (
                          <Link
                            key={sub.id}
                            href={`/productos?cat=${encodeURIComponent(cat.slug)}&sub=${encodeURIComponent(sub.slug)}`}
                            onClick={() => setOpen(false)}
                            className="block px-3 py-1.5 rounded hover:bg-burgundy text-xs"
                          >
                            {sub.nombre}
                          </Link>
                        ))}
                      </div>
                    </details>
                  );
                })}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
