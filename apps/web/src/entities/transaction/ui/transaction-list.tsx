import type { Transaction } from '../model/transaction';
import { TransactionItem } from './transaction-item';

interface TransactionListProps {
  transactions: Transaction[];
}

/** Список операций одной страницы. Пустой список — не ошибка, а обычное состояние. */
export function TransactionList({ transactions }: TransactionListProps) {
  if (transactions.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Здесь появятся доходы и расходы, как только вы их добавите.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {transactions.map((transaction) => (
        <TransactionItem key={transaction.id} transaction={transaction} />
      ))}
    </ul>
  );
}
