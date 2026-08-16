import 'server-only';

import { cache } from 'react';
import { apiFetch } from '@/shared/api/api-client';
import { ApiError } from '@/shared/api/api-error';
import { getSessionToken } from '@/shared/api/session-auth';
import type { SessionState } from '../model/session-state';
import type { User } from '../model/user';

const UNAUTHORIZED_STATUS = 401;

/**
 * Текущее состояние сессии — единственное место, где фронт узнаёт, кто залогинен.
 * cache() нужен, чтобы несколько серверных компонентов одной страницы
 * не сходили в /auth/me по разу каждый.
 *
 * Возвращает три состояния, а не «пользователь или null»: см. SessionState —
 * от того, отличаем ли мы отказ в доступе от недоступности API, зависит,
 * не зациклятся ли редиректы между proxy и закрытой страницей.
 */
export const getSession = cache(async (): Promise<SessionState> => {
  const token = await getSessionToken();

  if (!token) {
    return { status: 'unauthenticated' };
  }

  try {
    return { status: 'authenticated', user: await apiFetch<User>('/auth/me', { token }) };
  } catch (error) {
    if (error instanceof ApiError && error.status === UNAUTHORIZED_STATUS) {
      return { status: 'unauthenticated' };
    }

    // Инфраструктурный сбой: в логи, чтобы его было видно, а пользователю — честное
    // «не смогли проверить» вместо молчаливого разлогинивания.
    console.error('[getSession] Не удалось проверить сессию:', error);

    return { status: 'unavailable' };
  }
});
