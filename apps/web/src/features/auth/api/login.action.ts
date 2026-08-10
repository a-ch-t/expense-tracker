'use server';

import { redirect } from 'next/navigation';
import { ROUTES } from '@/shared/config/routes';
import type { AuthActionError } from '../model/action-result';
import { authenticate } from '../model/authenticate';
import { loginSchema, type LoginValues } from '../model/login.schema';

export async function loginAction(values: LoginValues): Promise<AuthActionError | undefined> {
  // Браузер уже проверил эту же схему, но экшен доступен и в обход формы.
  const parsed = loginSchema.safeParse(values);

  if (!parsed.success) {
    return { error: 'Проверьте правильность заполнения полей' };
  }

  const failure = await authenticate('/auth/login', parsed.data);

  if (failure) {
    return failure;
  }

  // redirect работает через исключение — только вне try/catch, иначе catch его проглотит.
  redirect(ROUTES.dashboard);
}
