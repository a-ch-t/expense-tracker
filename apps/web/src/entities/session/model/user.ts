/**
 * Зеркало UserReadModel из API. createdAt здесь строка, а не Date:
 * после JSON.parse дата приезжает строкой ISO.
 */
export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}
