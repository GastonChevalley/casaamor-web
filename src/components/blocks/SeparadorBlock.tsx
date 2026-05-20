import { safeColor } from "../../lib/sanitize";

export type SeparadorBlockConfig = {
  altura?: "sm" | "md" | "lg";
  color?: string;
  conLinea?: boolean;
};

export function SeparadorBlock({ config }: { config: SeparadorBlockConfig }) {
  const height = {
    sm: "py-4",
    md: "py-8",
    lg: "py-16",
  }[config.altura || "md"];

  const bgColor = safeColor(config.color);

  return (
    <div className={`${height}`} style={bgColor ? { backgroundColor: bgColor } : undefined}>
      {config.conLinea && (
        <div className="max-w-3xl mx-auto px-6">
          <hr className="border-burgundy/15" />
        </div>
      )}
    </div>
  );
}
