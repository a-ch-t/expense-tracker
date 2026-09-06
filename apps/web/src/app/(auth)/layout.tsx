import type { ReactNode } from 'react';

/**
 * Общая рамка входа и регистрации: слева бренд на тёмном, справа форма. Тёмная
 * половина повторяет карточку баланса из главного экрана, поэтому вход и приложение
 * читаются как одна вещь. На узком экране она сжимается в шапку — форма важнее.
 */
export default function AuthLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <main className="flex min-h-dvh items-center justify-center p-4 md:p-8">
      <div className="plate grid w-full max-w-4xl overflow-hidden rounded-3xl bg-background md:grid-cols-[2fr_3fr]">
        <aside className="flex flex-col justify-between gap-10 bg-primary p-6 text-primary-foreground md:p-8">
          <p className="text-lg leading-[1.1] font-extrabold tracking-tight">
            Expense
            <br className="hidden md:inline" /> Tracker
          </p>

          {/* Обещание набрано крупно — на этой половине оно и есть содержание,
              а не подпись под логотипом. */}
          <p className="hidden text-2xl leading-snug font-semibold tracking-tight md:block">
            Доходы, расходы и остаток — на одном экране.
          </p>
        </aside>

        <div className="p-6 md:p-10">{children}</div>
      </div>
    </main>
  );
}
