import Link from 'next/link';
import { LoginForm } from '@/features/auth';
import { ROUTES } from '@/shared/config/routes';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';

export function LoginPage() {
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Expense Tracker</CardTitle>
        <CardDescription>Вход в аккаунт</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <LoginForm />
        <p className="text-muted-foreground text-center text-sm">
          Нет аккаунта?{' '}
          <Link href={ROUTES.register} className="text-foreground underline underline-offset-4">
            Зарегистрироваться
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
