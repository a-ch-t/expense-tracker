import { ArrowDownLeft, ArrowUpRight, Wallet, type LucideIcon } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { formatMoney } from '@/shared/lib/format';
import type { TransactionsSummary } from '../model/transaction';

interface SummaryCardsProps {
  summary: TransactionsSummary;
}

/** Доход, расход и баланс за весь период выборки — не за текущую страницу списка. */
export function SummaryCards({ summary }: SummaryCardsProps) {
  // Оборот — сумма движений в обе стороны. Он даёт долю, по которой доход и расход
  // сравниваются друг с другом; при пустой выборке доли нет, и полоски тоже.
  const turnover = summary.income + summary.expense;
  const incomeShare = turnover > 0 ? summary.income / turnover : null;
  const expenseShare = incomeShare === null ? null : 1 - incomeShare;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <SummaryCard
        label="Доход"
        value={summary.income}
        icon={ArrowDownLeft}
        share={incomeShare}
        className="bg-mint text-foreground"
        iconClassName="bg-mint-foreground text-mint"
        captionClassName="text-mint-foreground"
        meterClassName="bg-mint-foreground/20 text-mint-foreground"
      />

      <SummaryCard
        label="Расход"
        value={summary.expense}
        icon={ArrowUpRight}
        share={expenseShare}
        className="bg-peach text-foreground"
        iconClassName="bg-peach-foreground text-peach"
        captionClassName="text-peach-foreground"
        meterClassName="bg-peach-foreground/20 text-peach-foreground"
      />

      {/* Баланс — итог, а не поток: он подводит черту под двумя предыдущими карточками
          и потому единственный тёмный. Доли у него нет, это разность. */}
      <SummaryCard
        label="Баланс"
        value={summary.balance}
        icon={Wallet}
        caption="Доход минус расход"
        className="bg-primary text-primary-foreground sm:col-span-2 lg:col-span-1"
        iconClassName="bg-primary-foreground/15 text-primary-foreground"
        captionClassName="text-primary-foreground/60"
      />
    </div>
  );
}

interface SummaryCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  /** Доля в обороте от 0 до 1; `null` — выборка пуста и сравнивать не с чем. */
  share?: number | null;
  /** Подпись под суммой, когда доли нет. */
  caption?: string;
  className: string;
  iconClassName: string;
  captionClassName: string;
  /** Дорожка полоски: цвет заливки берётся из `text-*` этого же класса. */
  meterClassName?: string;
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  share,
  caption,
  className,
  iconClassName,
  captionClassName,
  meterClassName,
}: SummaryCardProps) {
  const percent = share == null ? null : Math.round(share * 100);

  return (
    <article className={cn('flex flex-col gap-8 rounded-2xl p-5', className)}>
      <span
        aria-hidden
        className={cn('flex size-10 items-center justify-center rounded-md', iconClassName)}
      >
        <Icon className="size-5" />
      </span>

      <div className="flex flex-col gap-3">
        <div>
          <p className={cn('text-sm font-medium', captionClassName)}>{label}</p>
          <p className="text-2xl font-extrabold tracking-tight tabular-nums sm:text-3xl">
            {formatMoney(value)}
          </p>
        </div>

        {percent !== null ? (
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className={cn('h-1 flex-1 overflow-hidden rounded-full', meterClassName)}
            >
              <span
                className="block h-full rounded-full bg-current"
                style={{ width: `${percent}%` }}
              />
            </span>
            <span className={cn('text-xs font-semibold tabular-nums', captionClassName)}>
              {percent}% оборота
            </span>
          </div>
        ) : (
          caption && <p className={cn('text-xs font-medium', captionClassName)}>{caption}</p>
        )}
      </div>
    </article>
  );
}
