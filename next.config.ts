import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // CSS Modules are on by default in Next.js
  // External packages that need to run on server (none for now)
  
  images: {
    // Allow external image domains when ready
    remotePatterns: [],
  },

  // Strict mode for React
  reactStrictMode: true,

  // TypeScript strict checking on build
  typescript: {
    ignoreBuildErrors: false,
  },

  // Headers for security (Phase 9 will expand these)
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;

