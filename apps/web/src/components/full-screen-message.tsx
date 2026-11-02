import type { ReactNode } from 'react';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function FullScreenMessage({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </CardHeader>
        {children}
      </Card>
    </main>
  );
}

export function LoadingScreen() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-4" aria-busy="true">
      <p className="text-muted-foreground text-sm">A carregar…</p>
    </main>
  );
}
