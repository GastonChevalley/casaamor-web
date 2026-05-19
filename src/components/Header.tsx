import Link from "next/link";
import Image from "next/image";
import type { ConfigWeb, MenuItem } from "../lib/api";

export function Header({ config, menu }: { config: ConfigWeb; menu: MenuItem[] }) {
  const titulo = config.site_title || "CasaAmor";
  const logoUrl = config.logo_url || "/logo-512.png";
  return (
    <header className="sticky top-0 z-20 bg-burgundy text-cream-light shadow-md">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="size-10 rounded-full bg-cream-light/95 p-1 shadow-sm overflow-hidden">
            <Image
              src={logoUrl}
              alt={titulo}
              width={40}
              height={40}
              priority
              className="size-full object-contain"
            />
          </div>
          <span className="font-heading text-xl font-bold tracking-tight text-cream-light group-hover:text-gold transition-colors">
            {titulo}
          </span>
        </Link>

        <nav className="flex items-center gap-1 sm:gap-4 text-sm">
          {menu.map((item) => (
            <Link
              key={`${item.orden}-${item.href}`}
              href={item.href}
              target={item.target || undefined}
              rel={item.target === "_blank" ? "noopener noreferrer" : undefined}
              className="px-3 py-1.5 rounded hover:bg-burgundy-dark transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
