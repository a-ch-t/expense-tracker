import type { User } from '@/entities/session';

/** Ответ /auth/login и /auth/register. */
export interface AuthResponse {
  accessToken: string;
  user: User;
}
