// getTransactions помечен server-only и тянет за собой cookies(): барель нельзя
// импортировать из клиентского компонента, даже если нужен только SummaryCards
// или TransactionList. Next остановит сборку понятной ошибкой на месте импорта —
// это осознанный компромисс единого index.ts слайса, а не повод его дробить.
export { getTransactions } from './api/get-transactions';
export { SummaryCards } from './ui/summary-cards';
export { TransactionList } from './ui/transaction-list';
export type {
  Transaction,
  TransactionCategory,
  TransactionType,
  TransactionsPage,
  TransactionsPagination,
  TransactionsSummary,
} from './model/transaction';
export type { TransactionsState } from './model/transactions-state';
