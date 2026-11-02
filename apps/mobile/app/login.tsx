import { getErrorMessage, sendMagicLink } from '@turno/shared';
import { colors, spacing } from '@turno/shared/tokens';
import * as Linking from 'expo-linking';
import { Redirect } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LoadingScreen, ScreenMessage } from '@/components/screen-message';
import { Button, Card, Text, TextField } from '@/components/ui';
import { useAuth } from '@/hooks/use-auth';

export default function LoginScreen() {
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | undefined>();

  if (auth.status === 'loading') return <LoadingScreen />;
  if (auth.status === 'config-error') {
    return <ScreenMessage title="Configuração em falta" description={auth.message} />;
  }
  if (auth.status === 'signed-in') return <Redirect href="/" />;
  const { client } = auth;

  async function submit() {
    setSending(true);
    setError(undefined);
    try {
      // Expo Go: exp://<ip>:8081/--/auth/callback · build própria: turno://auth/callback
      await sendMagicLink(client, email, Linking.createURL('auth/callback'));
      setSentTo(email.trim().toLowerCase());
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: 'center', padding: spacing.lg }}
      >
        <Card>
          <View style={{ gap: spacing.xs }}>
            <Text weight="bold" size="sm" style={{ color: colors.accent, letterSpacing: 1 }}>
              TURNO
            </Text>
            <Text weight="bold" size="xxl" accessibilityRole="header">
              Entrar
            </Text>
            <Text muted>
              Enviamos-te um link de acesso por email. Não precisas de palavra-passe.
            </Text>
          </View>

          {sentTo ? (
            <View style={{ gap: spacing.md }}>
              <Text accessibilityLiveRegion="polite">
                Enviámos um link para <Text weight="bold">{sentTo}</Text>. Abre-o neste telemóvel
                para entrares.
              </Text>
              <Button title="Usar outro email" variant="outline" onPress={() => setSentTo(null)} />
            </View>
          ) : (
            <View style={{ gap: spacing.md }}>
              <TextField
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="nome@exemplo.pt"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                returnKeyType="send"
                onSubmitEditing={() => void submit()}
                error={error}
              />
              <Button
                title={sending ? 'A enviar…' : 'Enviar link de acesso'}
                loading={sending}
                disabled={!email.trim()}
                onPress={() => void submit()}
              />
            </View>
          )}
        </Card>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
