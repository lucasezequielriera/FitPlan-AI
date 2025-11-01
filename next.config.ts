import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: true,
  // Optimizaciones para producción
  output: 'standalone', // Esto crea una versión standalone más pequeña (opcional)
  poweredByHeader: false, // Remover header X-Powered-By por seguridad
};

export default nextConfig;
