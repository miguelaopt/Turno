'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { FullScreenMessage, LoadingScreen } from '@/components/full-screen-message';
import { ShiftsScreen } from '@/components/turnos/shifts-screen';
import { Button } from '@/components/ui/button';
import { CardContent } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { useMyProfile } from '@/hooks/use-turno-data';
import type { Session, TurnoClient } from '@turno/shared';
import { getErrorMessage } from '@turno/shared';

export default function TurnosPage() {
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (auth.status === 'signed-out') router.replace('/login');
  }, [auth.status, router]);

  if (auth.status === 'config-error') {
    return <FullScreenMessage title="Configuração em falta" description={auth.message} />;
  }
  if (auth.status !== 'signed-in') return <LoadingScreen />;
  return <WithProfile client={auth.client} session={auth.session} />;
}

function WithProfile({ client, session }: { client: TurnoClient; session: Session }) {
  const profile = useMyProfile(client, session.user.id);
  const signOut = () => void client.auth.signOut();

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
          <Button variant="outline" className="w-full" onClick={signOut}>
            Sair
          </Button>
        </CardContent>
      </FullScreenMessage>
    );
  }
  return <ShiftsScreen client={client} profile={profile.data} onSignOut={signOut} />;
}
