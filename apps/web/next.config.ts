import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Монорепозиторий: корень трейсинга файлов — папка репозитория, а не apps/web
  outputFileTracingRoot: new URL('../..', import.meta.url).pathname,
};

export default nextConfig;
