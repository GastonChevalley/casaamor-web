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

  return (
    <div className={`${height}`} style={config.color ? { backgroundColor: config.color } : undefined}>
      {config.conLinea && (
        <div className="max-w-3xl mx-auto px-6">
          <hr className="border-burgundy/15" />
        </div>
      )}
    </div>
  );
}
