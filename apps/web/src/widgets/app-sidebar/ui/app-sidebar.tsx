import Link from 'next/link';
import { Wallet } from 'lucide-react';
import type { User } from '@/entities/session';
import { LogoutButton } from '@/features/auth';
import { ROUTES } from '@/shared/config/routes';
import { NavLinks } from './nav-links';

interface AppSidebarProps {
  user: User;
}

/**
 * Оболочка приложения: бренд, разделы и профиль. Пользователя получает пропсом —
 * что делать при отсутствии сессии, решает лейаут, а не виджет.
 *
 * На узком экране превращается в верхнюю полосу: меню из трёх пунктов не стоит
 * выдвижной панели и клиентского состояния.
 */
export function AppSidebar({ user }: AppSidebarProps) {
  return (
    <aside className="flex flex-col gap-6 border-b border-sidebar-border bg-sidebar p-4 md:sticky md:top-0 md:h-dvh md:w-64 md:shrink-0 md:border-r md:border-b-0 md:p-6">
      <Link
        href={ROUTES.dashboard}
        className="flex items-center gap-2 font-semibold text-sidebar-foreground"
      >
        <Wallet className="size-5" aria-hidden />
        Expense Tracker
      </Link>

      <NavLinks />

      {/* На полосе сверху профиль и кнопка стоят в строку, в колонке сайдбара — друг под другом */}
      <div className="flex items-center gap-3 border-t border-sidebar-border pt-4 md:mt-auto md:flex-col md:items-stretch">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-sm font-semibold text-sidebar-accent-foreground"
          >
            {user.name.slice(0, 1).toUpperCase()}
          </span>

          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>

        <LogoutButton />
      </div>
    </aside>
  );
}
