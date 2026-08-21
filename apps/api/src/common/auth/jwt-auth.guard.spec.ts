import { Test } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CqrsModule, QueryBus } from '@nestjs/cqrs';
import { JwtService } from '@nestjs/jwt';
import { GetUserByIdQuery, type UserReadModel } from '../../contracts/users';
import { AuthCoreModule } from './auth-core.module';
import { JwtAuthGuard, type AuthenticatedRequest } from './jwt-auth.guard';
import type { JwtPayload } from './jwt-payload';

const PAYLOAD: JwtPayload = { sub: 'user-1', email: 'anna@example.com' };

const USER: UserReadModel = {
  id: 'user-1',
  name: 'Анна',
  email: 'anna@example.com',
  createdAt: new Date('2026-08-01T00:00:00.000Z'),
};

/** Контекст с одним заголовком Authorization — больше гарду ничего не нужно. */
function contextWith(authorization?: string): {
  context: ExecutionContext;
  request: Partial<AuthenticatedRequest>;
} {
  const request: Partial<AuthenticatedRequest> = {
    headers: authorization === undefined ? {} : { authorization },
  };

  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;

  return { context, request };
}

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let jwtService: { verifyAsync: jest.Mock };
  let queryBus: { execute: jest.Mock };

  beforeEach(async () => {
    jwtService = { verifyAsync: jest.fn().mockResolvedValue(PAYLOAD) };
    queryBus = { execute: jest.fn().mockResolvedValue(USER) };

    const module = await Test.createTestingModule({
      providers: [
        JwtAuthGuard,
        { provide: JwtService, useValue: jwtService },
        { provide: QueryBus, useValue: queryBus },
      ],
    }).compile();

    guard = module.get(JwtAuthGuard);
  });

  describe('токен', () => {
    it('отвечает 401 без заголовка Authorization', async () => {
      const { context } = contextWith();

      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('отвечает 401, когда схема не Bearer', async () => {
      const { context } = contextWith('Basic dXNlcjpwYXNz');

      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('отвечает 401 на недействительную подпись', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('invalid signature'));
      const { context } = contextWith('Bearer broken.token.here');

      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('существование пользователя', () => {
    it('отвечает 401 на валидный токен удалённого пользователя', async () => {
      // Подпись верна и срок не вышел, но записи в User больше нет
      queryBus.execute.mockResolvedValue(null);
      const { context } = contextWith('Bearer valid.token.here');

      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('спрашивает пользователя по sub из токена', async () => {
      const { context } = contextWith('Bearer valid.token.here');

      await guard.canActivate(context);

      const query = queryBus.execute.mock.calls[0][0] as GetUserByIdQuery;
      expect(query).toBeInstanceOf(GetUserByIdQuery);
      expect(query.id).toBe(PAYLOAD.sub);
    });

    it('не ходит за пользователем, если токен не прошёл проверку', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('invalid signature'));
      const { context } = contextWith('Bearer broken.token.here');

      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
      expect(queryBus.execute).not.toHaveBeenCalled();
    });
  });

  describe('успешный проход', () => {
    it('пропускает запрос и кладёт payload в request.user', async () => {
      const { context, request } = contextWith('Bearer valid.token.here');

      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(request.user).toEqual(PAYLOAD);
    });
  });
});

describe('проводка JwtAuthGuard', () => {
  // Гард инжектит QueryBus, а AuthCoreModule не импортирует CqrsModule — тот глобальный
  // из-за forRoot() в AppModule. Юнит-тесты выше подсовывают QueryBus вручную и такую
  // ошибку не заметили бы, поэтому собираем настоящий граф модулей.
  it('собирается из AuthCoreModule, когда CqrsModule зарегистрирован глобально', async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [() => ({ JWT_SECRET: 'test-secret' })] }),
        CqrsModule.forRoot(),
        AuthCoreModule,
      ],
    }).compile();

    expect(module.get(JwtAuthGuard)).toBeInstanceOf(JwtAuthGuard);
  });
});
