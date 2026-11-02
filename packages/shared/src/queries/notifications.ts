import type { TurnoClient } from '../supabase/client';
import type { Enums, Tables } from '../types/database';
import { queryKeys } from './keys';

export type AppNotification = Tables<'notifications'>;

export async function fetchMyNotifications(
  client: TurnoClient,
  userId: string,
): Promise<AppNotification[]> {
  const { data, error } = await client
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return data;
}

export function myNotificationsQuery(client: TurnoClient, userId: string) {
  return {
    queryKey: queryKeys.notifications.mine(userId),
    queryFn: () => fetchMyNotifications(client, userId),
  };
}

/** Marca como lidas as notificações indicadas (ou todas as não lidas). */
export async function markNotificationsRead(
  client: TurnoClient,
  userId: string,
  ids?: readonly string[],
): Promise<void> {
  let query = client
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null);
  if (ids) {
    if (!ids.length) return;
    query = query.in('id', [...ids]);
  }
  const { error } = await query;
  if (error) throw error;
}

export function unreadCount(notifications: readonly AppNotification[] | undefined): number {
  return notifications?.filter((n) => !n.read_at).length ?? 0;
}

/** Caminho (igual na web e na app) para onde uma notificação leva. */
export function notificationPath(n: Pick<AppNotification, 'swap_request_id'>): string {
  return n.swap_request_id ? `/pedidos/${n.swap_request_id}` : '/notificacoes';
}

export async function registerPushToken(
  client: TurnoClient,
  token: string,
  platform: Enums<'push_platform'>,
): Promise<void> {
  const { error } = await client.rpc('register_push_token', {
    p_token: token,
    p_platform: platform,
  });
  if (error) throw error;
}

export async function unregisterPushToken(client: TurnoClient, token: string): Promise<void> {
  const { error } = await client.rpc('unregister_push_token', { p_token: token });
  if (error) throw error;
}
