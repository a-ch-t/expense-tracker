import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/** Глобальный модуль доступа к БД: экспортирует `PrismaService`, импортировать явно не нужно. */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
