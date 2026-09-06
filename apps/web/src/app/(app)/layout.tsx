import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/entities/session';
import { ROUTES } from '@/shared/config/routes';
import { Alert, AlertDescription } from '@/shared/ui/alert';
import { AppSidebar } from '@/widgets/app-sidebar';

/**
 * Оболочка закрытых разделов: сайдбар и проверка сессии в одном месте — страницам
 * внутри группы остаётся только их собственное содержимое. Группа (app) на URL не влияет.
 *
 * Приложение лежит белой пластиной на сером столе: у экрана появляется край, и
 * сводка перестаёт растекаться по всей ширине монитора. На узком экране полей нет —
 * там пластина занимает весь экран, отступ по краям съел бы и без того тесную сетку.
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
    <div className="min-h-dvh md:h-dvh md:p-6 lg:p-8">
      {/* На широком экране пластина занимает высоту окна, а прокручивается только
          содержимое раздела — меню и профиль остаются на месте без sticky. */}
      <div className="plate mx-auto flex min-h-dvh w-full max-w-6xl flex-col bg-background md:h-full md:min-h-0 md:flex-row md:rounded-3xl">
        <AppSidebar user={session.user} />

        <main className="flex-1 p-5 md:overflow-y-auto md:p-8 md:pb-10 lg:p-10 lg:pb-12">
          {children}
        </main>
      </div>
    </div>
  );
}
