import { z } from 'zod';

/** Повторяет LoginDto из API один в один. */
export const loginSchema = z.object({
  email: z.email('Введите корректный email'),
  password: z.string().min(8, 'Пароль должен быть не короче 8 символов'),
});

export type LoginValues = z.infer<typeof loginSchema>;
