import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { buttonVariants } from '@/shared/ui/button';

interface PaginationProps {
  page: number;
  totalPages: number;
  /** Путь страницы: номер уезжает в ?page=, других параметров компонент не хранит. */
  basePath: string;
  className?: string;
}

/**
 * Постраничная навигация ссылками, а не кнопками: страница остаётся серверной,
 * состояние живёт в URL, и переход работает без JavaScript.
 */
export function Pagination({ page, totalPages, basePath, className }: PaginationProps) {
  const isFirst = page <= 1;
  const isLast = page >= totalPages;

  return (
    <nav aria-label="Навигация по страницам" className={cn('flex items-center gap-2', className)}>
      <PaginationLink href={`${basePath}?page=${page - 1}`} disabled={isFirst} label="Назад">
        <ChevronLeft aria-hidden />
        Назад
      </PaginationLink>

      <span className="min-w-24 text-center text-sm text-muted-foreground tabular-nums">
        {page} из {totalPages}
      </span>

      <PaginationLink href={`${basePath}?page=${page + 1}`} disabled={isLast} label="Вперёд">
        Вперёд
        <ChevronRight aria-hidden />
      </PaginationLink>
    </nav>
  );
}

interface PaginationLinkProps {
  href: string;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}

/**
 * На краях списка ссылка становится span: неактивную ссылку нельзя «выключить»
 * атрибутом, а вести на несуществующую страницу она не должна.
 */
function PaginationLink({ href, disabled, label, children }: PaginationLinkProps) {
  const className = cn(buttonVariants({ variant: 'outline', size: 'sm' }));

  if (disabled) {
    return (
      <span aria-disabled className={cn(className, 'pointer-events-none opacity-50')}>
        {children}
      </span>
    );
  }

  return (
    <Link href={href} aria-label={label} className={className}>
      {children}
    </Link>
  );
}
