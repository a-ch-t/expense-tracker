export const SESSION_COOKIE_NAME = 'access_token';

/** Кука сессионная: maxAge не задаём, реальный срок жизни определяет сам JWT. */
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax',
  path: '/',
  secure: process.env['NODE_ENV'] === 'production',
} as const;
