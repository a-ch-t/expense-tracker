import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { JwtAuthGuard } from '../common/auth';
import { GetUserByIdQuery, type UserReadModel } from '../contracts/users';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

const USER: UserReadModel = {
  id: 'user-1',
  name: 'Анна',
  email: 'anna@example.com',
  createdAt: new Date('2026-08-01T00:00:00.000Z'),
};

const PAYLOAD = { sub: USER.id, email: USER.email };

describe('AuthController', () => {
  let controller: AuthController;
  let queryBus: { execute: jest.Mock };

  beforeEach(async () => {
    queryBus = { execute: jest.fn() };

    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: { register: jest.fn(), login: jest.fn() } },
        { provide: QueryBus, useValue: queryBus },
      ],
    })
      // Методы контроллера зовём напрямую, до гарда дело не доходит. Подмена нужна,
      // чтобы Nest не собирал настоящий JwtAuthGuard с его зависимостью от JwtService.
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(AuthController);
  });

  describe('me', () => {
    it('ищет пользователя по sub из токена, а не по чему-либо из запроса', async () => {
      queryBus.execute.mockResolvedValue(USER);

      await controller.me(PAYLOAD);

      const query = queryBus.execute.mock.calls[0][0] as GetUserByIdQuery;
      expect(query).toBeInstanceOf(GetUserByIdQuery);
      expect(query.id).toBe(USER.id);
    });

    it('возвращает read-модель пользователя', async () => {
      queryBus.execute.mockResolvedValue(USER);

      await expect(controller.me(PAYLOAD)).resolves.toEqual(USER);
    });

    it('отвечает 401 на валидный токен удалённого пользователя', async () => {
      // Токен подписан и не истёк, но записи в User больше нет
      queryBus.execute.mockResolvedValue(null);

      await expect(controller.me(PAYLOAD)).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
