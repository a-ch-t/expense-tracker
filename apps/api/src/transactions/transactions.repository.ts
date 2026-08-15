import { Injectable } from '@nestjs/common';
import { TransactionType, type Prisma, type Transaction } from '@expense-tracker/db';
import { PrismaService } from '../prisma/prisma.service';
import type {
  TransactionRecord,
  TransactionsPeriod,
  TransactionsSummary,
} from './transaction.read-model';

/** Поля, которые задаёт вызывающий код: id и даты создания проставляет БД. */
type TransactionInput = Omit<TransactionRecord, 'id' | 'createdAt'>;

@Injectable()
export class TransactionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, data: TransactionInput): Promise<TransactionRecord> {
    const transaction = await this.prisma.transaction.create({ data: { ...data, userId } });
    return this.toRecord(transaction);
  }

  async findAllByUser(userId: string, period?: TransactionsPeriod): Promise<TransactionRecord[]> {
    const transactions = await this.prisma.transaction.findMany({
      where: this.buildWhere(userId, period),
      // Свежие операции сверху; createdAt разводит записи с одинаковой датой
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });
    return transactions.map((transaction) => this.toRecord(transaction));
  }

  async findByIdForUser(id: string, userId: string): Promise<TransactionRecord | null> {
    // findFirst, а не findUnique: userId — часть условия владения, а не уникальный ключ
    const transaction = await this.prisma.transaction.findFirst({ where: { id, userId } });
    return transaction ? this.toRecord(transaction) : null;
  }

  async update(
    id: string,
    userId: string,
    data: Prisma.TransactionUpdateInput,
  ): Promise<TransactionRecord> {
    // userId прямо в where: чужую транзакцию Prisma не найдёт и бросит P2025
    const transaction = await this.prisma.transaction.update({ where: { id, userId }, data });
    return this.toRecord(transaction);
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.prisma.transaction.delete({ where: { id, userId } });
  }

  /** Суммы доходов и расходов за период — считает БД, а не Node. */
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

  private buildWhere(userId: string, period?: TransactionsPeriod): Prisma.TransactionWhereInput {
    return { userId, ...(period && { date: period }) };
  }

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
