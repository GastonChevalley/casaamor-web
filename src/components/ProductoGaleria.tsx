"use client";

import { useState } from "react";
import { cloudinaryUrl } from "@/lib/img";

export function ProductoGaleria({
  fotos,
  nombre,
  badge,
}: {
  fotos: string[];
  nombre: string;
  badge?: React.ReactNode;
}) {
  const [activa, setActiva] = useState(0);
  const hayFotos = fotos.length > 0;
  const fotoActiva = hayFotos ? fotos[activa] : "";

  return (
    <div>
      {/* Foto principal */}
      <div className="relative aspect-square bg-cream rounded-2xl overflow-hidden border border-burgundy/10">
        {hayFotos ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cloudinaryUrl(fotoActiva, "detail")}
            alt={nombre}
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-heading text-9xl text-burgundy/15 select-none">
              {(nombre || "?").trim().charAt(0).toUpperCase() || "?"}
            </span>
          </div>
        )}
        {badge}
      </div>

      {/* Thumbnails (solo si hay 2+) */}
      {fotos.length > 1 && (
        <div className="mt-3 grid grid-cols-4 gap-2">
          {fotos.map((u, i) => (
            <button
              key={u + "-" + i}
              type="button"
              onClick={() => setActiva(i)}
              aria-label={`Ver foto ${i + 1}`}
              className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-colors ${
                i === activa
                  ? "border-burgundy"
                  : "border-burgundy/10 hover:border-burgundy/40"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cloudinaryUrl(u, "thumb")}
                alt={`${nombre} – foto ${i + 1}`}
                loading="lazy"
                className="absolute inset-0 w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
