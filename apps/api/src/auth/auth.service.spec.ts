import { Test } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import {
  CreateUserCommand,
  GetUserByEmailQuery,
  type UserCredentials,
  type UserReadModel,
} from '../contracts/users';
import { AuthService } from './auth.service';

const PASSWORD = 'correct-horse';

const USER: UserReadModel = {
  id: 'user-1',
  name: 'Анна',
  email: 'anna@example.com',
  createdAt: new Date('2026-08-01T00:00:00.000Z'),
};

/** Хэш настоящего пароля: логин обязан сверяться с ним, а не с самим паролем. */
const PASSWORD_HASH = bcrypt.hashSync(PASSWORD, 10);

const CREDENTIALS: UserCredentials = { ...USER, passwordHash: PASSWORD_HASH };

describe('AuthService', () => {
  let service: AuthService;
  let commandBus: { execute: jest.Mock };
  let queryBus: { execute: jest.Mock };
  let jwtService: { sign: jest.Mock };

  beforeEach(async () => {
    commandBus = { execute: jest.fn() };
    queryBus = { execute: jest.fn() };
    jwtService = { sign: jest.fn().mockReturnValue('signed-token') };

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: CommandBus, useValue: commandBus },
        { provide: QueryBus, useValue: queryBus },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  describe('register', () => {
    it('отправляет в CreateUserCommand хэш, а не сам пароль', async () => {
      commandBus.execute.mockResolvedValue(USER);

      await service.register({ name: 'Анна', email: 'anna@example.com', password: PASSWORD });

      const command = commandBus.execute.mock.calls[0][0] as CreateUserCommand;
      expect(command).toBeInstanceOf(CreateUserCommand);
      expect(command.passwordHash).not.toBe(PASSWORD);
      await expect(bcrypt.compare(PASSWORD, command.passwordHash)).resolves.toBe(true);
    });

    it('возвращает токен и пользователя без хэша пароля', async () => {
      commandBus.execute.mockResolvedValue(USER);

      const result = await service.register({
        name: 'Анна',
        email: 'anna@example.com',
        password: PASSWORD,
      });

      expect(result).toEqual({ accessToken: 'signed-token', user: USER });
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('пробрасывает ConflictException занятого email как есть', async () => {
      commandBus.execute.mockRejectedValue(new ConflictException('занято'));

      await expect(
        service.register({ name: 'Анна', email: 'anna@example.com', password: PASSWORD }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('login', () => {
    it('ищет пользователя запросом GetUserByEmailQuery с переданным email', async () => {
      queryBus.execute.mockResolvedValue(CREDENTIALS);

      await service.login({ email: 'anna@example.com', password: PASSWORD });

      const query = queryBus.execute.mock.calls[0][0] as GetUserByEmailQuery;
      expect(query).toBeInstanceOf(GetUserByEmailQuery);
      expect(query.email).toBe('anna@example.com');
    });

    it('отвечает 401, когда пользователя с таким email нет', async () => {
      queryBus.execute.mockResolvedValue(null);

      await expect(
        service.login({ email: 'ghost@example.com', password: PASSWORD }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('отвечает 401 при неверном пароле', async () => {
      queryBus.execute.mockResolvedValue(CREDENTIALS);

      await expect(
        service.login({ email: 'anna@example.com', password: 'wrong-password' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('не различает несуществующий email и неверный пароль текстом ошибки', async () => {
      queryBus.execute.mockResolvedValueOnce(null);
      const unknownEmail = await service
        .login({ email: 'ghost@example.com', password: PASSWORD })
        .catch((error: UnauthorizedException) => error.message);

      queryBus.execute.mockResolvedValueOnce(CREDENTIALS);
      const wrongPassword = await service
        .login({ email: 'anna@example.com', password: 'wrong-password' })
        .catch((error: UnauthorizedException) => error.message);

      expect(unknownEmail).toBe(wrongPassword);
    });

    it('не отдаёт хэш пароля в ответе при успешном входе', async () => {
      queryBus.execute.mockResolvedValue(CREDENTIALS);

      const result = await service.login({ email: 'anna@example.com', password: PASSWORD });

      expect(result).toEqual({ accessToken: 'signed-token', user: USER });
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(JSON.stringify(result)).not.toContain(PASSWORD_HASH);
    });

    it('кладёт в токен только id и email', async () => {
      queryBus.execute.mockResolvedValue(CREDENTIALS);

      await service.login({ email: 'anna@example.com', password: PASSWORD });

      expect(jwtService.sign).toHaveBeenCalledWith({ sub: USER.id, email: USER.email });
    });
  });
});
