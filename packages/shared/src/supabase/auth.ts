import type { TurnoClient } from './client';
import { emailSchema } from '../schemas';

/**
 * Envia um magic link. `shouldCreateUser: false`: só entra quem a gerência
 * já registou (não há registo aberto).
 */
export async function sendMagicLink(
  client: TurnoClient,
  rawEmail: string,
  redirectTo: string,
): Promise<void> {
  const email = emailSchema.parse(rawEmail);
  const { error } = await client.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo, shouldCreateUser: false },
  });
  if (error) throw error;
}

/** Lê `code` ou o erro devolvido pelo Supabase num URL de callback. */
export function parseAuthCallbackUrl(url: string): { code?: string; error?: string } {
  const parsed = new URL(url);
  // O Supabase pode pôr parâmetros na query (PKCE) ou no fragmento (#).
  const params = new URLSearchParams(parsed.search);
  const hash = new URLSearchParams(parsed.hash.replace(/^#/, ''));
  const get = (key: string) => params.get(key) ?? hash.get(key) ?? undefined;
  const error = get('error_description') ?? get('error');
  const code = get('code');
  return {
    ...(code ? { code } : {}),
    ...(error ? { error: error.replace(/\+/g, ' ') } : {}),
  };
}
