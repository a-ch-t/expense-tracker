import { Test } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { Prisma } from '@expense-tracker/db';
import {
  CreateUserCommand,
  GetUserByEmailQuery,
  GetUserByIdQuery,
  type UserCredentials,
  type UserReadModel,
} from '../contracts/users';
import { CreateUserHandler } from './handlers/create-user.handler';
import { GetUserByEmailHandler } from './handlers/get-user-by-email.handler';
import { GetUserByIdHandler } from './handlers/get-user-by-id.handler';
import { UsersRepository } from './users.repository';

const prismaError = (code: string): Prisma.PrismaClientKnownRequestError =>
  new Prisma.PrismaClientKnownRequestError('mock', { code, clientVersion: 'test' });

const USER: UserReadModel = {
  id: 'user-1',
  name: 'Анна',
  email: 'anna@example.com',
  createdAt: new Date(),
};

const CREDENTIALS: UserCredentials = { ...USER, passwordHash: 'hash' };

describe('users handlers', () => {
  let createUser: CreateUserHandler;
  let getUserByEmail: GetUserByEmailHandler;
  let getUserById: GetUserByIdHandler;
  let repository: jest.Mocked<UsersRepository>;

  beforeEach(async () => {
    const repositoryMock = {
      create: jest.fn(),
      findByEmail: jest.fn(),
      findById: jest.fn(),
    } as unknown as jest.Mocked<UsersRepository>;

    const module = await Test.createTestingModule({
      providers: [
        CreateUserHandler,
        GetUserByEmailHandler,
        GetUserByIdHandler,
        { provide: UsersRepository, useValue: repositoryMock },
      ],
    }).compile();

    createUser = module.get(CreateUserHandler);
    getUserByEmail = module.get(GetUserByEmailHandler);
    getUserById = module.get(GetUserByIdHandler);
    repository = module.get(UsersRepository);
  });

  describe('CreateUserHandler', () => {
    it('сохраняет email в нижнем регистре и без окружающих пробелов', async () => {
      repository.create.mockResolvedValue(USER);

      await createUser.execute(new CreateUserCommand('Анна', '  Anna@Example.COM ', 'hash'));

      expect(repository.create).toHaveBeenCalledWith('Анна', 'anna@example.com', 'hash');
    });

    it('превращает P2002 в ConflictException', async () => {
      repository.create.mockRejectedValue(prismaError('P2002'));

      await expect(
        createUser.execute(new CreateUserCommand('Анна', 'anna@example.com', 'hash')),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('пробрасывает неизвестную ошибку как есть', async () => {
      const unknownError = new Error('boom');
      repository.create.mockRejectedValue(unknownError);

      await expect(
        createUser.execute(new CreateUserCommand('Анна', 'anna@example.com', 'hash')),
      ).rejects.toBe(unknownError);
    });
  });

  describe('GetUserByEmailHandler', () => {
    it('ищет по email в нижнем регистре и без окружающих пробелов', async () => {
      repository.findByEmail.mockResolvedValue(CREDENTIALS);

      await getUserByEmail.execute(new GetUserByEmailQuery('  Anna@Example.COM '));

      expect(repository.findByEmail).toHaveBeenCalledWith('anna@example.com');
    });

    it('возвращает null, когда пользователя с таким email нет', async () => {
      repository.findByEmail.mockResolvedValue(null);

      await expect(
        getUserByEmail.execute(new GetUserByEmailQuery('anna@example.com')),
      ).resolves.toBeNull();
    });
  });

  it('вход находит пользователя, зарегистрированного с другим регистром email', async () => {
    // Регистрация и поиск при входе должны прийти в репозиторий одинаковым email:
    // колонка User.email — обычный TEXT с регистрозависимым UNIQUE-индексом.
    repository.create.mockResolvedValue(USER);
    repository.findByEmail.mockResolvedValue(CREDENTIALS);

    await createUser.execute(new CreateUserCommand('Анна', 'Anna@Example.com', 'hash'));
    await getUserByEmail.execute(new GetUserByEmailQuery('anna@EXAMPLE.com'));

    const registeredEmail = repository.create.mock.calls[0]?.[1];
    const loginEmail = repository.findByEmail.mock.calls[0]?.[0];
    expect(loginEmail).toBe(registeredEmail);
  });

  describe('GetUserByIdHandler', () => {
    it('возвращает read-модель без хэша пароля', async () => {
      repository.findById.mockResolvedValue(USER);

      const result = await getUserById.execute(new GetUserByIdQuery('user-1'));

      expect(result).toEqual(USER);
      expect(repository.findById).toHaveBeenCalledWith('user-1');
    });

    it('возвращает null для несуществующего пользователя', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(getUserById.execute(new GetUserByIdQuery('user-1'))).resolves.toBeNull();
    });
  });
});
