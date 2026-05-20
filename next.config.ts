import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Silencia el warning de "multiple lockfiles" — fijamos esta carpeta como root.
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Permitir imágenes remotas (Cloudinary, Drive público, hosts comunes).
  // El frontend pasa toda URL externa por `safeUrl()` antes de meterla en
  // `<Image src>`, así que protocolo y forma están validados.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "drive.google.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "**.cloudinary.com" },
    ],
  },
};

export default nextConfig;
