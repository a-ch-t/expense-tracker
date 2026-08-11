import { NextResponse, type NextRequest } from 'next/server';
import { clearSession } from '@/features/auth';
import { ROUTES } from '@/shared/config/routes';

/**
 * Сбрасывает куку сессии и уводит на /login.
 *
 * Нужен именно роут, а не редирект прямо со страницы: серверный компонент куки менять
 * не может, а без сброса куки proxy (он смотрит только на exp) вернул бы пользователя
 * обратно на закрытую страницу — и редиректы зациклились бы.
 */
export async function GET(request: NextRequest) {
  await clearSession();

  return NextResponse.redirect(new URL(ROUTES.login, request.url));
}
