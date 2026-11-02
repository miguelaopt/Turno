import type { TurnoClient } from '../supabase/client';
import { queryKeys } from './keys';

export async function fetchMyProfile(client: TurnoClient, userId: string) {
  const { data, error } = await client
    .from('profiles')
    .select('id, name, role, weekly_hours, store_id, store:stores(id, name)')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export type MyProfile = NonNullable<Awaited<ReturnType<typeof fetchMyProfile>>>;

/** Opções para useQuery: o perfil (com a loja) de quem tem sessão. */
export function myProfileQuery(client: TurnoClient, userId: string) {
  return {
    queryKey: queryKeys.profile(userId),
    queryFn: () => fetchMyProfile(client, userId),
    staleTime: 5 * 60_000,
  };
}
