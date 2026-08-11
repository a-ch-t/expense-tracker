import type { ReactNode } from 'react';

/** Общая рамка страниц входа и регистрации: карточка по центру экрана. */
export default function AuthLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <main className="flex min-h-screen items-center justify-center p-4">{children}</main>;
}
