import type { Metadata } from "next";
import "./globals.css";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { WhatsappButton } from "../components/WhatsappButton";
import { obtenerConfigWeb, obtenerMenu } from "../lib/api";
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
  // Datos desde Apps Script — todo el árbol (Header, Footer) los lee también.
  const [config, menu] = await Promise.all([obtenerConfigWeb(), obtenerMenu()]);

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
    "--font-heading-active": `var(${fontHeadingVar})`,
    "--font-body-active":    `var(${fontBodyVar})`,
  } as React.CSSProperties;

  return (
    <html
      lang="es-AR"
      className={`${todasLasFontsClassName()} h-full antialiased`}
      style={themeStyle}
    >
      <body className="min-h-full flex flex-col bg-cream-light text-ink">
        <Header config={config} menu={menu} />
        <main className="flex-1">{children}</main>
        <Footer config={config} menu={menu} />
        <WhatsappButton telefono={config.contacto_whatsapp} />
      </body>
    </html>
  );
}
