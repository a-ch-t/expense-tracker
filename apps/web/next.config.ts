import { loadEnvConfig } from '@next/env';
import type { NextConfig } from 'next';

const repoRoot = new URL('../..', import.meta.url).pathname;

// .env лежит в корне монорепозитория, а Next ищет его в apps/web.
// loadEnvConfig — штатный способ подсунуть ему другой каталог.
loadEnvConfig(repoRoot);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Монорепозиторий: корень трейсинга файлов — папка репозитория, а не apps/web
  outputFileTracingRoot: repoRoot,
};

export default nextConfig;
