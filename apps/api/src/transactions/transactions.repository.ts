import { Injectable } from '@nestjs/common';
import { TransactionType, type Prisma, type Transaction } from '@expense-tracker/db';
import { PrismaService } from '../prisma/prisma.service';
import type {
  TransactionRecord,
  TransactionsPageRequest,
  TransactionsPeriod,
  TransactionsSummary,
} from './transaction.read-model';

/** Поля, которые задаёт вызывающий код: id и даты создания проставляет БД. */
type TransactionInput = Omit<TransactionRecord, 'id' | 'createdAt'>;

/** Доступ к таблице `Transaction`: сырые CRUD-операции без бизнес-логики. */
@Injectable()
export class TransactionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Создаёт транзакцию в БД.
   * @param userId - id владельца транзакции.
   * @param data - поля новой транзакции (без `id` и `createdAt` — их проставляет БД).
   * @returns созданная запись.
   * @throws {Prisma.PrismaClientKnownRequestError} с кодом `P2003`, если `categoryId` или
   * `userId` ссылаются на несуществующую строку.
   */
  async create(userId: string, data: TransactionInput): Promise<TransactionRecord> {
    const transaction = await this.prisma.transaction.create({ data: { ...data, userId } });
    return this.toRecord(transaction);
  }

  /**
   * Возвращает страницу транзакций пользователя за период, отсортированную по дате.
   * @param userId - id владельца транзакций.
   * @param period - границы периода `[gte, lt)`, либо `undefined` для всех транзакций.
   * @param page - смещение (`skip`) и размер страницы (`take`).
   * @returns записи страницы, свежие операции сверху.
   */
  async findAllByUser(
    userId: string,
    period: TransactionsPeriod | undefined,
    page: TransactionsPageRequest,
  ): Promise<TransactionRecord[]> {
    const transactions = await this.prisma.transaction.findMany({
      where: this.buildWhere(userId, period),
      // Свежие операции сверху; createdAt разводит записи с одинаковой датой
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      skip: page.skip,
      take: page.take,
    });
    return transactions.map((transaction) => this.toRecord(transaction));
  }

  /**
   * Считает, сколько всего транзакций у пользователя за период — знаменатель для числа страниц.
   * @param userId - id владельца транзакций.
   * @param period - границы периода `[gte, lt)`, либо `undefined` для всех транзакций.
   * @returns общее количество транзакций, без учёта пагинации.
   */
  countByUser(userId: string, period?: TransactionsPeriod): Promise<number> {
    return this.prisma.transaction.count({ where: this.buildWhere(userId, period) });
  }

  /**
   * Ищет транзакцию по id в пределах транзакций конкретного пользователя.
   * @param id - идентификатор транзакции.
   * @param userId - id пользователя, которому транзакция должна принадлежать.
   * @returns найденная запись, либо `null`, если её нет или она принадлежит другому пользователю.
   */
  async findByIdForUser(id: string, userId: string): Promise<TransactionRecord | null> {
    // findFirst, а не findUnique: userId — часть условия владения, а не уникальный ключ
    const transaction = await this.prisma.transaction.findFirst({ where: { id, userId } });
    return transaction ? this.toRecord(transaction) : null;
  }

  /**
   * Обновляет транзакцию пользователя.
   * @param id - идентификатор транзакции.
   * @param userId - id пользователя, которому транзакция должна принадлежать.
   * @param data - поля для обновления в формате Prisma.
   * @returns обновлённая запись.
   * @throws {Prisma.PrismaClientKnownRequestError} с кодом `P2025`, если строка с такой
   * парой `(id, userId)` не найдена (в том числе если транзакция принадлежит другому
   * пользователю); с кодом `P2003`, если новый `categoryId` не существует.
   */
  async update(
    id: string,
    userId: string,
    data: Prisma.TransactionUpdateInput,
  ): Promise<TransactionRecord> {
    // userId прямо в where: чужую транзакцию Prisma не найдёт и бросит P2025
    const transaction = await this.prisma.transaction.update({ where: { id, userId }, data });
    return this.toRecord(transaction);
  }

  /**
   * Удаляет транзакцию пользователя.
   * @param id - идентификатор транзакции.
   * @param userId - id пользователя, которому транзакция должна принадлежать.
   * @returns ничего.
   * @throws {Prisma.PrismaClientKnownRequestError} с кодом `P2025`, если строка с такой
   * парой `(id, userId)` не найдена.
   */
  async remove(id: string, userId: string): Promise<void> {
    await this.prisma.transaction.delete({ where: { id, userId } });
  }

  /**
   * Считает суммы доходов и расходов за период на стороне БД.
   * @param userId - id владельца транзакций.
   * @param period - границы периода `[gte, lt)`, либо `undefined` для всех транзакций.
   * @returns `{ income, expense, balance }`, где `balance = income - expense`.
   */
  async summarize(userId: string, period?: TransactionsPeriod): Promise<TransactionsSummary> {
    const groups = await this.prisma.transaction.groupBy({
      by: ['type'],
      where: this.buildWhere(userId, period),
      _sum: { amount: true },
    });

    const totalOf = (type: TransactionType): number => {
      const group = groups.find((candidate) => candidate.type === type);
      // Ни одной транзакции такого типа — groupBy не вернёт строку, _sum будет null
      return group?._sum.amount?.toNumber() ?? 0;
    };

    const income = totalOf(TransactionType.income);
    const expense = totalOf(TransactionType.expense);
    return { income, expense, balance: income - expense };
  }

  /**
   * Собирает условие `where` для выборки транзакций пользователя.
   * @param userId - id владельца транзакций.
   * @param period - границы периода `[gte, lt)`; если не задан, фильтр по дате не добавляется.
   * @returns условие для Prisma-запроса.
   */
  private buildWhere(userId: string, period?: TransactionsPeriod): Prisma.TransactionWhereInput {
    return { userId, ...(period && { date: period }) };
  }

  /**
   * Приводит строку Prisma к внутреннему представлению репозитория.
   * @param transaction - строка транзакции, как её вернул Prisma Client.
   * @returns запись с числовым `amount` вместо `Decimal`.
   */
  private toRecord(transaction: Transaction): TransactionRecord {
    return {
      id: transaction.id,
      // Decimal — объект, наружу отдаём обычное число
      amount: transaction.amount.toNumber(),
      type: transaction.type,
      description: transaction.description,
      date: transaction.date,
      categoryId: transaction.categoryId,
      createdAt: transaction.createdAt,
    };
  }
}
