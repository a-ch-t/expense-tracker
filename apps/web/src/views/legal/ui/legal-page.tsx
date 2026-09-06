import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ROUTES } from '@/shared/config/routes';

interface LegalPageProps {
  title: string;
  children: ReactNode;
}

/** Общая рамка правовых документов: пластина с текстом и возвратом к регистрации. */
export function LegalPage({ title, children }: LegalPageProps) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center p-4 md:p-8">
      <article className="plate flex flex-col gap-6 rounded-3xl bg-background p-6 md:p-10">
        <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">{title}</h1>

        {/* Строки документа читаются глазами, а не сканируются: узкая колонка важнее
            ширины пластины. */}
        <div className="flex max-w-prose flex-col gap-4 text-sm leading-relaxed">{children}</div>

        <Link
          href={ROUTES.register}
          className="inline-flex items-center gap-2 self-start rounded-full text-sm font-semibold underline underline-offset-4 focus-visible:ring-[3px] focus-visible:ring-ring/20 focus-visible:outline-none"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Вернуться к регистрации
        </Link>
      </article>
    </main>
  );
}
