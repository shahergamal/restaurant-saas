import type { NextConfig } from 'next';

const api = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';

const config: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  // @sufra/shared is compiled from its TypeScript source (see tsconfig paths).
  experimental: { externalDir: true },
  poweredByHeader: false,
  // The browser only talks to this origin; /api/v1/* is proxied to the NestJS API.
  async rewrites() {
    return [{ source: '/api/v1/:path*', destination: `${api}/v1/:path*` }];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
        ],
      },
    ];
  },
};

export default config;
