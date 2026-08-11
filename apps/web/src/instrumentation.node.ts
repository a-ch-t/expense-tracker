import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvConfig } from '@next/env';

// Импортируется только из instrumentation.ts под проверкой NEXT_RUNTIME === 'nodejs'.
// Путь считаем от cwd, а не от import.meta.url: Turbopack принимает
// `new URL('...', import.meta.url)` за импорт ресурса и пытается его резолвить.
// cwd у next dev/start — каталог приложения apps/web, корень репозитория на два уровня выше.
const repoRoot = resolve(process.cwd(), '../..');

// Ищем любой .env*, а не только .env: loadEnvConfig читает и .env.local,
// и .env.development*, и .env.production*.
const hasEnvFile = readdirSync(repoRoot).some((name) => name.startsWith('.env'));

if (!hasEnvFile) {
  // Молча пропустить нельзя: без переменных отвалится первый же запрос к API,
  // и выглядеть это будет как недоступный бэкенд, а не как забытый .env.
  console.error(
    `[instrumentation] В ${repoRoot} нет ни одного .env-файла. ` +
      'Запросы к API упадут: начните с `cp .env.example .env` в корне репозитория.',
  );
}

loadEnvConfig(
  repoRoot,
  process.env['NODE_ENV'] !== 'production',
  console,
  // forceReload обязателен: loadEnvConfig выходит сразу, если в process.env уже стоит
  // флаг __NEXT_PROCESSED_ENV — а его выставит сам Next, стоит появиться apps/web/.env*.
  true,
);
