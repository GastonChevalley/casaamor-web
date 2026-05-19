import Link from "next/link";

export type BannerPromoBlockConfig = {
  texto?: string;
  ctaText?: string;
  ctaLink?: string;
  color?: "burgundy" | "gold" | "rose";
  activo?: boolean;
};

export function BannerPromoBlock({ config }: { config: BannerPromoBlockConfig }) {
  if (config.activo === false) return null;

  const palette = {
    burgundy: "bg-burgundy text-cream-light",
    gold: "bg-gold text-burgundy",
    rose: "bg-rose text-cream-light",
  }[config.color || "gold"];

  return (
    <div className={`${palette} text-center py-3 px-4 text-sm font-semibold`}>
      <span>{config.texto || ""}</span>
      {config.ctaLink && config.ctaText && (
        <Link href={config.ctaLink} className="ml-3 underline hover:opacity-80">
          {config.ctaText}
        </Link>
      )}
    </div>
  );
}
