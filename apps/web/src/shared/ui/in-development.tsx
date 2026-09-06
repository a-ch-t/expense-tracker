import type { ReactNode } from 'react';

interface InDevelopmentProps {
  title: string;
  description: string;
  children?: ReactNode;
}

/**
 * Раздел, которого ещё нет: заголовок страницы как у готовых разделов и честное
 * объяснение вместо пустого экрана. Заголовок — настоящий h1: у страницы должна
 * быть одна структурная вершина, где бы пользователь ни оказался.
 */
export function InDevelopment({ title, description, children }: InDevelopmentProps) {
  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">{title}</h1>
        <p className="mt-1 text-muted-foreground">{description}</p>
      </header>

      <div className="flex max-w-xl flex-col gap-2 rounded-2xl bg-lilac p-6 text-lilac-foreground">
        <p className="font-bold">Раздел ещё делается</p>
        {children && <p className="text-sm">{children}</p>}
      </div>
    </div>
  );
}
