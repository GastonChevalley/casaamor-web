import type { Block, ConfigWeb } from "../lib/api";
import { HeroBlock, type HeroBlockConfig } from "./blocks/HeroBlock";
import { TextoBlock, type TextoBlockConfig } from "./blocks/TextoBlock";
import { GaleriaBlock, type GaleriaBlockConfig } from "./blocks/GaleriaBlock";
import {
  ProductosDestacadosBlock,
  type ProductosDestacadosBlockConfig,
} from "./blocks/ProductosDestacadosBlock";
import { BannerPromoBlock, type BannerPromoBlockConfig } from "./blocks/BannerPromoBlock";
import { TestimoniosBlock, type TestimoniosBlockConfig } from "./blocks/TestimoniosBlock";
import { SeparadorBlock, type SeparadorBlockConfig } from "./blocks/SeparadorBlock";
import { CtaContactoBlock, type CtaContactoBlockConfig } from "./blocks/CtaContactoBlock";
import { MarqueeBlock, type MarqueeBlockConfig } from "./blocks/MarqueeBlock";
import { CarruselBlock, type CarruselBlockConfig } from "./blocks/CarruselBlock";

export function BlockRenderer({
  block,
  config,
}: {
  block: Block;
  config: ConfigWeb;
}) {
  const cfg = block.config || {};
  switch (block.type) {
    case "hero":
      return (
        <HeroBlock
          config={cfg as HeroBlockConfig}
          whatsapp={config.contacto_whatsapp}
        />
      );
    case "texto":
      return <TextoBlock config={cfg as TextoBlockConfig} />;
    case "galeria":
      return <GaleriaBlock config={cfg as GaleriaBlockConfig} />;
    case "productos_destacados":
      return <ProductosDestacadosBlock config={cfg as ProductosDestacadosBlockConfig} />;
    case "banner_promo":
      return <BannerPromoBlock config={cfg as BannerPromoBlockConfig} />;
    case "testimonios":
      return <TestimoniosBlock config={cfg as TestimoniosBlockConfig} />;
    case "separador":
      return <SeparadorBlock config={cfg as SeparadorBlockConfig} />;
    case "marquee":
      return <MarqueeBlock config={cfg as MarqueeBlockConfig} />;
    case "carrusel_imagenes":
      return <CarruselBlock config={cfg as CarruselBlockConfig} />;
    case "cta_contacto":
      return (
        <CtaContactoBlock
          config={cfg as CtaContactoBlockConfig}
          whatsapp={config.contacto_whatsapp}
          instagram={config.contacto_instagram}
          email={config.contacto_email}
        />
      );
    default:
      return (
        <div className="max-w-3xl mx-auto p-6 my-6 rounded-xl bg-yellow-50 border border-yellow-300 text-yellow-900 text-sm">
          Tipo de bloque desconocido: <code>{block.type}</code>
        </div>
      );
  }
}
