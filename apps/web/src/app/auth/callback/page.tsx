'use client';

import { getErrorMessage, parseAuthCallbackUrl } from '@turno/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { FullScreenMessage, LoadingScreen } from '@/components/full-screen-message';
import { Button } from '@/components/ui/button';
import { CardContent } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';

/**
 * Destino do magic link. O cliente Supabase (detectSessionInUrl + PKCE)
 * troca o `code` do URL por uma sessão quando inicializa; aqui só esperamos
 * pelo resultado e mostramos erros.
 */
export default function AuthCallbackPage() {
  const auth = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fromUrl = parseAuthCallbackUrl(window.location.href);
    if (fromUrl.error) setError(getErrorMessage({ message: fromUrl.error }));
  }, []);

  useEffect(() => {
    if (auth.status === 'signed-in') {
      router.replace('/turnos');
      return;
    }
    if (auth.status === 'signed-out') {
      void auth.client.auth.initialize().then(({ error: initError }) => {
        setError(
          (current) =>
            current ??
            (initError
              ? getErrorMessage(initError)
              : 'O link expirou ou já foi usado. Pede um novo.'),
        );
      });
    }
  }, [auth, router]);

  if (auth.status === 'config-error') {
    return <FullScreenMessage title="Configuração em falta" description={auth.message} />;
  }
  if (error) {
    return (
      <FullScreenMessage title="Não foi possível entrar" description={error}>
        <CardContent>
          <Button asChild size="lg" className="w-full">
            <Link href="/login">Pedir novo link</Link>
          </Button>
        </CardContent>
      </FullScreenMessage>
    );
  }
  return <LoadingScreen />;
}
