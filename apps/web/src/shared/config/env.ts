/**
 * Адрес NestJS для серверного кода Next. Префикса NEXT_PUBLIC_ нет намеренно:
 * токен лежит в httpOnly cookie, поэтому браузер в API напрямую не ходит.
 */
export function getApiUrl(): string {
  const apiUrl = process.env['API_URL'];

  if (!apiUrl) {
    throw new Error('Не задана переменная окружения API_URL — проверьте .env в корне репозитория');
  }

  return apiUrl;
}
