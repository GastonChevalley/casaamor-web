import type { Metadata } from "next";
import "./globals.css";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { WhatsappButton } from "../components/WhatsappButton";
import { CategoriaNav } from "../components/CategoriaNav";
import { MarqueeFijo } from "../components/MarqueeFijo";
import { obtenerConfigWeb, obtenerMenu, obtenerCategorias, isTrueStr } from "../lib/api";
import { todasLasFontsClassName, fontVarPorId } from "../lib/fonts";

export async function generateMetadata(): Promise<Metadata> {
  const config = await obtenerConfigWeb();
  return {
    title: {
      default: `${config.site_title || "CasaAmor"} — ${config.site_tagline || "Decoración con amor"}`,
      template: `%s · ${config.site_title || "CasaAmor"}`,
    },
    description: config.site_descripcion,
    metadataBase: new URL("https://casaamor.com.ar"),
    openGraph: {
      title: config.site_title || "CasaAmor",
      description: config.site_tagline || "",
      locale: "es_AR",
      type: "website",
    },
    icons: {
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
    "--font-heading-active": `var(${fontHeadingVar})`,
    "--font-body-active":    `var(${fontBodyVar})`,
  } as React.CSSProperties;

  // Posición de las categorías en el header: 'inline' | 'abajo' | 'oculto'.
  // Default 'abajo' para compat con el comportamiento previo.
  const navPosRaw = String(config.nav_categorias_pos || "abajo").trim().toLowerCase();
  const navPos: "inline" | "abajo" | "oculto" =
    navPosRaw === "inline" || navPosRaw === "oculto" ? navPosRaw : "abajo";

  return (
    <html
      lang="es-AR"
      className={`${todasLasFontsClassName()} h-full antialiased`}
      style={themeStyle}
    >
      <body className="min-h-full flex flex-col bg-cream-light text-ink">
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
      </body>
    </html>
  );
}
