import { z } from 'zod';

/** Повторяет RegisterDto из API один в один. */
export const registerSchema = z.object({
  name: z.string().min(2, 'Имя должно быть не короче 2 символов'),
  email: z.email('Введите корректный email'),
  password: z.string().min(8, 'Пароль должен быть не короче 8 символов'),
});

/**
 * Схема формы регистрации: к полям API добавлено согласие с документами. Отдельной схемой,
 * потому что на бэкенд это поле не уходит — ValidationPipe с forbidNonWhitelisted вернёт 400.
 * Тип поля именно boolean, а не литерал true: с литералом форма не смогла бы стартовать
 * со снятой галочкой.
 */
export const registerFormSchema = registerSchema.extend({
  acceptedTerms: z
    .boolean()
    .refine((accepted) => accepted, 'Примите соглашение и политику, чтобы продолжить'),
});

export type RegisterValues = z.infer<typeof registerSchema>;

export type RegisterFormValues = z.infer<typeof registerFormSchema>;
