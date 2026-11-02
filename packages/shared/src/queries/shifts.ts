import type { TurnoClient } from '../supabase/client';
import type { Tables } from '../types/database';
import type { Interval } from '../time';
import type { TimeRange } from '../rules/types';
import { queryKeys } from './keys';

export type Shift = Tables<'shifts'>;

/** Converte uma linha da BD no formato usado pelas funções puras. */
export function shiftToRange(
  shift: Pick<Shift, 'id' | 'starts_at' | 'ends_at'>,
): TimeRange & { id: string } {
  return { id: shift.id, startsAt: shift.starts_at, endsAt: shift.ends_at };
}

/** Os meus turnos que tocam o intervalo [start, end[. */
export async function fetchMyShifts(
  client: TurnoClient,
  params: { userId: string; range: Interval },
): Promise<Shift[]> {
  const { data, error } = await client
    .from('shifts')
    .select('*')
    .eq('user_id', params.userId)
    .lt('starts_at', params.range.end.toISOString())
    .gt('ends_at', params.range.start.toISOString())
    .order('starts_at', { ascending: true });
  if (error) throw error;
  return data;
}

/** Opções para useQuery: os meus turnos num intervalo (normalmente uma semana). */
export function myShiftsQuery(client: TurnoClient, userId: string, range: Interval) {
  return {
    queryKey: queryKeys.shifts.mineInRange(
      userId,
      range.start.toISOString(),
      range.end.toISOString(),
    ),
    queryFn: () => fetchMyShifts(client, { userId, range }),
  };
}

export interface ShiftTimesInput {
  startsAt: Date;
  endsAt: Date;
}

export async function createShift(
  client: TurnoClient,
  input: ShiftTimesInput & { userId: string; storeId: string; source?: Shift['source'] },
): Promise<Shift> {
  const { data, error } = await client
    .from('shifts')
    .insert({
      user_id: input.userId,
      store_id: input.storeId,
      starts_at: input.startsAt.toISOString(),
      ends_at: input.endsAt.toISOString(),
      source: input.source ?? 'manual',
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateShift(
  client: TurnoClient,
  id: string,
  input: ShiftTimesInput,
): Promise<Shift> {
  const { data, error } = await client
    .from('shifts')
    .update({ starts_at: input.startsAt.toISOString(), ends_at: input.endsAt.toISOString() })
    .eq('id', id)
    .select()
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Turno não encontrado ou sem permissão para o editar.');
  return data;
}

export async function deleteShift(client: TurnoClient, id: string): Promise<void> {
  const { data, error } = await client.from('shifts').delete().eq('id', id).select('id');
  if (error) throw error;
  if (!data.length) throw new Error('Turno não encontrado ou sem permissão para o apagar.');
}
