import '@fontsource-variable/manrope';
import './globals.css';

import type { Metadata, Viewport } from 'next';
import { colors, tokensToCss } from '@turno/shared/tokens';
import { Providers } from '@/components/providers';

export const metadata: Metadata = {
  title: 'Turno',
  description: 'Trocas de turno da equipa, com registo escrito de tudo.',
};

export const viewport: Viewport = {
  themeColor: colors.background,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-PT">
      <head>
        {/* Tokens de design partilhados (packages/shared/src/tokens.ts). */}
        <style dangerouslySetInnerHTML={{ __html: tokensToCss() }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
