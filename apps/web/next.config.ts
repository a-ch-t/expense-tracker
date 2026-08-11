import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

// fileURLToPath, а не URL.pathname: pathname percent-энкодит не-ASCII символы,
// и путь с кириллицей превращается в несуществующий каталог.
const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

// Корневой .env грузится в src/instrumentation.node.ts, а не здесь: конфиг исполняется
// в отдельном процессе, и process.env серверного рантайма от него не наследуется.

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Монорепозиторий: корень трейсинга файлов — папка репозитория, а не apps/web
  outputFileTracingRoot: repoRoot,
};

export default nextConfig;
