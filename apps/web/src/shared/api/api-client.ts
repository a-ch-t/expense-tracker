import { getApiUrl } from '../config/env';
import { ApiError } from './api-error';

export interface ApiRequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  token?: string;
}

// Формат ошибки NestJS. У ValidationPipe message — всегда массив строк.
interface ApiErrorBody {
  statusCode?: number;
  message?: string | string[];
  error?: string;
}

/** status, которым помечаем недоступность сервера: настоящего кода ответа нет. */
const NETWORK_ERROR_STATUS = 0;

const GENERIC_ERROR_MESSAGE = 'Не удалось выполнить запрос';

/**
 * Запрос к NestJS. Вызывается только из серверного кода — Server Actions и RSC:
 * токен лежит в httpOnly cookie и браузеру недоступен.
 */
export async function apiFetch<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token } = options;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Вне try: незаданный API_URL — ошибка конфигурации, а не сбой сети. Внутри её
  // не отличить от лежащего бэкенда, и настоящая причина не попала бы даже в логи.
  const apiUrl = getApiUrl();

  let response: Response;

  try {
    response = await fetch(`${apiUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
    });
  } catch {
    throw new ApiError(NETWORK_ERROR_STATUS, 'Сервис недоступен, попробуйте позже');
  }

  if (!response.ok) {
    throw new ApiError(response.status, await readErrorMessage(response));
  }

  try {
    return (await response.json()) as T;
  } catch {
    // Успешный ответ без JSON-тела (например, 204) — не даём наружу голый SyntaxError,
    // apiFetch остаётся единственной точкой, откуда вызывающий код ждёт только ApiError.
    throw new ApiError(response.status, GENERIC_ERROR_MESSAGE);
  }
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const { message } = (await response.json()) as ApiErrorBody;

    if (Array.isArray(message)) {
      return message.join('. ');
    }

    // Через ||, а не ??: тело вида { message: '' } тоже должно дать осмысленный текст.
    return message || GENERIC_ERROR_MESSAGE;
  } catch {
    // Тело неJSON — например, прокси вернул HTML-страницу ошибки.
    return GENERIC_ERROR_MESSAGE;
  }
}
