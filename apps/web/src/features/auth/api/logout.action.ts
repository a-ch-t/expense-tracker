'use server';

import { redirect } from 'next/navigation';
import { ROUTES } from '@/shared/config/routes';
import { clearSession } from '../model/clear-session';

/** Выход по кнопке. */
export async function logoutAction(): Promise<void> {
  await clearSession();

  redirect(ROUTES.login);
}
