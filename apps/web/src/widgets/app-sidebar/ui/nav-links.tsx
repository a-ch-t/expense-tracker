'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeftRight, LayoutDashboard, Tags, type LucideIcon } from 'lucide-react';
import { ROUTES } from '@/shared/config/routes';
import { cn } from '@/shared/lib/utils';

interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
}

const LINKS: readonly NavLink[] = [
  { href: ROUTES.dashboard, label: 'Главная', icon: LayoutDashboard },
  { href: ROUTES.transactions, label: 'Транзакции', icon: ArrowLeftRight },
  { href: ROUTES.categories, label: 'Категории', icon: Tags },
];

/**
 * Единственная клиентская часть сайдбара: подсветка текущего раздела требует
 * usePathname. Сами ссылки остаются обычными — навигация работает и без JS.
 */
export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav aria-label="Разделы приложения">
      <ul className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
        {LINKS.map(({ href, label, icon: Icon }) => {
          // Вложенные маршруты вроде /transactions/new тоже подсвечивают свой раздел
          const isActive = pathname === href || pathname.startsWith(`${href}/`);

          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm whitespace-nowrap transition-colors',
                  'focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
                  isActive
                    ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
                    : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
