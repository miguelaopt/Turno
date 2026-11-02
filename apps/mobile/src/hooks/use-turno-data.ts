import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createShift,
  deleteShift,
  myProfileQuery,
  myShiftsQuery,
  queryKeys,
  subscribeAndInvalidate,
  updateShift,
  type Interval,
  type ShiftTimesInput,
  type TurnoClient,
} from '@turno/shared';
import { useEffect } from 'react';

// Hooks finos sobre as queries partilhadas de @turno/shared.
// A app web tem hooks equivalentes (apps/web/src/hooks/use-turno-data.ts).

export function useMyProfile(client: TurnoClient, userId: string) {
  return useQuery(myProfileQuery(client, userId));
}

export function useMyShifts(client: TurnoClient, userId: string, range: Interval) {
  return useQuery(myShiftsQuery(client, userId, range));
}

export function useShiftMutations(client: TurnoClient, userId: string, storeId: string) {
  const queryClient = useQueryClient();
  const onSuccess = () => queryClient.invalidateQueries({ queryKey: queryKeys.shifts.all });

  return {
    create: useMutation({
      mutationFn: (input: ShiftTimesInput) => createShift(client, { ...input, userId, storeId }),
      onSuccess,
    }),
    update: useMutation({
      mutationFn: ({ id, ...input }: ShiftTimesInput & { id: string }) =>
        updateShift(client, id, input),
      onSuccess,
    }),
    remove: useMutation({
      mutationFn: (id: string) => deleteShift(client, id),
      onSuccess,
    }),
  };
}

/** Subscreve o Realtime da loja e invalida a cache quando algo muda noutro dispositivo. */
export function useStoreRealtime(client: TurnoClient, storeId: string | undefined) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!storeId) return;
    return subscribeAndInvalidate(client, storeId, queryClient);
  }, [client, storeId, queryClient]);
}
