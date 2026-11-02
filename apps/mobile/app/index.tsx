import { getErrorMessage, type Session, type TurnoClient } from '@turno/shared';
import { Redirect } from 'expo-router';
import { LoadingScreen, ScreenMessage } from '@/components/screen-message';
import { ShiftsScreen } from '@/components/shifts-screen';
import { Button } from '@/components/ui';
import { useAuth } from '@/hooks/use-auth';
import { useMyProfile } from '@/hooks/use-turno-data';

export default function Index() {
  const auth = useAuth();
  if (auth.status === 'loading') return <LoadingScreen />;
  if (auth.status === 'config-error') {
    return <ScreenMessage title="Configuração em falta" description={auth.message} />;
  }
  if (auth.status === 'signed-out') return <Redirect href="/login" />;
  return <WithProfile client={auth.client} session={auth.session} />;
}

function WithProfile({ client, session }: { client: TurnoClient; session: Session }) {
  const profile = useMyProfile(client, session.user.id);
  const signOut = () => void client.auth.signOut();

  if (profile.isPending) return <LoadingScreen />;
  if (profile.isError) {
    return (
      <ScreenMessage title="Não foi possível carregar" description={getErrorMessage(profile.error)}>
        <Button title="Tentar outra vez" onPress={() => void profile.refetch()} />
      </ScreenMessage>
    );
  }
  if (!profile.data) {
    return (
      <ScreenMessage
        title="Conta sem perfil"
        description={`A conta ${session.user.email ?? ''} ainda não está associada a nenhuma loja. Pede à gerência para te adicionar.`}
      >
        <Button title="Sair" variant="outline" onPress={signOut} />
      </ScreenMessage>
    );
  }
  return <ShiftsScreen client={client} profile={profile.data} onSignOut={signOut} />;
}
