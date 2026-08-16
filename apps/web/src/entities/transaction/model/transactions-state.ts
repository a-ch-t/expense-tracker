import type { TransactionsPage } from './transaction';

/**
 * Три исхода запроса списка — по образцу SessionState из entities/session.
 *
 * Различать `unauthenticated` и `unavailable` обязательно: proxy пускает на закрытые
 * страницы по сроку жизни токена, и если страница на любой отказ уводит на /login,
 * то при живом по exp токене proxy вернёт её обратно — цикл редиректов.
 */
export type TransactionsState =
  | { status: 'ok'; page: TransactionsPage }
  /** API ответил 401: токена нет, он протух или подделан. */
  | { status: 'unauthenticated' }
  /** Запрос не удался: API недоступен или ответил 5xx. */
  | { status: 'unavailable' };
