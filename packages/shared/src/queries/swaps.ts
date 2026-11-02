import type { TurnoClient } from '../supabase/client';
import type { Enums, Tables } from '../types/database';
import type { Interval } from '../time';
import { queryKeys } from './keys';

// Os turnos vêm embebidos pelas FKs compostas (shift_id/offered_shift_id, store_id).
// (uma só string literal: o supabase-js infere os tipos a partir dela)
const SWAP_SELECT =
  '*, shift:shifts!swap_requests_shift_store_fk(id, starts_at, ends_at, user_id), offered_shift:shifts!swap_requests_offered_shift_store_fk(id, starts_at, ends_at, user_id)';

export async function fetchSwapRequests(client: TurnoClient, storeId: string) {
  const { data, error } = await client
    .from('swap_requests')
    .select(SWAP_SELECT)
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })
    .limit(300);
  if (error) throw error;
  return data;
}

export type SwapRequestWithShifts = Awaited<ReturnType<typeof fetchSwapRequests>>[number];

export function swapRequestsQuery(client: TurnoClient, storeId: string) {
  return {
    queryKey: queryKeys.swapRequests.list(storeId),
    queryFn: () => fetchSwapRequests(client, storeId),
  };
}

export async function fetchSwapRequest(client: TurnoClient, id: string) {
  const { data, error } = await client
    .from('swap_requests')
    .select(SWAP_SELECT)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export function swapRequestQuery(client: TurnoClient, id: string) {
  return {
    queryKey: queryKeys.swapRequests.detail(id),
    queryFn: () => fetchSwapRequest(client, id),
  };
}

export type SwapRequestEvent = Tables<'swap_request_events'>;

export async function fetchSwapRequestEvents(
  client: TurnoClient,
  requestId: string,
): Promise<SwapRequestEvent[]> {
  const { data, error } = await client
    .from('swap_request_events')
    .select('*')
    .eq('swap_request_id', requestId)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true });
  if (error) throw error;
  return data;
}

export function swapRequestEventsQuery(client: TurnoClient, requestId: string) {
  return {
    queryKey: queryKeys.swapRequests.events(requestId),
    queryFn: () => fetchSwapRequestEvents(client, requestId),
  };
}

export async function createSwapRequest(
  client: TurnoClient,
  input: {
    storeId: string;
    shiftId: string;
    requesterId: string;
    type: Enums<'swap_type'>;
    note?: string | null;
  },
) {
  const note = input.note?.trim() || null;
  const { data, error } = await client
    .from('swap_requests')
    .insert({
      store_id: input.storeId,
      shift_id: input.shiftId,
      requester_id: input.requesterId,
      type: input.type,
      note,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Única forma de mudar o estado de um pedido (validado na BD). */
export async function transitionSwapRequest(
  client: TurnoClient,
  input: {
    requestId: string;
    status: Enums<'swap_status'>;
    offeredShiftId?: string | null;
    note?: string | null;
  },
) {
  const note = input.note?.trim();
  const { data, error } = await client.rpc('transition_swap_request', {
    p_request_id: input.requestId,
    p_status: input.status,
    ...(input.offeredShiftId ? { p_offered_shift_id: input.offeredShiftId } : {}),
    ...(note ? { p_note: note } : {}),
  });
  if (error) throw error;
  return data;
}

export async function markSwapMpiUpdated(client: TurnoClient, requestId: string) {
  const { data, error } = await client.rpc('mark_swap_mpi_updated', { p_request_id: requestId });
  if (error) throw error;
  return data;
}

// ------------------------------------------------------- perfis e turnos da loja

export type StoreProfile = Pick<Tables<'profiles'>, 'id' | 'name' | 'role' | 'weekly_hours'>;

export async function fetchStoreProfiles(
  client: TurnoClient,
  storeId: string,
): Promise<StoreProfile[]> {
  const { data, error } = await client
    .from('profiles')
    .select('id, name, role, weekly_hours')
    .eq('store_id', storeId)
    .order('name');
  if (error) throw error;
  return data;
}

export function storeProfilesQuery(client: TurnoClient, storeId: string) {
  return {
    queryKey: queryKeys.storeProfiles(storeId),
    queryFn: () => fetchStoreProfiles(client, storeId),
    staleTime: 5 * 60_000,
  };
}

export async function fetchShiftsForUsers(
  client: TurnoClient,
  params: { userIds: readonly string[]; range: Interval },
): Promise<Tables<'shifts'>[]> {
  if (!params.userIds.length) return [];
  const { data, error } = await client
    .from('shifts')
    .select('*')
    .in('user_id', [...params.userIds])
    .lt('starts_at', params.range.end.toISOString())
    .gt('ends_at', params.range.start.toISOString())
    .order('starts_at', { ascending: true });
  if (error) throw error;
  return data;
}

/** Turnos de várias pessoas (ex.: para os avisos da gerente antes de aprovar). */
export function usersShiftsQuery(client: TurnoClient, userIds: readonly string[], range: Interval) {
  return {
    queryKey: queryKeys.shifts.usersInRange(
      userIds,
      range.start.toISOString(),
      range.end.toISOString(),
    ),
    queryFn: () => fetchShiftsForUsers(client, { userIds, range }),
  };
}

/** Nome de uma pessoa a partir da lista da loja. */
export function profileName(profiles: readonly StoreProfile[] | undefined, id: string | null) {
  if (!id) return '';
  return profiles?.find((p) => p.id === id)?.name ?? 'Colega';
}
