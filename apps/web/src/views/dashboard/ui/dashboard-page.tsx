import { redirect } from 'next/navigation';
import { getSession } from '@/entities/session';
import { LogoutButton } from '@/features/auth';
import { ROUTES } from '@/shared/config/routes';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';

export async function DashboardPage() {
  const user = await getSession();

  // Middleware пускает сюда по сроку жизни токена, но подпись проверяет только API —
  // с подделанным токеном сессии всё равно не будет.
  if (!user) {
    redirect(ROUTES.login);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center p-8">
      <Card>
        <CardHeader>
          <CardTitle>Привет, {user.name}</CardTitle>
          <CardDescription>{user.email}</CardDescription>
        </CardHeader>
        <CardContent>
          <LogoutButton />
        </CardContent>
      </Card>
    </main>
  );
}
