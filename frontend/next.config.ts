import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async rewrites() {
    const backend = process.env.BACKEND_URL || 'http://localhost:4000';
    return [{ source: '/public/:path*', destination: `${backend}/public/:path*` }];
  }
};

export default nextConfig;
