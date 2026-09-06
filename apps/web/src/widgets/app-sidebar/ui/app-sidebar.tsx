import Link from 'next/link';
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
    <aside className="flex flex-col gap-6 bg-sidebar p-5 md:w-64 md:shrink-0 md:gap-10 md:rounded-l-3xl md:p-6">
      {/* Название в две строки: так «Expense Tracker» читается вордмарком, а не
          строкой подписи, и занимает ширину колонки целиком. */}
      <Link
        href={ROUTES.dashboard}
        className="rounded-lg text-xl leading-[1.1] font-extrabold tracking-tight text-sidebar-foreground focus-visible:ring-[3px] focus-visible:ring-ring/20 focus-visible:outline-none md:text-2xl"
      >
        Expense
        <br className="hidden md:inline" /> Tracker
      </Link>

      <NavLinks />

      {/* Профиль — единственный тёмный блок в светлой колонке: он закрывает её снизу
          и отделяет «кто вошёл» от навигации без разделительной линии. */}
      <div className="flex items-center gap-3 rounded-2xl bg-primary p-3 text-primary-foreground md:mt-auto md:flex-col md:items-stretch md:gap-4 md:p-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-foreground/15 text-sm font-bold"
          >
            {user.name.slice(0, 1).toUpperCase()}
          </span>

          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="truncate text-xs text-primary-foreground/60">{user.email}</p>
          </div>
        </div>

        <LogoutButton className="bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20 hover:text-primary-foreground" />
      </div>
    </aside>
  );
}
