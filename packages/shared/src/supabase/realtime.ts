import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import type { TurnoClient } from './client';
import { queryKeys } from '../queries/keys';

export type RealtimeTable = 'shifts' | 'swap_requests' | 'swap_request_events' | 'notifications';

export interface RealtimeChange {
  table: RealtimeTable;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  /** Linha nova (INSERT/UPDATE), quando o Realtime a envia. */
  record?: Record<string, unknown>;
}

/** O mínimo de um QueryClient do TanStack Query de que precisamos. */
export interface InvalidatingQueryClient {
  invalidateQueries(filters: { queryKey: readonly unknown[] }): Promise<void>;
}

/** Que cache invalidar quando cada tabela muda. */
export const REALTIME_INVALIDATIONS: Record<RealtimeTable, readonly (readonly unknown[])[]> = {
  // Aprovar uma troca muda o dono dos turnos: os pedidos mostram turnos embebidos.
  shifts: [queryKeys.shifts.all, queryKeys.swapRequests.all],
  swap_requests: [queryKeys.swapRequests.all],
  swap_request_events: [queryKeys.swapRequests.all],
  notifications: [queryKeys.notifications.all],
};

interface Subscription {
  table: RealtimeTable;
  /** Coluna e valor para o filtro de INSERT/UPDATE. */
  filter: string;
  /** DELETE não suporta filtros no Realtime; só ouvimos onde interessa. */
  deletes: boolean;
}

/**
 * Subscreve alterações da loja (turnos, pedidos, histórico) e as notificações
 * de quem tem sessão.
 *
 * - INSERT/UPDATE são filtrados (e o Realtime aplica RLS).
 * - DELETE (só em shifts) é ouvido sem filtro; o evento só traz a chave primária.
 * - Ao voltar a ligar (ex.: telemóvel acordou), chama `onChange` para cada
 *   tabela, porque podem ter-se perdido eventos.
 *
 * Devolve uma função para cancelar a subscrição.
 */
export function subscribeToStoreChanges(
  client: TurnoClient,
  scope: { storeId: string; userId: string },
  onChange: (change: RealtimeChange) => void,
): () => void {
  const subscriptions: Subscription[] = [
    { table: 'shifts', filter: `store_id=eq.${scope.storeId}`, deletes: true },
    { table: 'swap_requests', filter: `store_id=eq.${scope.storeId}`, deletes: false },
    { table: 'swap_request_events', filter: `store_id=eq.${scope.storeId}`, deletes: false },
    { table: 'notifications', filter: `user_id=eq.${scope.userId}`, deletes: false },
  ];

  const channel = client.channel(`store:${scope.storeId}:user:${scope.userId}`);

  for (const { table, filter, deletes } of subscriptions) {
    const handler = (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) =>
      onChange({
        table,
        eventType: payload.eventType,
        ...(payload.eventType !== 'DELETE' ? { record: payload.new } : {}),
      });
    channel
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table, filter }, handler)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table, filter }, handler);
    if (deletes) {
      channel.on('postgres_changes', { event: 'DELETE', schema: 'public', table }, handler);
    }
  }

  let subscribedOnce = false;
  channel.subscribe((status) => {
    if (status !== 'SUBSCRIBED') return;
    if (subscribedOnce) {
      for (const { table } of subscriptions) onChange({ table, eventType: 'UPDATE' });
    }
    subscribedOnce = true;
  });

  return () => {
    void client.removeChannel(channel);
  };
}

/**
 * Liga o Realtime ao TanStack Query: cada alteração invalida a cache certa.
 * `onEvent` (opcional) recebe cada alteração, ex.: para mostrar um aviso.
 */
export function subscribeAndInvalidate(
  client: TurnoClient,
  scope: { storeId: string; userId: string },
  queryClient: InvalidatingQueryClient,
  onEvent?: (change: RealtimeChange) => void,
): () => void {
  return subscribeToStoreChanges(client, scope, (change) => {
    for (const queryKey of REALTIME_INVALIDATIONS[change.table]) {
      void queryClient.invalidateQueries({ queryKey });
    }
    onEvent?.(change);
  });
}
