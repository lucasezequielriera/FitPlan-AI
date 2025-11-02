import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: true,
  // Optimizaciones para producción
  poweredByHeader: false, // Remover header X-Powered-By por seguridad
};

export default nextConfig;
