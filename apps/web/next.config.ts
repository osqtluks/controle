import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@ct/core"],
  // Fotos são comprimidas no navegador antes de subir; 3 MB é folga para o resto do formulário.
  experimental: { serverActions: { bodySizeLimit: "3mb" } },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
