import { NextResponse, type NextRequest } from 'next/server';
import { ROUTES } from '@/shared/config/routes';
import { SESSION_COOKIE_NAME } from '@/shared/config/session-cookie';

const AUTH_ROUTES: readonly string[] = [ROUTES.login, ROUTES.register];

const MILLISECONDS_IN_SECOND = 1000;

interface TokenPayload {
  exp?: number;
}

/**
 * Читает срок жизни из payload токена, не проверяя подпись: подпись проверяет NestJS,
 * а proxy решает только навигационную задачу — иначе на фронт пришлось бы тащить
 * JWT_SECRET и Edge-совместимую криптобиблиотеку.
 *
 * Проверять именно exp, а не наличие куки, обязательно: с протухшим токеном proxy
 * пустил бы на /dashboard, страница получила бы 401 и ушла на /login, а proxy
 * увидел бы куку и вернул обратно — бесконечный цикл редиректов.
 */
function isTokenAlive(token: string | undefined): boolean {
  if (!token) {
    return false;
  }

  const payload = token.split('.')[1];

  if (!payload) {
    return false;
  }

  try {
    // JWT кодируется base64url, atob понимает только base64.
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const { exp } = JSON.parse(decoded) as TokenPayload;

    return typeof exp === 'number' && exp * MILLISECONDS_IN_SECOND > Date.now();
  } catch {
    return false;
  }
}

export function proxy(request: NextRequest) {
  const isAuthenticated = isTokenAlive(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  const { pathname } = request.nextUrl;

  if (!isAuthenticated && pathname.startsWith(ROUTES.dashboard)) {
    return NextResponse.redirect(new URL(ROUTES.login, request.url));
  }

  if (isAuthenticated && AUTH_ROUTES.includes(pathname)) {
    return NextResponse.redirect(new URL(ROUTES.dashboard, request.url));
  }

  return NextResponse.next();
}

// Корень / в matcher не входит: он и так редиректит на /dashboard, где proxy сработает.
export const config = {
  matcher: ['/login', '/register', '/dashboard/:path*'],
};
