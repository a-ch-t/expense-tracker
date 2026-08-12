/** Пути приложения. Собраны в одном месте, чтобы редиректы не разъезжались. */
export const ROUTES = {
  login: '/login',
  register: '/register',
  dashboard: '/dashboard',
  terms: '/terms',
  privacy: '/privacy',
  /** Сбрасывает куку и уводит на /login. Роут, а не страница: RSC куки менять не может. */
  logout: '/logout',
} as const;
