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
      <ul className="grid grid-cols-3 gap-1 md:flex md:flex-col md:gap-1.5">
        {LINKS.map(({ href, label, icon: Icon }) => {
          // Вложенные маршруты вроде /transactions/new тоже подсвечивают свой раздел
          const isActive = pathname === href || pathname.startsWith(`${href}/`);

          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex items-center justify-center gap-2 rounded-full px-2.5 py-2.5 text-xs whitespace-nowrap transition-colors md:justify-start md:gap-3 md:px-3.5 md:text-sm',
                  'focus-visible:ring-[3px] focus-visible:ring-ring/20 focus-visible:outline-none',
                  isActive
                    ? 'bg-primary font-semibold text-primary-foreground'
                    : 'font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                )}
              >
                <Icon className="size-[1.125rem] shrink-0" aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
