import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@expense-tracker/db';
import { CategoriesRepository } from './categories.repository';
import { CategoriesService } from './categories.service';
import type { CategoryReadModel } from '../contracts/categories';

const prismaError = (code: string): Prisma.PrismaClientKnownRequestError =>
  new Prisma.PrismaClientKnownRequestError('mock', { code, clientVersion: 'test' });

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

  beforeEach(async () => {
    const repositoryMock: jest.Mocked<CategoriesRepository> = {
      create: jest.fn(),
      findAllByUser: jest.fn(),
      findByIdForUser: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    } as unknown as jest.Mocked<CategoriesRepository>;

    const module = await Test.createTestingModule({
      providers: [CategoriesService, { provide: CategoriesRepository, useValue: repositoryMock }],
    }).compile();

    service = module.get(CategoriesService);
    repository = module.get(CategoriesRepository);
  });

  describe('create', () => {
    it('передаёт в репозиторий userId из аргумента, обрезанное name и color в нижнем регистре', async () => {
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
      repository.create.mockRejectedValue(prismaError('P2002'));

      await expect(
        service.create('user-1', { name: 'Еда', color: '#FF8800', icon: 'shopping-cart' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('превращает P2003 в UnauthorizedException', async () => {
      repository.create.mockRejectedValue(prismaError('P2003'));

      await expect(
        service.create('user-1', { name: 'Еда', color: '#FF8800', icon: 'shopping-cart' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('пробрасывает неизвестную ошибку как есть', async () => {
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
