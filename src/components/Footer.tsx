import Link from "next/link";

export function Footer() {
  return (
    <footer className="bg-burgundy-dark text-cream-light/85 mt-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 grid gap-8 sm:grid-cols-3 text-sm">
        <div>
          <h3 className="font-serif text-lg text-cream-light mb-2">CasaAmor</h3>
          <p className="opacity-80">
            Decoración con amor para tu hogar. Boutique online con envíos a todo el país.
          </p>
        </div>

        <div>
          <h3 className="font-serif text-lg text-cream-light mb-2">Navegación</h3>
          <ul className="space-y-1">
            <li>
              <Link href="/productos" className="hover:text-gold transition-colors">
                Catálogo
              </Link>
            </li>
            <li>
              <Link href="/sobre" className="hover:text-gold transition-colors">
                Sobre nosotras
              </Link>
            </li>
            <li>
              <Link href="/envios" className="hover:text-gold transition-colors">
                Envíos
              </Link>
            </li>
            <li>
              <Link href="/contacto" className="hover:text-gold transition-colors">
                Contacto
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="font-serif text-lg text-cream-light mb-2">Seguinos</h3>
          <ul className="space-y-1">
            <li>
              <a
                href="https://instagram.com/casaamor"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-gold transition-colors"
              >
                Instagram
              </a>
            </li>
            <li>
              <a
                href="https://wa.me/5491100000000"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-gold transition-colors"
              >
                WhatsApp
              </a>
            </li>
            <li>
              <a
                href="mailto:hola@casaamor.com.ar"
                className="hover:text-gold transition-colors"
              >
                hola@casaamor.com.ar
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-cream-light/15">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 text-xs opacity-60 flex flex-wrap justify-between gap-2">
          <span>© {new Date().getFullYear()} CasaAmor — Todos los derechos reservados</span>
          <span>Hecho con amor 💛</span>
        </div>
      </div>
    </footer>
  );
}
