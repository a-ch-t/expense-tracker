'use client';

import { useTransition } from 'react';
import { Loader2, LogOut } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { logoutAction } from '../api/logout.action';

interface LogoutButtonProps {
  /** Кнопка стоит на тёмной карточке профиля, поэтому вид задаёт место, а не сама фича. */
  className?: string;
}

export function LogoutButton({ className }: LogoutButtonProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={isPending}
      className={cn('shrink-0', className)}
      onClick={() => {
        startTransition(async () => {
          await logoutAction();
        });
      }}
    >
      {isPending ? <Loader2 className="animate-spin" /> : <LogOut />}
      Выйти
    </Button>
  );
}
