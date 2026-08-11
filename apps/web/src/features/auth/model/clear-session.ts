import 'server-only';

import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME } from '@/shared/config/session-cookie';

/**
 * Удаляет куку сессии. Токен на стороне API не отзывается: списка отозванных
 * токенов в NestJS нет, и заводить его эта задача не должна.
 *
 * Общая часть двух сценариев выхода: кнопки «Выйти» и роута /logout, куда
 * закрытые страницы уводят пользователя с недействительной сессией.
 */
export async function clearSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE_NAME);
}
