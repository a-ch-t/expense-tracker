import 'server-only';

import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME } from '../config/session-cookie';

/**
 * Токен сессии из httpOnly cookie — им подписываются все запросы к API.
 *
 * Живёт в shared, а не в entities/session: токен нужен каждому слайсу, который ходит
 * в API, а соседние слайсы одного слоя друг друга импортировать не могут.
 */
export async function getSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE_NAME)?.value;
}
