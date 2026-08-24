import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import type { SignOptions } from 'jsonwebtoken';
import { JwtAuthGuard } from './jwt-auth.guard';

/**
 * Инфраструктура JWT: конфигурация подписи и гард. Бизнес-логики здесь нет —
 * ни bcrypt, ни знания о пользователях. Не глобальный: модули импортируют явно.
 */
@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          // jsonwebtoken типизирует expiresIn форматной строкой (StringValue) — из ConfigService
          // приходит обычный string, поэтому явно приводим тип.
          expiresIn: (config.get<string>('JWT_EXPIRES_IN') ?? '15m') as SignOptions['expiresIn'],
        },
      }),
    }),
  ],
  providers: [JwtAuthGuard],
  // JwtModule — для AuthService (подпись токена), JwtAuthGuard — для контроллеров любых модулей.
  exports: [JwtModule, JwtAuthGuard],
})
export class AuthCoreModule {}
