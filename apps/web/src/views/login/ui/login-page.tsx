import Link from 'next/link';
import { LoginForm } from '@/features/auth';
import { ROUTES } from '@/shared/config/routes';

export function LoginPage() {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">Вход в аккаунт</h1>
        <p className="mt-1 text-sm text-muted-foreground">Почта и пароль, которыми вы завелись.</p>
      </header>

      <LoginForm />

      <p className="text-sm text-muted-foreground">
        Нет аккаунта?{' '}
        <Link
          href={ROUTES.register}
          className="font-semibold text-foreground underline underline-offset-4"
        >
          Зарегистрироваться
        </Link>
      </p>
    </div>
  );
}
