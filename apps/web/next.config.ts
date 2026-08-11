import { fileURLToPath } from 'node:url';
import { loadEnvConfig } from '@next/env';
import type { NextConfig } from 'next';

// fileURLToPath, а не URL.pathname: pathname percent-энкодит не-ASCII символы,
// и путь с кириллицей превращается в несуществующий каталог.
const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

// .env лежит в корне монорепозитория, а Next ищет его в apps/web.
// loadEnvConfig — штатный способ подсунуть ему другой каталог.
loadEnvConfig(repoRoot);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Монорепозиторий: корень трейсинга файлов — папка репозитория, а не apps/web
  outputFileTracingRoot: repoRoot,
};

export default nextConfig;
