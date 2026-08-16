import type { TransactionType } from '@expense-tracker/db';
import type { CategoryReadModel } from '../contracts/categories';

/**
 * Строка из БД: категория ещё не подставлена. Наружу не отдаётся —
 * репозиторий возвращает её, сервис обогащает категорией.
 */
export interface TransactionRecord {
  id: string;
  /** Всегда положительное число; знак операции определяется полем type */
  amount: number;
  type: TransactionType;
  description: string;
  date: Date;
  categoryId: string;
  createdAt: Date;
}

/** Публичное представление транзакции: categoryId заменён на саму категорию. */
export interface TransactionReadModel extends Omit<TransactionRecord, 'categoryId'> {
  category: CategoryReadModel;
}

/** Итоги за выбранный период. */
export interface TransactionsSummary {
  income: number;
  expense: number;
  /** income − expense: может быть отрицательным */
  balance: number;
}

/** Положение страницы в выдаче: по этим числам фронт рисует навигацию. */
export interface TransactionsPagination {
  page: number;
  limit: number;
  /** Всего записей за период, а не на странице */
  total: number;
  /** 0, когда записей нет вовсе */
  totalPages: number;
}

/**
 * Ответ GET /transactions: страница списка плюс агрегаты.
 * summary считается по всему периоду, а не по странице: иначе итоги менялись бы
 * при листании, хотя описывают они одну и ту же выборку.
 */
export interface TransactionsPage {
  items: TransactionReadModel[];
  summary: TransactionsSummary;
  pagination: TransactionsPagination;
}

/** Смещение и размер страницы для репозитория. */
export interface TransactionsPageRequest {
  skip: number;
  take: number;
}

/** Полуинтервал [gte, lt) — границы месяца или года в UTC. */
export interface TransactionsPeriod {
  gte: Date;
  lt: Date;
}
