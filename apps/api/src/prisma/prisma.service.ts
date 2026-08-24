import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createPgAdapter, PrismaClient } from '@expense-tracker/db';

/**
 * Единственный клиент Prisma в API. Наследует `PrismaClient` и управляет подключением
 * по хукам жизненного цикла Nest вместо ручного `$connect`/`$disconnect`.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  /**
   * @param config - источник `DATABASE_URL` для driver adapter `@prisma/adapter-pg`.
   * @throws {Error} если `DATABASE_URL` не задана в окружении (`getOrThrow`).
   */
  constructor(config: ConfigService) {
    super({ adapter: createPgAdapter(config.getOrThrow<string>('DATABASE_URL')) });
  }

  /**
   * Хук жизненного цикла Nest: устанавливает соединение с PostgreSQL при старте модуля.
   * @returns ничего.
   */
  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Подключение к PostgreSQL установлено');
  }

  /**
   * Хук жизненного цикла Nest: закрывает соединение с PostgreSQL при остановке модуля.
   * @returns ничего.
   */
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
