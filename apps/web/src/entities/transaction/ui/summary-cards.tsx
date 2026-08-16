import { cn } from '@/shared/lib/utils';
import { formatMoney } from '@/shared/lib/format';
import { Card } from '@/shared/ui/card';
import type { TransactionsSummary } from '../model/transaction';

interface SummaryCardsProps {
  summary: TransactionsSummary;
}

/** Доход, расход и баланс за весь период выборки — не за текущую страницу списка. */
export function SummaryCards({ summary }: SummaryCardsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <SummaryCard label="Доход" value={summary.income} valueClassName="text-income" />
      <SummaryCard label="Расход" value={summary.expense} valueClassName="text-expense" />
      <SummaryCard
        label="Баланс"
        value={summary.balance}
        // Отрицательный баланс — единственное место, где цвет означает «посмотрите сюда»
        valueClassName={cn(summary.balance < 0 && 'text-expense')}
      />
    </div>
  );
}

interface SummaryCardProps {
  label: string;
  value: number;
  valueClassName?: string;
}

function SummaryCard({ label, value, valueClassName }: SummaryCardProps) {
  return (
    <Card className="gap-1 px-5 py-4">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className={cn('text-2xl font-semibold tabular-nums', valueClassName)}>
        {formatMoney(value)}
      </p>
    </Card>
  );
}
