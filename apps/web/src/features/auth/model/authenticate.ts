import { cookies } from 'next/headers';
import { apiFetch } from '@/shared/api/api-client';
import { SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS } from '@/shared/config/session-cookie';
import type { AuthActionError } from './action-result';
import type { AuthResponse } from './auth-response';
import { toActionError } from './to-action-error';

/**
 * Запрос к API и установка куки — то, что у входа и регистрации совпадает дословно.
 * При успехе возвращает undefined: редирект делает вызывающий экшен, потому что
 * redirect() обязан быть вне try/catch.
 */
export async function authenticate(
  path: '/auth/login' | '/auth/register',
  body: unknown,
): Promise<AuthActionError | undefined> {
  try {
    const { accessToken } = await apiFetch<AuthResponse>(path, { method: 'POST', body });

    (await cookies()).set(SESSION_COOKIE_NAME, accessToken, SESSION_COOKIE_OPTIONS);
  } catch (error) {
    return toActionError(error);
  }

  return undefined;
}
