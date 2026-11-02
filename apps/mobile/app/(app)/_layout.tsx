import { getErrorMessage, type Session, type TurnoClient } from '@turno/shared';
import { colors, fontFamily } from '@turno/shared/tokens';
import { Redirect, Stack } from 'expo-router';
import { LoadingScreen, ScreenMessage } from '@/components/screen-message';
import { Button } from '@/components/ui';
import { unregisterCurrentPushToken } from '@/lib/push';
import { useAuth } from '@/hooks/use-auth';
import { PushProvider } from '@/hooks/push-context';
import { useNotificationNavigation, usePush } from '@/hooks/use-push';
import { SessionProvider } from '@/hooks/use-session';
import { useMyProfile, useStoreRealtime } from '@/hooks/use-turno-data';
import type { MyProfile } from '@turno/shared';

/** Tudo o que está dentro de (app) precisa de sessão e de perfil. */
export default function AppLayout() {
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
  const signOut = async () => {
    try {
      await unregisterCurrentPushToken(client);
    } catch {
      // Sem rede: o token é limpo pela Edge Function quando deixar de ser válido.
    }
    await client.auth.signOut();
  };

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
        <Button title="Sair" variant="outline" onPress={() => void signOut()} />
      </ScreenMessage>
    );
  }
  return (
    <SessionProvider value={{ client, session, profile: profile.data, signOut }}>
      <SignedIn client={client} profile={profile.data} />
    </SessionProvider>
  );
}

function SignedIn({ client, profile }: { client: TurnoClient; profile: MyProfile }) {
  useStoreRealtime(client, { storeId: profile.store_id, userId: profile.id });
  useNotificationNavigation();
  const push = usePush(client);

  return (
    <PushProvider value={push}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          headerTintColor: colors.accent,
          headerTitleStyle: { fontFamily: fontFamily.native.bold, color: colors.text },
          headerStyle: { backgroundColor: colors.background },
          headerShadowVisible: false,
          headerBackTitle: 'Voltar',
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="turno" options={{ presentation: 'modal' }} />
        <Stack.Screen name="pedir-troca" options={{ presentation: 'modal' }} />
        <Stack.Screen name="pedidos/[id]" options={{ headerShown: true, title: 'Pedido' }} />
      </Stack>
    </PushProvider>
  );
}
