import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/entities/session';
import { ROUTES } from '@/shared/config/routes';
import { Alert, AlertDescription } from '@/shared/ui/alert';
import { AppSidebar } from '@/widgets/app-sidebar';

/**
 * Оболочка закрытых разделов: сайдбар и проверка сессии в одном месте — страницам
 * внутри группы остаётся только их собственное содержимое. Группа (app) на URL не влияет.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
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
      <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center p-4">
        <Alert variant="destructive">
          <AlertDescription>Сервис недоступен, попробуйте позже</AlertDescription>
        </Alert>
      </main>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <AppSidebar user={session.user} />

      <main className="flex-1 p-4 md:p-8">
        <div className="mx-auto w-full max-w-3xl">{children}</div>
      </main>
    </div>
  );
}
