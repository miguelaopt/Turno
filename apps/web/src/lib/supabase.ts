import { createTurnoClient, type TurnoClient } from '@turno/shared';

let client: TurnoClient | undefined;

/**
 * Cliente Supabase do browser (singleton). Só deve ser chamado no cliente:
 * a sessão vive em localStorage e o código do magic link é trocado
 * automaticamente quando o browser abre /auth/callback.
 */
export function getBrowserSupabase(): TurnoClient {
  if (typeof window === 'undefined') {
    throw new Error('getBrowserSupabase só pode ser usado no browser.');
  }
  client ??= createTurnoClient({
    // Referências literais: o Next substitui-as no build.
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    platform: 'web',
  });
  return client;
}
