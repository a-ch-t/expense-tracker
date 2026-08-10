/** Ошибка запроса к API. status = 0, когда сервер не ответил вовсе. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
