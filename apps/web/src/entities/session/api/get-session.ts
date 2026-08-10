import { cache } from 'react';
import { cookies } from 'next/headers';
import { apiFetch } from '@/shared/api/api-client';
import { ApiError } from '@/shared/api/api-error';
import { SESSION_COOKIE_NAME } from '@/shared/config/session-cookie';
import type { User } from '../model/user';

/**
 * Текущий пользователь или null — единственное место, где фронт узнаёт, кто залогинен.
 * cache() нужен, чтобы несколько серверных компонентов одной страницы
 * не сходили в /auth/me по разу каждый.
 *
 * 401 — токен протух или подделан — ожидаемый случай, возвращаем null молча.
 * Остальные ошибки (API лежит, 500, прерывистое соединение) логируются, чтобы
 * обнаружить инфраструктурные проблемы в серверных логах.
 */
export const getSession = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  try {
    return await apiFetch<User>('/auth/me', { token });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return null;
    }
    console.error('[getSession] Unexpected error:', error);
    return null;
  }
});
