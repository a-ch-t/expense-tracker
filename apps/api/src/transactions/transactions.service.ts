import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { Prisma } from '@expense-tracker/db';
import {
  GetCategoriesByUserQuery,
  GetCategoryByIdQuery,
  type CategoryReadModel,
} from '../contracts/categories';
import { GetUserByIdQuery, type UserReadModel } from '../contracts/users';
import type { CreateTransactionDto } from './dto/create-transaction.dto';
import type { QueryTransactionsDto } from './dto/query-transactions.dto';
import type { UpdateTransactionDto } from './dto/update-transaction.dto';
import type {
  TransactionReadModel,
  TransactionRecord,
  TransactionsPage,
  TransactionsPeriod,
} from './transaction.read-model';
import { TransactionsRepository } from './transactions.repository';

/** Коды Prisma, которые превращаем в осмысленные HTTP-ошибки. */
const RECORD_NOT_FOUND = 'P2025';
const FOREIGN_KEY_VIOLATION = 'P2003';

function isPrismaError(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

@Injectable()
export class TransactionsService {
  constructor(
    private readonly transactionsRepository: TransactionsRepository,
    private readonly queryBus: QueryBus,
  ) {}

  async create(userId: string, dto: CreateTransactionDto): Promise<TransactionReadModel> {
    // Проверяем владельца через CQRS: users — единственный, кто читает таблицу User
    const owner = await this.queryBus.execute<GetUserByIdQuery, UserReadModel | null>(
      new GetUserByIdQuery(userId),
    );

    if (!owner) {
      // Токен ещё валиден, но пользователя удалили — как в GET /api/auth/me
      throw new UnauthorizedException('Пользователь не найден');
    }

    const category = await this.requireCategory(dto.categoryId, userId);

    try {
      const record = await this.transactionsRepository.create(userId, {
        amount: dto.amount,
        type: dto.type,
        description: dto.description.trim(),
        date: dto.date,
        categoryId: dto.categoryId,
      });
      return this.toReadModel(record, category);
    } catch (error) {
      throw this.mapPrismaError(error);
    }
  }

  async findAll(userId: string, query: QueryTransactionsDto): Promise<TransactionsPage> {
    const period = this.buildPeriod(query);

    const [records, summary, categories] = await Promise.all([
      this.transactionsRepository.findAllByUser(userId, period),
      this.transactionsRepository.summarize(userId, period),
      // Одним запросом на весь список, а не по категории на транзакцию
      this.queryBus.execute<GetCategoriesByUserQuery, CategoryReadModel[]>(
        new GetCategoriesByUserQuery(userId),
      ),
    ]);

    const byId = new Map(categories.map((category) => [category.id, category]));
    const items = records.map((record) => {
      const category = byId.get(record.categoryId);
      if (!category) {
        // Невозможно при FK Restrict: категорию нельзя удалить, пока есть транзакции
        throw new NotFoundException('Категория не найдена');
      }
      return this.toReadModel(record, category);
    });

    return { items, summary };
  }

  async findOne(userId: string, id: string): Promise<TransactionReadModel> {
    const record = await this.transactionsRepository.findByIdForUser(id, userId);

    if (!record) {
      // Чужая транзакция неотличима от несуществующей: 404, а не 403,
      // чтобы не подтверждать существование чужих ресурсов.
      throw new NotFoundException('Транзакция не найдена');
    }

    return this.toReadModel(record, await this.requireCategory(record.categoryId, userId));
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateTransactionDto,
  ): Promise<TransactionReadModel> {
    // Новую категорию проверяем до апдейта, чтобы отдать 404, а не сырой P2003
    if (dto.categoryId !== undefined) {
      await this.requireCategory(dto.categoryId, userId);
    }

    const data = {
      ...(dto.amount !== undefined && { amount: dto.amount }),
      ...(dto.type !== undefined && { type: dto.type }),
      ...(dto.description !== undefined && { description: dto.description.trim() }),
      ...(dto.date !== undefined && { date: dto.date }),
      ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
    };

    try {
      const record = await this.transactionsRepository.update(id, userId, data);
      return this.toReadModel(record, await this.requireCategory(record.categoryId, userId));
    } catch (error) {
      throw this.mapPrismaError(error);
    }
  }

  async remove(userId: string, id: string): Promise<void> {
    try {
      await this.transactionsRepository.remove(id, userId);
    } catch (error) {
      throw this.mapPrismaError(error);
    }
  }

  /** Категория пользователя или 404: чужая неотличима от несуществующей. */
  private async requireCategory(id: string, userId: string): Promise<CategoryReadModel> {
    const category = await this.queryBus.execute<GetCategoryByIdQuery, CategoryReadModel | null>(
      new GetCategoryByIdQuery(id, userId),
    );

    if (!category) {
      throw new NotFoundException('Категория не найдена');
    }

    return category;
  }

  /** Полуинтервал [начало, следующее начало) в UTC — либо месяц, либо целый год. */
  private buildPeriod(query: QueryTransactionsDto): TransactionsPeriod | undefined {
    const { year, month } = query;

    if (year === undefined) {
      if (month !== undefined) {
        throw new BadRequestException('month можно указывать только вместе с year');
      }
      return undefined;
    }

    if (month === undefined) {
      return { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) };
    }

    // Date.UTC сам переносит 13-й месяц на январь следующего года
    return { gte: new Date(Date.UTC(year, month - 1, 1)), lt: new Date(Date.UTC(year, month, 1)) };
  }

  private toReadModel(
    record: TransactionRecord,
    category: CategoryReadModel,
  ): TransactionReadModel {
    const { categoryId: _categoryId, ...rest } = record;
    return { ...rest, category };
  }

  private mapPrismaError(error: unknown): unknown {
    if (isPrismaError(error, RECORD_NOT_FOUND)) {
      // update/delete не нашли строку по паре (id, userId)
      return new NotFoundException('Транзакция не найдена');
    }
    if (isPrismaError(error, FOREIGN_KEY_VIOLATION)) {
      // Категорию удалили между проверкой и записью
      return new NotFoundException('Категория не найдена');
    }
    return error;
  }
}
