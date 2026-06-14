import type { Metadata } from "next";
import "./globals.css";
import { GoogleAnalytics } from "@next/third-parties/google";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { WhatsappButton } from "../components/WhatsappButton";
import { CategoriaNav } from "../components/CategoriaNav";
import { MarqueeFijo } from "../components/MarqueeFijo";
import { obtenerConfigWeb, obtenerMenu, obtenerCategorias, isTrueStr } from "../lib/api";
import { todasLasFontsClassName, fontVarPorId } from "../lib/fonts";
import { SITE_URL } from "../lib/site";
import { CartProvider } from "../contexts/CartContext";

export async function generateMetadata(): Promise<Metadata> {
  const config = await obtenerConfigWeb();
  const siteTitle = config.site_title || "CasaAmor";
  const siteTagline = config.site_tagline || "Decoración con amor";
  const siteDesc = config.site_descripcion || "Boutique de decoración y objetos únicos para tu hogar.";
  return {
    title: {
      default: `${siteTitle} — ${siteTagline}`,
      template: `%s · ${siteTitle}`,
    },
    description: siteDesc,
    // metadataBase desde env var (lib/site.ts) — switch automático cuando llegue dominio.
    metadataBase: new URL(SITE_URL),
    // SEO fix (Search Console warning): Next 16 con metadataBase genera canonicals
    // por ruta automáticos. Si dejábamos canonical: "/" acá, TODAS las páginas que
    // no definen su propio canonical en generateMetadata (`/productos`, `/sobre`,
    // `/contacto`, `/envios`, `?cat=X`) heredaban canonical apuntando a home →
    // Google las trataba como duplicados → "Página alternativa con canónica
    // adecuada" en Search Console → no las indexaba como URLs únicas.
    // El detalle /productos/[sku] ya define su propio canonical correcto en
    // generateMetadata, lo cual sigue funcionando.
    openGraph: {
      title: siteTitle,
      description: siteDesc,
      url: SITE_URL,
      siteName: siteTitle,
      locale: "es_AR",
      type: "website",
      // images NO se setea aquí — Next.js inyecta automático desde
      // `app/opengraph-image.tsx` (1200×630 generada en build).
      // Si una página define su propio openGraph.images (ej producto), ese gana.
    },
    twitter: {
      card: "summary_large_image",
      title: siteTitle,
      description: siteDesc,
      // images NO se setea aquí — Next.js inyecta desde `app/twitter-image.tsx`
      // o fallback al opengraph-image. Páginas con OG propio (producto) ganan.
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    // Verificación de propiedad para Google Search Console.
    // Renderiza <meta name="google-site-verification" content="..."> en <head>.
    // Necesario porque @next/third-parties inyecta gtag async y GSC no detecta
    // el script para verificar con el método de Google Analytics.
    verification: {
      google: "mzSSKntKWoRDifBoDjfy7l9dpMpZ9Aae8i_jGQPiwPw",
    },
    icons: {
      icon: "/logo-512.png",
      apple: "/logo-512.png",
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Datos desde Apps Script — todo el árbol (Header, Footer, CategoriaNav) los consumen.
  const [config, menu, categorias] = await Promise.all([
    obtenerConfigWeb(),
    obtenerMenu(),
    obtenerCategorias(),
  ]);

  // Resolver CSS vars de fuentes
  const fontHeadingVar = fontVarPorId(config.font_heading, "fraunces");
  const fontBodyVar = fontVarPorId(config.font_body, "geist");

  // Inline style con las CSS vars dinámicas (paleta + fuentes activas)
  const themeStyle = {
    "--brand-burgundy":      config.color_burgundy,
    "--brand-burgundy-dark": config.color_burgundy_dark,
    "--brand-rose":          config.color_rose,
    "--brand-gold":          config.color_gold,
    "--brand-gold-dark":     config.color_gold_dark,
    "--brand-cream":         config.color_cream,
    "--brand-cream-light":   config.color_cream_light,
    "--brand-ink":           config.color_ink,
    // color_footer es nuevo (Addendum 38b) — cae a burgundy_dark si la planilla no lo tiene aún.
    "--brand-footer":        config.color_footer || config.color_burgundy_dark,
    // color_dropdown_bg (Addendum 76) — fondo del panel de subcategorías en desktop. Cae a cream-light.
    "--brand-dropdown-bg":   config.color_dropdown_bg || config.color_cream_light,
    "--font-heading-active": `var(${fontHeadingVar})`,
    "--font-body-active":    `var(${fontBodyVar})`,
  } as React.CSSProperties;

  // Posición de las categorías en el header: 'inline' | 'abajo' | 'oculto'.
  // Default 'abajo' para compat con el comportamiento previo.
  const navPosRaw = String(config.nav_categorias_pos || "abajo").trim().toLowerCase();
  const navPos: "inline" | "abajo" | "oculto" =
    navPosRaw === "inline" || navPosRaw === "oculto" ? navPosRaw : "abajo";

  // Schema.org JSON-LD para Organization + WebSite (Addendum 80 / Fase A SEO).
  // Aplica a TODAS las páginas. Google los usa para Knowledge Panel, sitelinks,
  // y SearchAction en resultados orgánicos.
  const orgName = config.site_title || "CasaAmor";
  const orgDesc = config.site_descripcion || "Boutique de decoración y objetos únicos para tu hogar.";
  const wa = String(config.contacto_whatsapp || "").trim();
  const ig = String(config.contacto_instagram || "").trim();
  const sameAs: string[] = [];
  if (ig) sameAs.push(`https://instagram.com/${ig.replace(/^@/, "")}`);
  if (wa) sameAs.push(`https://wa.me/${wa.replace(/[^0-9]/g, "")}`);

  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: orgName,
    url: SITE_URL,
    logo: `${SITE_URL}/logo-512.png`,
    description: orgDesc,
    ...(sameAs.length > 0 && { sameAs }),
    ...(wa && {
      contactPoint: {
        "@type": "ContactPoint",
        telephone: `+${wa.replace(/[^0-9]/g, "")}`,
        contactType: "customer service",
        areaServed: "AR",
        availableLanguage: "Spanish",
      },
    }),
  };

  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: orgName,
    url: SITE_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/productos?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  // Google Analytics 4 — solo renderiza si está la env var NEXT_PUBLIC_GA_ID.
  // Cuando no está (preview deploys, dev local sin .env): no se inyecta el script.
  const gaId = (process.env.NEXT_PUBLIC_GA_ID || "").trim();

  return (
    <html
      lang="es-AR"
      className={`${todasLasFontsClassName()} h-full antialiased`}
      style={themeStyle}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-cream-light text-ink">
        <CartProvider>
          <MarqueeFijo
            activo={config.marquee_global_activo}
            textosRaw={config.marquee_global_textos}
            color={config.marquee_global_color}
          />
          <Header
            config={config}
            menu={menu}
            categoriasInline={navPos === "inline" ? categorias : null}
          />
          {navPos === "abajo" && <CategoriaNav categorias={categorias} />}
          <main className="flex-1">{children}</main>
          <Footer
            config={config}
            menu={menu}
            categorias={isTrueStr(config.nav_categorias_en_footer) ? categorias : null}
          />
          <WhatsappButton telefono={config.contacto_whatsapp} />
          {gaId && <GoogleAnalytics gaId={gaId} />}
        </CartProvider>
      </body>
    </html>
  );
}
