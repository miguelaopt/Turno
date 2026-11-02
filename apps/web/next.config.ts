import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // O pacote partilhado é TypeScript sem build: o Next transpila-o.
  transpilePackages: ['@turno/shared'],
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
