'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ROUTES } from '@/shared/config/routes';
import { SESSION_COOKIE_NAME } from '@/shared/config/session-cookie';

/**
 * Удаляет куку. Токен на стороне API не отзывается: списка отозванных токенов
 * в NestJS нет, и заводить его эта задача не должна.
 */
export async function logoutAction(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE_NAME);

  redirect(ROUTES.login);
}
