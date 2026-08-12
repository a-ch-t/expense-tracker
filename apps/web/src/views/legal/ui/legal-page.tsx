import type { ReactNode } from 'react';
import Link from 'next/link';
import { ROUTES } from '@/shared/config/routes';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';

interface LegalPageProps {
  title: string;
  children: ReactNode;
}

/** Общая рамка правовых документов: карточка с заголовком и возвратом к регистрации. */
export function LegalPage({ title, children }: LegalPageProps) {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center p-4">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {children}
          <p className="text-muted-foreground">
            <Link href={ROUTES.register} className="text-foreground underline underline-offset-4">
              Вернуться к регистрации
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
