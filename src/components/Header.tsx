import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import type { ConfigWeb, MenuItem, Categoria } from "../lib/api";
import { safeUrl } from "../lib/sanitize";
import { HeaderCategoriasNav } from "./HeaderCategoriasNav";
import { HeaderSearch } from "./HeaderSearch";
import { MobileNav } from "./MobileNav";
import { UserMenu } from "./UserMenu";

function esTrueStr(v: unknown): boolean {
  if (v === true) return true;
  if (typeof v !== "string") return false;
  const s = v.trim().toLowerCase();
  return s === "true" || s === "1" || s === "yes" || s === "sí" || s === "si";
}

export function Header({
  config,
  menu,
  categoriasInline,
}: {
  config: ConfigWeb;
  menu: MenuItem[];
  categoriasInline?: Categoria[] | null;
}) {
  const titulo = config.site_title || "";
  const logoUrl = safeUrl(config.logo_url) || "/logo-512.png";
  const mostrarCategoriasInline = !!(categoriasInline && categoriasInline.length > 0);
  const mostrarBuscador = esTrueStr(config.mostrar_buscador ?? "TRUE");
  const buscadorPlaceholder = config.buscador_placeholder || "¿Qué estás buscando?";

  return (
    <header className="sticky top-0 z-20 bg-burgundy text-cream-light shadow-md">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* TOP BAR: distribución TN-style */}
        <div className="flex items-center gap-3 sm:gap-4 py-3">
          {/* === MOBILE: hamburger izq | logo centrado | user der === */}
          <div className="md:hidden">
            <MobileNav
              menu={menu}
              categorias={categoriasInline || null}
            />
          </div>

          {/* Logo: centrado en mobile, izquierda en desktop */}
          <Link
            href="/"
            className="flex items-center gap-3 group shrink-0 mx-auto md:mx-0"
          >
            <Image
              src={logoUrl}
              alt={titulo || "Logo del sitio"}
              width={72}
              height={72}
              priority
              className="h-14 sm:h-16 w-auto object-contain group-hover:opacity-90 transition-opacity"
            />
            {titulo && (
              <span className="hidden sm:inline font-heading text-xl font-bold tracking-tight text-cream-light group-hover:text-gold transition-colors">
                {titulo}
              </span>
            )}
          </Link>

          {/* === DESKTOP: buscador centrado + nav === */}
          {mostrarBuscador && (
            <div className="hidden md:flex flex-1 justify-center">
              <Suspense fallback={<div className="w-full max-w-md h-9 rounded-full bg-cream-light/10" />}>
                <HeaderSearch placeholder={buscadorPlaceholder} />
              </Suspense>
            </div>
          )}
          {!mostrarBuscador && <div className="hidden md:block flex-1" />}

          {/* Categorías inline desktop */}
          {mostrarCategoriasInline && (
            <div className="hidden md:block">
              <HeaderCategoriasNav categorias={categoriasInline!} />
            </div>
          )}

          {/* Menú estático desktop */}
          {!mostrarCategoriasInline && (
            <nav className="hidden md:flex items-center gap-1 sm:gap-4 text-sm">
              {menu.map((item) => {
                const href = safeUrl(item.href);
                if (!href) return null;
                return (
                  <Link
                    key={`${item.orden}-${href}`}
                    href={href}
                    target={item.target || undefined}
                    rel={item.target === "_blank" ? "noopener noreferrer" : undefined}
                    className="px-3 py-1.5 rounded hover:bg-burgundy-dark transition-colors"
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          )}

          {/* Icono Usuario: a la derecha tanto mobile como desktop */}
          <UserMenu />
        </div>

        {/* SECOND ROW MOBILE: buscador full-width */}
        {mostrarBuscador && (
          <div className="md:hidden pb-3">
            <Suspense fallback={<div className="w-full h-9 rounded-full bg-cream-light/10" />}>
              <HeaderSearch placeholder={buscadorPlaceholder} />
            </Suspense>
          </div>
        )}
      </div>
    </header>
  );
}
