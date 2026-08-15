import { Test } from '@nestjs/testing';
import { QueryBus } from '@nestjs/cqrs';
import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Prisma, TransactionType } from '@expense-tracker/db';
import {
  GetCategoriesByUserQuery,
  GetCategoryByIdQuery,
  type CategoryReadModel,
} from '../contracts/categories';
import { GetUserByIdQuery } from '../contracts/users';
import type { CreateTransactionDto } from './dto/create-transaction.dto';
import type { TransactionRecord, TransactionsSummary } from './transaction.read-model';
import { TransactionsRepository } from './transactions.repository';
import { TransactionsService } from './transactions.service';

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

const RECORD: TransactionRecord = {
  id: 'transaction-1',
  amount: 1500.5,
  type: TransactionType.expense,
  description: 'Продукты',
  date: new Date('2026-08-14T00:00:00.000Z'),
  categoryId: 'category-1',
  createdAt: new Date(),
};

const EMPTY_SUMMARY: TransactionsSummary = { income: 0, expense: 0, balance: 0 };

const CREATE_DTO: CreateTransactionDto = {
  amount: 1500.5,
  type: TransactionType.expense,
  description: 'Продукты',
  date: new Date('2026-08-14T00:00:00.000Z'),
  categoryId: 'category-1',
};

describe('TransactionsService', () => {
  let service: TransactionsService;
  let repository: jest.Mocked<TransactionsRepository>;
  let queryBus: { execute: jest.Mock };

  /** QueryBus обслуживает три разных запроса — разводим их по типу. */
  const routeQueries = (overrides: { owner?: unknown; category?: unknown } = {}): void => {
    const { owner = OWNER, category = CATEGORY } = overrides;
    queryBus.execute.mockImplementation((query: unknown) => {
      if (query instanceof GetUserByIdQuery) return Promise.resolve(owner);
      if (query instanceof GetCategoryByIdQuery) return Promise.resolve(category);
      if (query instanceof GetCategoriesByUserQuery) return Promise.resolve([CATEGORY]);
      throw new Error('Неожиданный запрос');
    });
  };

  beforeEach(async () => {
    const repositoryMock: jest.Mocked<TransactionsRepository> = {
      create: jest.fn(),
      findAllByUser: jest.fn(),
      findByIdForUser: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      summarize: jest.fn(),
    } as unknown as jest.Mocked<TransactionsRepository>;

    queryBus = { execute: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: TransactionsRepository, useValue: repositoryMock },
        { provide: QueryBus, useValue: queryBus },
      ],
    }).compile();

    service = module.get(TransactionsService);
    repository = module.get(TransactionsRepository);
  });

  describe('create', () => {
    it('бросает UnauthorizedException, если владелец не найден, и не вызывает репозиторий', async () => {
      routeQueries({ owner: null });

      await expect(service.create('user-1', CREATE_DTO)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('бросает NotFoundException, если категория чужая или не существует', async () => {
      routeQueries({ category: null });

      await expect(service.create('user-1', CREATE_DTO)).rejects.toBeInstanceOf(NotFoundException);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('проверяет категорию запросом с id категории и userId', async () => {
      routeQueries();
      repository.create.mockResolvedValue(RECORD);

      await service.create('user-1', CREATE_DTO);

      const query = queryBus.execute.mock.calls
        .map(([candidate]: [unknown]) => candidate)
        .find((candidate: unknown) => candidate instanceof GetCategoryByIdQuery) as
        GetCategoryByIdQuery | undefined;
      expect(query?.id).toBe('category-1');
      expect(query?.userId).toBe('user-1');
    });

    it('передаёт в репозиторий userId и обрезанное description', async () => {
      routeQueries();
      repository.create.mockResolvedValue(RECORD);

      await service.create('user-1', { ...CREATE_DTO, description: '  Продукты  ' });

      expect(repository.create).toHaveBeenCalledWith('user-1', {
        amount: 1500.5,
        type: TransactionType.expense,
        description: 'Продукты',
        date: CREATE_DTO.date,
        categoryId: 'category-1',
      });
    });

    it('возвращает транзакцию с подставленной категорией вместо categoryId', async () => {
      routeQueries();
      repository.create.mockResolvedValue(RECORD);

      const result = await service.create('user-1', CREATE_DTO);

      expect(result.category).toEqual(CATEGORY);
      expect(result).not.toHaveProperty('categoryId');
    });

    it('превращает P2003 в NotFoundException: категорию удалили между проверкой и записью', async () => {
      routeQueries();
      repository.create.mockRejectedValue(prismaError('P2003'));

      await expect(service.create('user-1', CREATE_DTO)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('пробрасывает неизвестную ошибку как есть', async () => {
      routeQueries();
      const unknownError = new Error('boom');
      repository.create.mockRejectedValue(unknownError);

      await expect(service.create('user-1', CREATE_DTO)).rejects.toBe(unknownError);
    });
  });

  describe('findAll', () => {
    beforeEach(() => {
      routeQueries();
      repository.findAllByUser.mockResolvedValue([RECORD]);
      repository.summarize.mockResolvedValue(EMPTY_SUMMARY);
    });

    it('бросает BadRequestException, если month передан без year', async () => {
      await expect(service.findAll('user-1', { month: 8 })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(repository.findAllByUser).not.toHaveBeenCalled();
    });

    it('без year и month читает все транзакции пользователя без периода', async () => {
      await service.findAll('user-1', {});

      expect(repository.findAllByUser).toHaveBeenCalledWith('user-1', undefined);
      expect(repository.summarize).toHaveBeenCalledWith('user-1', undefined);
    });

    it('по year и month строит полуинтервал месяца в UTC', async () => {
      await service.findAll('user-1', { year: 2026, month: 8 });

      expect(repository.findAllByUser).toHaveBeenCalledWith('user-1', {
        gte: new Date('2026-08-01T00:00:00.000Z'),
        lt: new Date('2026-09-01T00:00:00.000Z'),
      });
    });

    it('для декабря переносит верхнюю границу на январь следующего года', async () => {
      await service.findAll('user-1', { year: 2026, month: 12 });

      expect(repository.findAllByUser).toHaveBeenCalledWith('user-1', {
        gte: new Date('2026-12-01T00:00:00.000Z'),
        lt: new Date('2027-01-01T00:00:00.000Z'),
      });
    });

    it('по одному year строит полуинтервал целого года', async () => {
      await service.findAll('user-1', { year: 2026 });

      expect(repository.summarize).toHaveBeenCalledWith('user-1', {
        gte: new Date('2026-01-01T00:00:00.000Z'),
        lt: new Date('2027-01-01T00:00:00.000Z'),
      });
    });

    it('возвращает items с подставленными категориями и сводку из репозитория', async () => {
      const summary: TransactionsSummary = { income: 90000, expense: 41230.5, balance: 48769.5 };
      repository.summarize.mockResolvedValue(summary);

      const result = await service.findAll('user-1', { year: 2026, month: 8 });

      expect(result.summary).toEqual(summary);
      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.category).toEqual(CATEGORY);
    });
  });

  describe('findOne', () => {
    it('бросает NotFoundException, если транзакция чужая или не существует', async () => {
      repository.findByIdForUser.mockResolvedValue(null);

      await expect(service.findOne('user-1', 'transaction-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('возвращает транзакцию с категорией', async () => {
      routeQueries();
      repository.findByIdForUser.mockResolvedValue(RECORD);

      const result = await service.findOne('user-1', 'transaction-1');

      expect(repository.findByIdForUser).toHaveBeenCalledWith('transaction-1', 'user-1');
      expect(result.category).toEqual(CATEGORY);
    });
  });

  describe('update', () => {
    it('передаёт в репозиторий только переданные поля вместе с id и userId', async () => {
      routeQueries();
      repository.update.mockResolvedValue(RECORD);

      await service.update('user-1', 'transaction-1', { amount: 99 });

      expect(repository.update).toHaveBeenCalledWith('transaction-1', 'user-1', { amount: 99 });
    });

    it('обрезает description', async () => {
      routeQueries();
      repository.update.mockResolvedValue(RECORD);

      await service.update('user-1', 'transaction-1', { description: '  Кофе  ' });

      expect(repository.update).toHaveBeenCalledWith(
        'transaction-1',
        'user-1',
        expect.objectContaining({ description: 'Кофе' }),
      );
    });

    it('проверяет новую категорию до апдейта и не трогает репозиторий, если её нет', async () => {
      routeQueries({ category: null });

      await expect(
        service.update('user-1', 'transaction-1', { categoryId: 'category-2' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('превращает P2025 в NotFoundException', async () => {
      routeQueries();
      repository.update.mockRejectedValue(prismaError('P2025'));

      await expect(
        service.update('user-1', 'transaction-1', { amount: 99 }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('remove', () => {
    it('превращает P2025 в NotFoundException', async () => {
      repository.remove.mockRejectedValue(prismaError('P2025'));

      await expect(service.remove('user-1', 'transaction-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('успешно завершается без возвращаемого значения', async () => {
      repository.remove.mockResolvedValue(undefined);

      await expect(service.remove('user-1', 'transaction-1')).resolves.toBeUndefined();
    });
  });
});
