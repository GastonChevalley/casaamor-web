import Link from "next/link";
import Image from "next/image";
import type { ConfigWeb, MenuItem, Categoria } from "../lib/api";
import { safeUrl } from "../lib/sanitize";
import { HeaderCategoriasNav } from "./HeaderCategoriasNav";

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

  return (
    <header className="sticky top-0 z-20 bg-burgundy text-cream-light shadow-md">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-3 group shrink-0">
          <div className="size-10 rounded-full bg-cream-light/95 p-1 shadow-sm overflow-hidden">
            <Image
              src={logoUrl}
              alt={titulo || "Logo del sitio"}
              width={40}
              height={40}
              priority
              className="size-full object-contain"
            />
          </div>
          {titulo && (
            <span className="font-heading text-xl font-bold tracking-tight text-cream-light group-hover:text-gold transition-colors">
              {titulo}
            </span>
          )}
        </Link>

        {mostrarCategoriasInline && (
          <HeaderCategoriasNav categorias={categoriasInline!} />
        )}

        {!mostrarCategoriasInline && (
          <nav className="flex items-center gap-1 sm:gap-4 text-sm">
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
      </div>
    </header>
  );
}
