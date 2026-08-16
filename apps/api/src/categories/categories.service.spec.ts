import { Test } from '@nestjs/testing';
import { QueryBus } from '@nestjs/cqrs';
import { ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@expense-tracker/db';
import { GetUserByIdQuery } from '../contracts/users';
import { CategoriesRepository } from './categories.repository';
import { CategoriesService } from './categories.service';
import type { CategoryReadModel } from '../contracts/categories';

const prismaError = (code: string): Prisma.PrismaClientKnownRequestError =>
  new Prisma.PrismaClientKnownRequestError('mock', { code, clientVersion: 'test' });

const OWNER = { id: 'user-1', name: 'Owner', email: 'owner@example.com', createdAt: new Date() };

const CATEGORY: CategoryReadModel = {
  id: 'category-1',
  name: 'Еда',
  color: '#ff8800',
  icon: 'shopping-cart',
  createdAt: new Date(),
};

describe('CategoriesService', () => {
  let service: CategoriesService;
  let repository: jest.Mocked<CategoriesRepository>;
  let queryBus: { execute: jest.Mock };

  beforeEach(async () => {
    const repositoryMock: jest.Mocked<CategoriesRepository> = {
      create: jest.fn(),
      findAllByUser: jest.fn(),
      findByIdForUser: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    } as unknown as jest.Mocked<CategoriesRepository>;

    queryBus = { execute: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: CategoriesRepository, useValue: repositoryMock },
        { provide: QueryBus, useValue: queryBus },
      ],
    }).compile();

    service = module.get(CategoriesService);
    repository = module.get(CategoriesRepository);
  });

  describe('create', () => {
    it('проверяет владельца через QueryBus с GetUserByIdQuery', async () => {
      queryBus.execute.mockResolvedValue(OWNER);
      repository.create.mockResolvedValue(CATEGORY);

      await service.create('user-1', { name: 'Еда', color: '#FF8800', icon: 'shopping-cart' });

      expect(queryBus.execute).toHaveBeenCalledWith(expect.any(GetUserByIdQuery));
      const query = queryBus.execute.mock.calls[0][0] as GetUserByIdQuery;
      expect(query.id).toBe('user-1');
    });

    it('бросает UnauthorizedException, если владелец не найден, и не вызывает репозиторий', async () => {
      queryBus.execute.mockResolvedValue(null);

      await expect(
        service.create('user-1', { name: 'Еда', color: '#FF8800', icon: 'shopping-cart' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('передаёт в репозиторий userId из аргумента, обрезанное name и color в нижнем регистре', async () => {
      queryBus.execute.mockResolvedValue(OWNER);
      repository.create.mockResolvedValue(CATEGORY);

      await service.create('user-1', {
        name: '  Еда  ',
        color: '#FF8800',
        icon: 'shopping-cart',
      });

      expect(repository.create).toHaveBeenCalledWith('user-1', {
        name: 'Еда',
        color: '#ff8800',
        icon: 'shopping-cart',
      });
    });

    it('превращает P2002 в ConflictException', async () => {
      queryBus.execute.mockResolvedValue(OWNER);
      repository.create.mockRejectedValue(prismaError('P2002'));

      await expect(
        service.create('user-1', { name: 'Еда', color: '#FF8800', icon: 'shopping-cart' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('превращает P2003 в UnauthorizedException', async () => {
      queryBus.execute.mockResolvedValue(OWNER);
      repository.create.mockRejectedValue(prismaError('P2003'));

      await expect(
        service.create('user-1', { name: 'Еда', color: '#FF8800', icon: 'shopping-cart' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('пробрасывает неизвестную ошибку как есть', async () => {
      queryBus.execute.mockResolvedValue(OWNER);
      const unknownError = new Error('boom');
      repository.create.mockRejectedValue(unknownError);

      await expect(
        service.create('user-1', { name: 'Еда', color: '#FF8800', icon: 'shopping-cart' }),
      ).rejects.toBe(unknownError);
    });
  });

  describe('findAll', () => {
    it('вызывает findAllByUser ровно с переданным userId и возвращает результат без изменений', async () => {
      repository.findAllByUser.mockResolvedValue([CATEGORY]);

      const result = await service.findAll('user-1');

      expect(repository.findAllByUser).toHaveBeenCalledWith('user-1');
      expect(result).toEqual([CATEGORY]);
    });
  });

  describe('findOne', () => {
    it('бросает NotFoundException, если категория не найдена (чужая или несуществующая)', async () => {
      repository.findByIdForUser.mockResolvedValue(null);

      await expect(service.findOne('user-1', 'category-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('возвращает read-модель, если категория найдена', async () => {
      repository.findByIdForUser.mockResolvedValue(CATEGORY);

      const result = await service.findOne('user-1', 'category-1');

      expect(result).toEqual(CATEGORY);
    });
  });

  describe('update', () => {
    it('передаёт в репозиторий только переданные поля', async () => {
      repository.update.mockResolvedValue(CATEGORY);

      await service.update('user-1', 'category-1', { color: '#00FF00' });

      expect(repository.update).toHaveBeenCalledWith('category-1', 'user-1', {
        color: '#00ff00',
      });
    });

    it('передаёт userId в репозиторий вместе с id', async () => {
      repository.update.mockResolvedValue(CATEGORY);

      await service.update('user-1', 'category-1', { name: 'Транспорт' });

      expect(repository.update).toHaveBeenCalledWith(
        'category-1',
        'user-1',
        expect.objectContaining({ name: 'Транспорт' }),
      );
    });

    it('превращает P2025 в NotFoundException', async () => {
      repository.update.mockRejectedValue(prismaError('P2025'));

      await expect(service.update('user-1', 'category-1', { name: 'X' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('превращает P2002 в ConflictException', async () => {
      repository.update.mockRejectedValue(prismaError('P2002'));

      await expect(service.update('user-1', 'category-1', { name: 'X' })).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('remove', () => {
    it('превращает P2025 в NotFoundException', async () => {
      repository.remove.mockRejectedValue(prismaError('P2025'));

      await expect(service.remove('user-1', 'category-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('превращает P2003 в ConflictException: категорию держат транзакции', async () => {
      repository.remove.mockRejectedValue(prismaError('P2003'));

      await expect(service.remove('user-1', 'category-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('успешно завершается без возвращаемого значения', async () => {
      repository.remove.mockResolvedValue(undefined);

      await expect(service.remove('user-1', 'category-1')).resolves.toBeUndefined();
    });
  });
});
