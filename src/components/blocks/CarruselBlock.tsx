"use client";

import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import Link from "next/link";
import { safeUrl, safeText } from "@/lib/sanitize";
import { cloudinaryUrl } from "@/lib/img";

export type CarruselBlockConfig = {
  titulo?: string;
  imagenes?: Array<{ url: string; alt?: string; caption?: string; link?: string }>;
  autoplay?: boolean;          // default true
  intervaloMs?: number;        // default 4000
  mostrarIndicadores?: boolean; // default true
  mostrarFlechas?: boolean;    // default true
  altura?: "sm" | "md" | "lg"; // aspect ratio del slide
};

const ALTURA_CLASSES: Record<NonNullable<CarruselBlockConfig["altura"]>, string> = {
  sm: "aspect-[16/9] sm:aspect-[21/9]",
  md: "aspect-[4/3] sm:aspect-[16/9]",
  lg: "aspect-[3/4] sm:aspect-[16/10]",
};

export function CarruselBlock({ config }: { config: CarruselBlockConfig }) {
  const imagenes = (config?.imagenes || []).filter((img) => img && img.url);
  const autoplay = config?.autoplay !== false;
  const intervalo = Math.max(1500, Math.min(20000, Number(config?.intervaloMs) || 4000));
  const mostrarIndicadores = config?.mostrarIndicadores !== false;
  const mostrarFlechas = config?.mostrarFlechas !== false;
  const altura = ALTURA_CLASSES[config?.altura || "md"];

  const plugins = autoplay
    ? [Autoplay({ delay: intervalo, stopOnInteraction: false, stopOnMouseEnter: true })]
    : [];

  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: "start" }, plugins);
  const [selected, setSelected] = useState(0);
  const [snaps, setSnaps] = useState<number[]>([]);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);
  const scrollTo = useCallback((idx: number) => emblaApi?.scrollTo(idx), [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelected(emblaApi.selectedScrollSnap());
    setSnaps(emblaApi.scrollSnapList());
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", () => {
      setSnaps(emblaApi.scrollSnapList());
      onSelect();
    });
    onSelect();
  }, [emblaApi]);

  if (imagenes.length === 0) return null;

  const titulo = config?.titulo ? safeText(config.titulo) : "";

  return (
    <section className="my-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {titulo && (
          <h2 className="font-heading text-2xl sm:text-3xl text-burgundy text-center mb-6">
            {titulo}
          </h2>
        )}
        <div className="relative">
          <div className="overflow-hidden rounded-2xl" ref={emblaRef}>
            <div className="flex">
              {imagenes.map((img, i) => {
                const link = safeUrl(img.link || "");
                const slide = (
                  <div
                    className={`relative ${altura} bg-cream flex-[0_0_100%] min-w-0`}
                    key={`slide-${i}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={cloudinaryUrl(img.url, "carrusel")}
                      alt={img.alt || ""}
                      className="absolute inset-0 w-full h-full object-cover"
                      loading={i === 0 ? "eager" : "lazy"}
                    />
                    {img.caption && (
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-burgundy/80 to-transparent text-cream-light p-4 sm:p-6">
                        <p className="font-heading text-lg sm:text-xl">{safeText(img.caption)}</p>
                      </div>
                    )}
                  </div>
                );
                return link ? (
                  <Link
                    key={`link-${i}`}
                    href={link}
                    className="flex-[0_0_100%] min-w-0 block"
                    aria-label={img.alt || `Slide ${i + 1}`}
                  >
                    {slide}
                  </Link>
                ) : (
                  slide
                );
              })}
            </div>
          </div>

          {mostrarFlechas && imagenes.length > 1 && (
            <>
              <button
                onClick={scrollPrev}
                aria-label="Anterior"
                className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-cream-light/90 hover:bg-cream-light text-burgundy rounded-full w-10 h-10 flex items-center justify-center shadow-lg transition-colors"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <button
                onClick={scrollNext}
                aria-label="Siguiente"
                className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-cream-light/90 hover:bg-cream-light text-burgundy rounded-full w-10 h-10 flex items-center justify-center shadow-lg transition-colors"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </>
          )}
        </div>

        {mostrarIndicadores && snaps.length > 1 && (
          <div className="flex justify-center gap-2 mt-4">
            {snaps.map((_, i) => (
              <button
                key={i}
                onClick={() => scrollTo(i)}
                aria-label={`Ir al slide ${i + 1}`}
                className={`h-2 rounded-full transition-all ${
                  i === selected ? "w-8 bg-burgundy" : "w-2 bg-burgundy/30 hover:bg-burgundy/50"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
