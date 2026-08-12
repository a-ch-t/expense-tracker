'use server';

import { redirect } from 'next/navigation';
import { ROUTES } from '@/shared/config/routes';
import { INVALID_INPUT_MESSAGE, type AuthActionError } from '../model/action-result';
import { authenticate } from '../model/authenticate';
import { registerFormSchema, type RegisterFormValues } from '../model/register.schema';

export async function registerAction(
  values: RegisterFormValues,
): Promise<AuthActionError | undefined> {
  const parsed = registerFormSchema.safeParse(values);

  if (!parsed.success) {
    return { error: INVALID_INPUT_MESSAGE };
  }

  // Согласие остаётся на фронте: API его не принимает и на лишнее поле ответит 400.
  const { acceptedTerms: _acceptedTerms, ...credentials } = parsed.data;

  const failure = await authenticate('/auth/register', credentials);

  if (failure) {
    return failure;
  }

  // redirect работает через исключение — только вне try/catch, иначе catch его проглотит.
  redirect(ROUTES.dashboard);
}
