import 'server-only';

import { apiFetch } from '@/shared/api/api-client';
import { ApiError } from '@/shared/api/api-error';
import { getSessionToken } from '@/shared/api/session-auth';
import type { TransactionsPage } from '../model/transaction';
import type { TransactionsState } from '../model/transactions-state';

const UNAUTHORIZED_STATUS = 401;

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

  const query = new URLSearchParams({ page: String(page), limit: String(limit) });

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
