import { getErrorMessage, parseAuthCallbackUrl } from '@turno/shared';
import * as Linking from 'expo-linking';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { LoadingScreen, ScreenMessage } from '@/components/screen-message';
import { Button } from '@/components/ui';
import { useAuth } from '@/hooks/use-auth';

/**
 * Destino do deep link do magic link (turno://auth/callback?code=… ou, no
 * Expo Go, exp://…/--/auth/callback?code=…). Troca o código PKCE por uma sessão.
 */
export default function AuthCallbackScreen() {
  const auth = useAuth();
  const params = useLocalSearchParams<{ code?: string; error_description?: string }>();
  const url = Linking.useLinkingURL();
  const [error, setError] = useState<string | null>(null);
  const exchanged = useRef<string | null>(null);

  useEffect(() => {
    if (auth.status !== 'signed-out') return;
    const fromUrl = url ? parseAuthCallbackUrl(url) : {};
    const code = params.code ?? fromUrl.code;
    const urlError = params.error_description ?? fromUrl.error;

    if (urlError) {
      setError(getErrorMessage({ message: urlError }));
      return;
    }
    if (!code || exchanged.current === code) return;
    exchanged.current = code;

    void auth.client.auth.exchangeCodeForSession(code).then(({ error: exchangeError }) => {
      if (exchangeError) setError(getErrorMessage(exchangeError));
      // Em caso de sucesso, onAuthStateChange muda o estado para 'signed-in'.
    });
  }, [auth, params.code, params.error_description, url]);

  if (auth.status === 'signed-in') return <Redirect href="/" />;
  if (auth.status === 'config-error') {
    return <ScreenMessage title="Configuração em falta" description={auth.message} />;
  }
  if (error) {
    return (
      <ScreenMessage title="Não foi possível entrar" description={error}>
        <Button title="Pedir novo link" onPress={() => router.replace('/login')} />
      </ScreenMessage>
    );
  }
  return <LoadingScreen />;
}
