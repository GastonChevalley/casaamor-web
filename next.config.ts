import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Silencia el warning de "multiple lockfiles" — fijamos esta carpeta como root.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
