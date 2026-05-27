import Link from "next/link";
import type { ConfigWeb, MenuItem, Categoria } from "../lib/api";
import { safeHandle, safePhone, safeUrl } from "../lib/sanitize";

export function Footer({
  config,
  menu,
  categorias,
}: {
  config: ConfigWeb;
  menu: MenuItem[];
  categorias?: Categoria[] | null;
}) {
  const titulo = config.site_title || "CasaAmor";
  const tagline = config.site_tagline || "";
  // Sanitizar TODOS los inputs del API antes de meterlos en href.
  const ig = safeHandle(config.contacto_instagram);
  const wa = safePhone(config.contacto_whatsapp);
  const email = config.contacto_email || "";
  const emailHref =
    email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? `mailto:${email}` : "";
  const footerTexto = config.footer_texto || "Hecho con amor 💛";

  const mostrarCategorias = !!(categorias && categorias.length > 0);
  const gridCols = mostrarCategorias ? "sm:grid-cols-4" : "sm:grid-cols-3";

  return (
    <footer className="bg-footer text-cream-light/85 mt-16">
      <div className={`max-w-6xl mx-auto px-4 sm:px-6 py-10 grid gap-8 ${gridCols} text-sm`}>
        <div>
          <h3 className="font-heading text-lg text-cream-light mb-2">{titulo}</h3>
          <p className="opacity-80">{tagline}</p>
        </div>

        <div>
          <h3 className="font-heading text-lg text-cream-light mb-2">Navegación</h3>
          <ul className="space-y-1">
            {menu.map((item) => {
              const href = safeUrl(item.href);
              if (!href) return null;
              return (
                <li key={`f-${item.orden}-${href}`}>
                  <Link
                    href={href}
                    target={item.target || undefined}
                    rel={item.target === "_blank" ? "noopener noreferrer" : undefined}
                    className="hover:text-gold transition-colors"
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        <div>
          <h3 className="font-heading text-lg text-cream-light mb-2">Seguinos</h3>
          <ul className="space-y-1">
            {ig && (
              <li>
                <a
                  href={`https://instagram.com/${ig}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-gold transition-colors"
                >
                  Instagram @{ig}
                </a>
              </li>
            )}
            {wa && (
              <li>
                <a
                  href={`https://wa.me/${wa}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-gold transition-colors"
                >
                  WhatsApp
                </a>
              </li>
            )}
            {emailHref && (
              <li>
                <a href={emailHref} className="hover:text-gold transition-colors">
                  {email}
                </a>
              </li>
            )}
          </ul>
        </div>

        {mostrarCategorias && (
          <div>
            <h3 className="font-heading text-lg text-cream-light mb-2">Catálogo</h3>
            <ul className="space-y-1">
              <li>
                <Link href="/productos" className="hover:text-gold transition-colors">
                  Todos los productos
                </Link>
              </li>
              {categorias!.map((cat, idx) => (
                <li key={(cat.id || cat.slug) + "-" + idx}>
                  <Link
                    href={`/productos?cat=${encodeURIComponent(cat.slug)}`}
                    className="hover:text-gold transition-colors"
                  >
                    {cat.nombre}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="border-t border-cream-light/15">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 text-xs opacity-60 flex flex-wrap justify-between gap-2">
          <span>© {new Date().getFullYear()} {titulo} — Todos los derechos reservados</span>
          <span>{footerTexto}</span>
        </div>
      </div>
    </footer>
  );
}
