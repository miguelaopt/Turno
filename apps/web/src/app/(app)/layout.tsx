'use client';

import { getErrorMessage, type Session, type TurnoClient } from '@turno/shared';
import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { AppShell } from '@/components/app-shell';
import { FullScreenMessage, LoadingScreen } from '@/components/full-screen-message';
import { Button } from '@/components/ui/button';
import { CardContent } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { SessionProvider } from '@/hooks/use-session';
import { useMyProfile } from '@/hooks/use-turno-data';

/** Tudo o que está dentro de (app) precisa de sessão e de perfil. */
export default function AppLayout({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (auth.status === 'signed-out') router.replace('/login');
  }, [auth.status, router]);

  if (auth.status === 'config-error') {
    return <FullScreenMessage title="Configuração em falta" description={auth.message} />;
  }
  if (auth.status !== 'signed-in') return <LoadingScreen />;
  return (
    <WithProfile client={auth.client} session={auth.session}>
      {children}
    </WithProfile>
  );
}

function WithProfile({
  client,
  session,
  children,
}: {
  client: TurnoClient;
  session: Session;
  children: ReactNode;
}) {
  const profile = useMyProfile(client, session.user.id);
  const signOut = async () => {
    await client.auth.signOut();
  };

  if (profile.isPending) return <LoadingScreen />;
  if (profile.isError) {
    return (
      <FullScreenMessage
        title="Não foi possível carregar"
        description={getErrorMessage(profile.error)}
      >
        <CardContent>
          <Button className="w-full" onClick={() => void profile.refetch()}>
            Tentar outra vez
          </Button>
        </CardContent>
      </FullScreenMessage>
    );
  }
  if (!profile.data) {
    return (
      <FullScreenMessage
        title="Conta sem perfil"
        description={`A conta ${session.user.email ?? ''} ainda não está associada a nenhuma loja. Pede à gerência para te adicionar.`}
      >
        <CardContent>
          <Button variant="outline" className="w-full" onClick={() => void signOut()}>
            Sair
          </Button>
        </CardContent>
      </FullScreenMessage>
    );
  }
  return (
    <SessionProvider value={{ client, session, profile: profile.data, signOut }}>
      <AppShell>{children}</AppShell>
    </SessionProvider>
  );
}
