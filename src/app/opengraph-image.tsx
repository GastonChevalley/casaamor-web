import { ImageResponse } from "next/og";

/**
 * Open Graph image default 1200×630 generada dinámicamente en build.
 * Next.js 16 convention — `app/opengraph-image.tsx` se inyecta automático en
 * los meta tags de la home. Las demás páginas usan su propia OG si la definen.
 *
 * Fondo cream-light con logo tipográfico burgundy/gold (mismo concepto que
 * el logo real). Sin asset binario externo — todo SVG inline.
 */

export const alt = "CasaAmor — Decoración con amor";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(135deg, #f9f3eb 0%, #ede3d7 100%)",
          color: "#7c2440",
          fontFamily: "Georgia, serif",
          padding: 80,
        }}
      >
        {/* Marca tipográfica al estilo del logo */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            lineHeight: 0.95,
          }}
        >
          <div
            style={{
              fontSize: 180,
              fontWeight: 700,
              color: "#7c2440",
              letterSpacing: -4,
            }}
          >
            CASA
          </div>
          <div
            style={{
              fontSize: 180,
              fontWeight: 700,
              color: "#c89e4b",
              letterSpacing: -4,
              marginTop: -20,
            }}
          >
            AMOR.
          </div>
        </div>

        {/* Tagline */}
        <div
          style={{
            marginTop: 40,
            fontSize: 42,
            color: "#7c2440",
            fontStyle: "italic",
            opacity: 0.85,
          }}
        >
          Decoración con amor
        </div>

        {/* Línea decorativa */}
        <div
          style={{
            marginTop: 30,
            width: 200,
            height: 3,
            background: "#c89e4b",
            borderRadius: 2,
          }}
        />
      </div>
    ),
    { ...size },
  );
}
