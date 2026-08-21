import 'server-only';

import { apiFetch } from '@/shared/api/api-client';
import { ApiError } from '@/shared/api/api-error';
import { getSessionToken } from '@/shared/api/session-auth';
import type { TransactionsPage } from '../model/transaction';
import type { TransactionsState } from '../model/transactions-state';

const UNAUTHORIZED_STATUS = 401;

/**
 * Верхние границы page и limit из QueryTransactionsDto: за ними API отвечает 400.
 * Продублированы, потому что apps/web не может импортировать код из apps/api — при
 * правке границ на бэкенде поправить нужно и здесь.
 */
const MAX_PAGE = 1_000_000;
const MAX_LIMIT = 100;

interface GetTransactionsParams {
  page: number;
  limit: number;
}

/** Страница операций текущего пользователя вместе со сводкой за весь период. */
export async function getTransactions({
  page,
  limit,
}: GetTransactionsParams): Promise<TransactionsState> {
  const token = await getSessionToken();

  if (!token) {
    return { status: 'unauthenticated' };
  }

  // Номер страницы приходит из адресной строки, а её правит пользователь. Без зажима
  // ?page=2000000 давал бы 400, который здесь не отличить от лежащего бэкенда: экран
  // показывал бы «сервис недоступен» и писал в error-лог из-за опечатки в URL.
  // Страница за пределом выдачи — не ошибка: вызывающий код уводит на последнюю.
  const query = new URLSearchParams({
    page: String(Math.min(page, MAX_PAGE)),
    limit: String(Math.min(limit, MAX_LIMIT)),
  });

  try {
    return {
      status: 'ok',
      page: await apiFetch<TransactionsPage>(`/transactions?${query}`, { token }),
    };
  } catch (error) {
    if (error instanceof ApiError && error.status === UNAUTHORIZED_STATUS) {
      return { status: 'unauthenticated' };
    }

    // Инфраструктурный сбой: в логи, чтобы его было видно, а пользователю — честное
    // «не смогли загрузить» вместо пустого списка, неотличимого от отсутствия операций.
    console.error('[getTransactions] Не удалось загрузить операции:', error);

    return { status: 'unavailable' };
  }
}
