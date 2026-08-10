import { cache } from 'react';
import { cookies } from 'next/headers';
import { apiFetch } from '@/shared/api/api-client';
import { SESSION_COOKIE_NAME } from '@/shared/config/session-cookie';
import type { User } from '../model/user';

/**
 * Текущий пользователь или null — единственное место, где фронт узнаёт, кто залогинен.
 * cache() нужен, чтобы несколько серверных компонентов одной страницы
 * не сходили в /auth/me по разу каждый.
 */
export const getSession = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  try {
    return await apiFetch<User>('/auth/me', { token });
  } catch {
    // Протухший, подделанный токен или лежащий API — для интерфейса это одно и то же:
    // пользователь не залогинен.
    return null;
  }
});
