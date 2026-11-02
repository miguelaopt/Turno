'use client';

import { getErrorMessage, sendMagicLink } from '@turno/shared';
import { MailCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { FullScreenMessage, LoadingScreen } from '@/components/full-screen-message';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/use-auth';

export default function LoginPage() {
  const auth = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (auth.status === 'signed-in') router.replace('/turnos');
  }, [auth.status, router]);

  if (auth.status === 'config-error') {
    return <FullScreenMessage title="Configuração em falta" description={auth.message} />;
  }
  if (auth.status !== 'signed-out') return <LoadingScreen />;
  const { client } = auth;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSending(true);
    setError(null);
    try {
      await sendMagicLink(client, email, `${window.location.origin}/auth/callback`);
      setSentTo(email.trim().toLowerCase());
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <p className="text-primary text-sm font-bold tracking-wide uppercase">Turno</p>
          <CardTitle className="text-2xl">Entrar</CardTitle>
          <CardDescription>
            Enviamos-te um link de acesso por email. Não precisas de palavra-passe.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sentTo ? (
            <Alert>
              <MailCheck aria-hidden />
              <AlertDescription>
                <p>
                  Enviámos um link para <strong>{sentTo}</strong>. Abre-o neste navegador para
                  entrares.
                </p>
                <Button variant="link" className="px-0" onClick={() => setSentTo(null)}>
                  Usar outro email
                </Button>
              </AlertDescription>
            </Alert>
          ) : (
            <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="nome@exemplo.pt"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? 'email-error' : undefined}
                />
              </div>
              {error ? (
                <p id="email-error" className="text-urgent text-sm" role="alert">
                  {error}
                </p>
              ) : null}
              <Button type="submit" size="lg" disabled={sending || !email.trim()}>
                {sending ? 'A enviar…' : 'Enviar link de acesso'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
