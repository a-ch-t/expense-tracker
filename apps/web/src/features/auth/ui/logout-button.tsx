'use client';

import { useTransition } from 'react';
import { Loader2, LogOut } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { logoutAction } from '../api/logout.action';

export function LogoutButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      disabled={isPending}
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
