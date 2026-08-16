import type { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader } from '@/shared/ui/card';

interface InDevelopmentProps {
  title: string;
  description: string;
  children?: ReactNode;
}

/**
 * Рамка раздела, которого ещё нет: заголовок и честное объяснение вместо пустого экрана.
 * Заголовок — настоящий h1, а не CardTitle (тот рендерит div): страница раздела
 * должна иметь одну структурную вершину, как у главного экрана.
 */
export function InDevelopment({ title, description, children }: InDevelopmentProps) {
  return (
    <Card>
      <CardHeader>
        <h1 className="leading-none font-semibold">{title}</h1>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      {children && <CardContent className="text-sm">{children}</CardContent>}
    </Card>
  );
}
