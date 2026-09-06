import { redirect } from 'next/navigation';
import { getTransactions, SummaryCards, TransactionList } from '@/entities/transaction';
import { ROUTES } from '@/shared/config/routes';
import { Alert, AlertDescription } from '@/shared/ui/alert';
import { Pagination } from '@/shared/ui/pagination';

/** Сколько операций показывает главный экран. */
const PAGE_SIZE = 10;

interface DashboardPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Главный экран: сводка за всё время и последние операции с листанием.
 * Сессию проверяет лейаут группы (app) — здесь остаются только данные страницы.
 */
export async function DashboardPage({ searchParams }: DashboardPageProps) {
  const page = parsePage((await searchParams)['page']);
  const state = await getTransactions({ page, limit: PAGE_SIZE });

  // Токен есть, но API его не принял: сбрасываем куку через /logout, иначе proxy
  // вернёт пользователя обратно по живому exp — цикл редиректов.
  if (state.status === 'unauthenticated') {
    redirect(ROUTES.logout);
  }

  if (state.status === 'unavailable') {
    return (
      <Alert variant="destructive">
        <AlertDescription>Не удалось загрузить операции, попробуйте позже</AlertDescription>
      </Alert>
    );
  }

  const { items, summary, pagination } = state.page;

  // Страница за пределом выдачи (устаревшая закладка, операции удалили) — вместо
  // честной пустоты, которая выглядит как «операций вообще нет», ведём на последнюю.
  if (pagination.totalPages > 0 && pagination.page > pagination.totalPages) {
    redirect(`${ROUTES.dashboard}?page=${pagination.totalPages}`);
  }

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">Главная</h1>
        <p className="mt-1 text-muted-foreground">Доходы и расходы за всё время</p>
      </header>

      <SummaryCards summary={summary} />

      {/* Список лежит прямо на пластине: своя рамка вокруг него добавила бы вторую
          границу внутри уже очерченного экрана. Разделяют строки, а не блоки. */}
      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-lg font-bold tracking-tight">Последние операции</h2>
          <p className="text-sm text-muted-foreground tabular-nums">
            {pagination.total > 0 && `всего ${pagination.total}`}
          </p>
        </div>

        <TransactionList transactions={items} />

        {pagination.totalPages > 1 && (
          <Pagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            basePath={ROUTES.dashboard}
            className="justify-end pt-2"
          />
        )}
      </section>
    </div>
  );
}

/**
 * Номер страницы из адресной строки. Мусор и значения меньше единицы дают первую
 * страницу: адрес правит пользователь, и падать из-за ?page=abc экран не должен.
 */
function parsePage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}
