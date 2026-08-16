/**
 * Зеркало read-моделей API из apps/api/src/transactions/transaction.read-model.ts.
 * Даты здесь строки, а не Date: после JSON.parse дата приезжает строкой ISO.
 */

export type TransactionType = 'income' | 'expense';

/** Категория в том виде, в каком её отдаёт API вместе с транзакцией. */
export interface TransactionCategory {
  id: string;
  name: string;
  /** HEX-цвет вида #rrggbb */
  color: string;
  /** Имя иконки lucide в kebab-case */
  icon: string;
  createdAt: string;
}

export interface Transaction {
  id: string;
  /** Всегда положительная сумма; знак операции определяется полем type */
  amount: number;
  type: TransactionType;
  description: string;
  date: string;
  category: TransactionCategory;
  createdAt: string;
}

/** Итоги за период выборки, а не за страницу. */
export interface TransactionsSummary {
  income: number;
  expense: number;
  /** income − expense: может быть отрицательным */
  balance: number;
}

export interface TransactionsPagination {
  page: number;
  limit: number;
  /** Всего записей за период, а не на странице */
  total: number;
  /** 0, когда записей нет вовсе */
  totalPages: number;
}

/** Ответ GET /transactions. */
export interface TransactionsPage {
  items: Transaction[];
  summary: TransactionsSummary;
  pagination: TransactionsPagination;
}
