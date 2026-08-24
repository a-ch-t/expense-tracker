import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { Prisma } from '@expense-tracker/db';
import {
  GetCategoriesByUserQuery,
  GetCategoryByIdQuery,
  type CategoryReadModel,
} from '../contracts/categories';
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

/**
 * Проверяет, что ошибка — известная ошибка Prisma с данным кодом.
 * @param error - перехваченное значение.
 * @param code - код ошибки Prisma (например, `P2025`).
 * @returns `true`, если `error` — `PrismaClientKnownRequestError` с этим кодом.
 */
function isPrismaError(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

/** Бизнес-логика транзакций: CRUD с проверкой владения и подстановкой категории. */
@Injectable()
export class TransactionsService {
  constructor(
    private readonly transactionsRepository: TransactionsRepository,
    private readonly queryBus: QueryBus,
  ) {}

  /**
   * Создаёт транзакцию пользователя.
   * @param userId - id владельца транзакции.
   * @param dto - данные новой транзакции.
   * @returns созданная транзакция с подставленной категорией.
   * @throws {NotFoundException} если категория не найдена, принадлежит другому пользователю
   * или была удалена между проверкой и вставкой (гонка отражается как та же ошибка).
   */
  async create(userId: string, dto: CreateTransactionDto): Promise<TransactionReadModel> {
    // Существование владельца проверил JwtAuthGuard — повторять запрос здесь незачем.
    // Если пользователя удалят между гардом и вставкой, FK отдаст P2003, и mapPrismaError
    // назовёт его «категория не найдена»: у Transaction два внешних ключа, и по коду
    // ошибки они неразличимы. Обе гонки требуют удаления аккаунта ровно в это окно.
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

  /**
   * Возвращает страницу транзакций пользователя вместе с агрегатами за весь запрошенный период.
   * @param userId - id владельца транзакций.
   * @param query - фильтр периода (`year`/`month`) и параметры пагинации.
   * @returns элементы текущей страницы, сводку `{ income, expense, balance }` за весь период
   * (не за страницу) и данные пагинации.
   * @throws {BadRequestException} если указан `month` без `year`.
   * @throws {NotFoundException} если у транзакции нет соответствующей категории — на практике
   * невозможно из-за `onDelete: Restrict` на `Transaction.categoryId`.
   */
  async findAll(userId: string, query: QueryTransactionsDto): Promise<TransactionsPage> {
    const period = this.buildPeriod(query);
    const { page, limit } = query;

    const [records, total, summary, categories] = await Promise.all([
      this.transactionsRepository.findAllByUser(userId, period, {
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.transactionsRepository.countByUser(userId, period),
      // Без skip/take: сводка описывает весь период, а не текущую страницу
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

    return {
      items,
      summary,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Возвращает одну транзакцию пользователя по идентификатору.
   * @param userId - id владельца транзакции.
   * @param id - идентификатор транзакции.
   * @returns транзакция с подставленной категорией.
   * @throws {NotFoundException} если транзакция не найдена или принадлежит другому пользователю.
   */
  async findOne(userId: string, id: string): Promise<TransactionReadModel> {
    const record = await this.transactionsRepository.findByIdForUser(id, userId);

    if (!record) {
      // Чужая транзакция неотличима от несуществующей: 404, а не 403,
      // чтобы не подтверждать существование чужих ресурсов.
      throw new NotFoundException('Транзакция не найдена');
    }

    return this.toReadModel(record, await this.requireCategory(record.categoryId, userId));
  }

  /**
   * Частично обновляет транзакцию пользователя.
   * @param userId - id владельца транзакции.
   * @param id - идентификатор транзакции.
   * @param dto - поля для обновления; отсутствующие поля не изменяются.
   * @returns обновлённая транзакция с подставленной категорией.
   * @throws {NotFoundException} если транзакция не найдена (в том числе принадлежит другому
   * пользователю), либо если `dto.categoryId` указывает на несуществующую или чужую категорию —
   * как при явной проверке до записи, так и если категорию удалили в промежутке (P2003).
   */
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

  /**
   * Удаляет транзакцию пользователя.
   * @param userId - id владельца транзакции.
   * @param id - идентификатор транзакции.
   * @returns ничего.
   * @throws {NotFoundException} если транзакция не найдена или принадлежит другому пользователю.
   */
  async remove(userId: string, id: string): Promise<void> {
    try {
      await this.transactionsRepository.remove(id, userId);
    } catch (error) {
      throw this.mapPrismaError(error);
    }
  }

  /**
   * Категория пользователя или 404: чужая неотличима от несуществующей.
   * @param id - идентификатор категории.
   * @param userId - id пользователя, которому категория должна принадлежать.
   * @returns найденная категория.
   * @throws {NotFoundException} если категория не найдена или принадлежит другому пользователю.
   */
  private async requireCategory(id: string, userId: string): Promise<CategoryReadModel> {
    const category = await this.queryBus.execute<GetCategoryByIdQuery, CategoryReadModel | null>(
      new GetCategoryByIdQuery(id, userId),
    );

    if (!category) {
      throw new NotFoundException('Категория не найдена');
    }

    return category;
  }

  /**
   * Строит полуинтервал [начало, следующее начало) в UTC — либо месяц, либо целый год.
   * @param query - объект запроса с необязательными `year` и `month`.
   * @returns границы периода, либо `undefined`, если период не задан (ни `year`, ни `month`).
   * @throws {BadRequestException} если указан `month` без `year`.
   */
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

  /**
   * Собирает публичное представление транзакции, заменяя `categoryId` на саму категорию.
   * @param record - строка транзакции из репозитория.
   * @param category - уже загруженная категория этой транзакции.
   * @returns транзакция с подставленной категорией.
   */
  private toReadModel(
    record: TransactionRecord,
    category: CategoryReadModel,
  ): TransactionReadModel {
    const { categoryId: _categoryId, ...rest } = record;
    return { ...rest, category };
  }

  /**
   * Превращает известные коды ошибок Prisma в HTTP-исключения Nest.
   * @param error - перехваченная ошибка вызова репозитория.
   * @returns {NotFoundException}, если код ошибки Prisma распознан (P2025 или P2003);
   * исходную ошибку без изменений в остальных случаях.
   */
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
