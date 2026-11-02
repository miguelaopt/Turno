import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import type { TurnoClient } from './client';
import { queryKeys } from '../queries/keys';

export type RealtimeTable = 'shifts' | 'swap_requests';

export interface RealtimeChange {
  table: RealtimeTable;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
}

/** O mínimo de um QueryClient do TanStack Query de que precisamos. */
export interface InvalidatingQueryClient {
  invalidateQueries(filters: { queryKey: readonly unknown[] }): Promise<void>;
}

const TABLES: RealtimeTable[] = ['shifts', 'swap_requests'];

const KEYS_BY_TABLE: Record<RealtimeTable, readonly unknown[]> = {
  shifts: queryKeys.shifts.all,
  swap_requests: queryKeys.swapRequests.all,
};

/**
 * Subscreve alterações em shifts e swap_requests da loja.
 *
 * - INSERT/UPDATE são filtrados por store_id (e o Realtime aplica RLS).
 * - DELETE não suporta filtros no Realtime, por isso ouvimos sem filtro; o
 *   evento só traz a chave primária, sem dados.
 * - Ao voltar a ligar (ex.: telemóvel acordou), chama `onChange` para cada
 *   tabela, porque podem ter-se perdido eventos.
 *
 * Devolve uma função para cancelar a subscrição.
 */
export function subscribeToStoreChanges(
  client: TurnoClient,
  storeId: string,
  onChange: (change: RealtimeChange) => void,
): () => void {
  const channel = client.channel(`store:${storeId}`);

  for (const table of TABLES) {
    const handler = (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) =>
      onChange({ table, eventType: payload.eventType });
    channel
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table, filter: `store_id=eq.${storeId}` },
        handler,
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table, filter: `store_id=eq.${storeId}` },
        handler,
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table }, handler);
  }

  let subscribedOnce = false;
  channel.subscribe((status) => {
    if (status !== 'SUBSCRIBED') return;
    if (subscribedOnce) {
      for (const table of TABLES) onChange({ table, eventType: 'UPDATE' });
    }
    subscribedOnce = true;
  });

  return () => {
    void client.removeChannel(channel);
  };
}

/** Liga o Realtime ao TanStack Query: cada alteração invalida a cache da tabela. */
export function subscribeAndInvalidate(
  client: TurnoClient,
  storeId: string,
  queryClient: InvalidatingQueryClient,
): () => void {
  return subscribeToStoreChanges(client, storeId, ({ table }) => {
    void queryClient.invalidateQueries({ queryKey: KEYS_BY_TABLE[table] });
  });
}
