import { createClient, type SupabaseClient, type SupportedStorage } from '@supabase/supabase-js';
import type { Database } from '../types/database';

export type { Session, User } from '@supabase/supabase-js';
import { parseSupabaseEnv } from '../schemas';

export type TurnoClient = SupabaseClient<Database>;

export interface TurnoClientOptions {
  url: string | undefined;
  anonKey: string | undefined;
  /**
   * 'web': sessão em localStorage e troca automática do código PKCE quando o
   *        browser abre /auth/callback.
   * 'native': sessão no `storage` indicado (AsyncStorage) e troca do código
   *        feita manualmente quando chega o deep link.
   */
  platform: 'web' | 'native';
  storage?: SupportedStorage;
}

/**
 * Cria o cliente Supabase do Turno. Cada app cria UM cliente (singleton).
 * Só usa a anon key: as permissões são garantidas pelas políticas RLS.
 */
export function createTurnoClient(options: TurnoClientOptions): TurnoClient {
  const env = parseSupabaseEnv({ url: options.url, anonKey: options.anonKey });
  return createClient<Database>(env.url, env.anonKey, {
    auth: {
      flowType: 'pkce',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: options.platform === 'web',
      ...(options.storage ? { storage: options.storage } : {}),
    },
  });
}
