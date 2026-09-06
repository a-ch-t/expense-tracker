import Link from 'next/link';
import { RegisterForm } from '@/features/auth';
import { ROUTES } from '@/shared/config/routes';

export function RegisterPage() {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">Создание аккаунта</h1>
        <p className="mt-1 text-sm text-muted-foreground">Займёт минуту: имя, почта и пароль.</p>
      </header>

      <RegisterForm />

      <p className="text-sm text-muted-foreground">
        Уже есть аккаунт?{' '}
        <Link
          href={ROUTES.login}
          className="font-semibold text-foreground underline underline-offset-4"
        >
          Войти
        </Link>
      </p>
    </div>
  );
}
