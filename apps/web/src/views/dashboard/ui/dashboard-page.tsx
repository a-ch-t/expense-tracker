import { redirect } from 'next/navigation';
import { getTransactions, SummaryCards, TransactionList } from '@/entities/transaction';
import { ROUTES } from '@/shared/config/routes';
import { Alert, AlertDescription } from '@/shared/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Главная</h1>
        <p className="text-sm text-muted-foreground">Доходы и расходы за всё время</p>
      </div>

      <SummaryCards summary={summary} />

      <Card>
        <CardHeader>
          <CardTitle>Последние операции</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <TransactionList transactions={items} />

          {pagination.totalPages > 1 && (
            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              basePath={ROUTES.dashboard}
              className="justify-end"
            />
          )}
        </CardContent>
      </Card>
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
