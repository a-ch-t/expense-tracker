import type { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';

interface StubPageProps {
  title: string;
  description: string;
  children?: ReactNode;
}

/** Рамка раздела, которого ещё нет: заголовок и честное объяснение вместо пустого экрана. */
export function StubPage({ title, description, children }: StubPageProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      {children && <CardContent className="text-sm">{children}</CardContent>}
    </Card>
  );
}
