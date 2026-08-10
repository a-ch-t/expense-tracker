import { z } from 'zod';

/** Повторяет RegisterDto из API один в один. */
export const registerSchema = z.object({
  name: z.string().min(2, 'Имя должно быть не короче 2 символов'),
  email: z.email('Введите корректный email'),
  password: z.string().min(8, 'Пароль должен быть не короче 8 символов'),
});

export type RegisterValues = z.infer<typeof registerSchema>;
