'use server';

import { redirect } from 'next/navigation';
import { ROUTES } from '@/shared/config/routes';
import { INVALID_INPUT_MESSAGE, type AuthActionError } from '../model/action-result';
import { authenticate } from '../model/authenticate';
import { registerSchema, type RegisterValues } from '../model/register.schema';

export async function registerAction(values: RegisterValues): Promise<AuthActionError | undefined> {
  const parsed = registerSchema.safeParse(values);

  if (!parsed.success) {
    return { error: INVALID_INPUT_MESSAGE };
  }

  const failure = await authenticate('/auth/register', parsed.data);

  if (failure) {
    return failure;
  }

  // redirect работает через исключение — только вне try/catch, иначе catch его проглотит.
  redirect(ROUTES.dashboard);
}
