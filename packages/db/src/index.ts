import { PrismaPg } from '@prisma/adapter-pg';

// Каталог ./generated создаётся командой `npm run db:generate`
// и не хранится в git — до первой генерации импорт не резолвится.
import { PrismaClient } from './generated/client';

export * from './generated/client';

/**
 * Driver adapter поверх pg. В Prisma 7 адаптер обязателен:
 * Rust-движок запросов по умолчанию не используется.
 *
 * Вынесен сюда, чтобы потребители (apps/api) не тянули @prisma/adapter-pg напрямую.
 */
export function createPgAdapter(connectionString?: string): PrismaPg {
  const url = connectionString ?? process.env['DATABASE_URL'];

  if (!url) {
    throw new Error('DATABASE_URL не задан: скопируйте .env.example в .env');
  }

  return new PrismaPg({ connectionString: url });
}

/** Готовый клиент для скриптов вне NestJS (seed, миграции данных). */
export function createPrismaClient(connectionString?: string): PrismaClient {
  return new PrismaClient({ adapter: createPgAdapter(connectionString) });
}
