import { resolve } from 'node:path';
import { loadEnvConfig } from '@next/env';

// Импортируется только из instrumentation.ts под проверкой NEXT_RUNTIME === 'nodejs'.
// Путь считаем от cwd, а не от import.meta.url: Turbopack принимает
// `new URL('...', import.meta.url)` за импорт ресурса и пытается его резолвить.
// cwd у next dev/start — каталог приложения apps/web, корень репозитория на два уровня выше.
loadEnvConfig(resolve(process.cwd(), '../..'));
