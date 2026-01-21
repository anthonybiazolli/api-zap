import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/interno/:path*',
        // CORREÇÃO: Adicionado '/api' antes de /:path*
        // Agora o frontend manda para /api/interno/... e o backend recebe em /api/...
        destination: 'http://dispia-backend:3000/api/:path*',
      },
    ];
  },
};

export default nextConfig;