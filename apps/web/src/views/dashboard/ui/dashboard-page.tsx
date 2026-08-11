import { redirect } from 'next/navigation';
import { getSession } from '@/entities/session';
import { LogoutButton } from '@/features/auth';
import { ROUTES } from '@/shared/config/routes';
import { Alert, AlertDescription } from '@/shared/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';

export async function DashboardPage() {
  const session = await getSession();

  // Уводим через /logout, а не сразу на /login: proxy пускает сюда по сроку жизни
  // токена, и без сброса куки он вернул бы пользователя обратно — цикл редиректов.
  if (session.status === 'unauthenticated') {
    redirect(ROUTES.logout);
  }

  // Сессию проверить не смогли — API лежит или ответил 5xx. Разлогинивать за это
  // нельзя: токен, возможно, в порядке, а пользователь потеряет сессию из-за сбоя.
  if (session.status === 'unavailable') {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center p-8">
        <Alert variant="destructive">
          <AlertDescription>Сервис недоступен, попробуйте позже</AlertDescription>
        </Alert>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center p-8">
      <Card>
        <CardHeader>
          <CardTitle>Привет, {session.user.name}</CardTitle>
          <CardDescription>{session.user.email}</CardDescription>
        </CardHeader>
        <CardContent>
          <LogoutButton />
        </CardContent>
      </Card>
    </main>
  );
}
