import { cn } from '@/shared/lib/utils';
import { formatDate, formatMoney } from '@/shared/lib/format';
import type { Transaction } from '../model/transaction';

interface TransactionItemProps {
  transaction: Transaction;
}

/** Строка выписки: маркер категории, описание, сумма со знаком и дата. */
export function TransactionItem({ transaction }: TransactionItemProps) {
  const { amount, type, description, date, category } = transaction;
  const isIncome = type === 'income';

  return (
    <li className="flex items-center gap-4 py-4">
      <CategoryMark category={category} />

      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{description}</p>
        <p className="truncate text-sm text-muted-foreground">{category.name}</p>
      </div>

      <div className="text-right">
        <p className={cn('font-semibold tabular-nums', isIncome && 'text-income')}>
          {isIncome ? '+' : '−'}
          {formatMoney(amount)}
        </p>
        <p className="text-sm text-muted-foreground tabular-nums">{formatDate(date)}</p>
      </div>
    </li>
  );
}

/**
 * Кружок цвета категории с первой буквой названия. Иконку из category.icon пока не
 * рисуем: реестр lucide резолвится только динамически и утянул бы в бандл весь набор.
 */
function CategoryMark({ category }: Pick<Transaction, 'category'>) {
  return (
    <span
      aria-hidden
      className="flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-bold"
      // Цвет приходит из данных пользователя, поэтому только инлайн-стилем:
      // класса Tailwind под произвольный HEX не существует.
      style={{ backgroundColor: `${category.color}1f`, color: category.color }}
    >
      {category.name.slice(0, 1).toUpperCase()}
    </span>
  );
}
