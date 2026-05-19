import Link from "next/link";
import Image from "next/image";

export function Header() {
  return (
    <header className="sticky top-0 z-20 bg-burgundy text-cream-light shadow-md">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="size-10 rounded-full bg-cream-light/95 p-1 shadow-sm overflow-hidden">
            <Image
              src="/logo-512.png"
              alt="CasaAmor"
              width={40}
              height={40}
              priority
              className="size-full object-contain"
            />
          </div>
          <span className="font-serif text-xl font-bold tracking-tight text-cream-light group-hover:text-gold transition-colors">
            CasaAmor
          </span>
        </Link>

        <nav className="flex items-center gap-1 sm:gap-4 text-sm">
          <Link
            href="/productos"
            className="px-3 py-1.5 rounded hover:bg-burgundy-dark transition-colors"
          >
            Catálogo
          </Link>
          <Link
            href="/sobre"
            className="px-3 py-1.5 rounded hover:bg-burgundy-dark transition-colors hidden sm:inline-block"
          >
            Sobre nosotras
          </Link>
          <Link
            href="/contacto"
            className="px-3 py-1.5 rounded hover:bg-burgundy-dark transition-colors"
          >
            Contacto
          </Link>
        </nav>
      </div>
    </header>
  );
}
