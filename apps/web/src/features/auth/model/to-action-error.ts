import { ApiError } from '@/shared/api/api-error';
import type { AuthActionError } from './action-result';

const SERVICE_UNAVAILABLE = 'Сервис недоступен, попробуйте позже';

const CONFLICT_STATUS = 409;
const NETWORK_ERROR_STATUS = 0;
const SERVER_ERROR_FLOOR = 500;

/** Превращает ошибку запроса в то, что не стыдно показать пользователю. */
export function toActionError(error: unknown): AuthActionError {
  if (!(error instanceof ApiError)) {
    return { error: SERVICE_UNAVAILABLE };
  }

  // 409 — занятый email: виновато конкретное поле, а не запрос целиком.
  if (error.status === CONFLICT_STATUS) {
    return { error: error.message, field: 'email' };
  }

  // Внутренности 5xx и сетевых сбоев наружу не отдаём.
  if (error.status === NETWORK_ERROR_STATUS || error.status >= SERVER_ERROR_FLOOR) {
    return { error: SERVICE_UNAVAILABLE };
  }

  return { error: error.message };
}
