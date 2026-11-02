'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createShift,
  createSwapRequest,
  deleteShift,
  markNotificationsRead,
  markSwapMpiUpdated,
  myNotificationsQuery,
  myProfileQuery,
  myShiftsQuery,
  queryKeys,
  storeProfilesQuery,
  subscribeAndInvalidate,
  swapRequestEventsQuery,
  swapRequestQuery,
  swapRequestsQuery,
  transitionSwapRequest,
  updateShift,
  usersShiftsQuery,
  type Enums,
  type Interval,
  type RealtimeChange,
  type ShiftTimesInput,
  type TurnoClient,
} from '@turno/shared';
import { useEffect, useRef } from 'react';

// Hooks finos sobre as queries partilhadas de @turno/shared.
// A app mobile tem hooks equivalentes (apps/mobile/src/hooks/use-turno-data.ts).

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

/**
 * Subscreve o Realtime da loja (e as notificações da pessoa) e invalida a
 * cache quando algo muda noutro dispositivo.
 */
export function useStoreRealtime(
  client: TurnoClient,
  scope: { storeId: string; userId: string } | undefined,
  onEvent?: (change: RealtimeChange) => void,
) {
  const queryClient = useQueryClient();
  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  });
  const storeId = scope?.storeId;
  const userId = scope?.userId;
  useEffect(() => {
    if (!storeId || !userId) return;
    return subscribeAndInvalidate(client, { storeId, userId }, queryClient, (change) =>
      onEventRef.current?.(change),
    );
  }, [client, storeId, userId, queryClient]);
}

// ----------------------------------------------------------------- trocas

export function useSwapRequests(client: TurnoClient, storeId: string) {
  return useQuery(swapRequestsQuery(client, storeId));
}

export function useSwapRequest(client: TurnoClient, id: string) {
  return useQuery(swapRequestQuery(client, id));
}

export function useSwapRequestEvents(client: TurnoClient, id: string) {
  return useQuery(swapRequestEventsQuery(client, id));
}

export function useStoreProfiles(client: TurnoClient, storeId: string) {
  return useQuery(storeProfilesQuery(client, storeId));
}

export function useUsersShifts(
  client: TurnoClient,
  userIds: readonly string[],
  range: Interval | null,
) {
  const placeholder: Interval = { start: new Date(0), end: new Date(0) };
  return useQuery({
    ...usersShiftsQuery(client, userIds, range ?? placeholder),
    enabled: !!range && userIds.length > 0,
  });
}

export function useSwapMutations(client: TurnoClient, userId: string, storeId: string) {
  const queryClient = useQueryClient();
  const onSuccess = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.swapRequests.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.shifts.all });
  };

  return {
    create: useMutation({
      mutationFn: (input: { shiftId: string; type: Enums<'swap_type'>; note?: string }) =>
        createSwapRequest(client, { ...input, storeId, requesterId: userId }),
      onSuccess,
    }),
    transition: useMutation({
      mutationFn: (input: {
        requestId: string;
        status: Enums<'swap_status'>;
        offeredShiftId?: string | null;
        note?: string | null;
      }) => transitionSwapRequest(client, input),
      onSuccess,
    }),
    markMpi: useMutation({
      mutationFn: (requestId: string) => markSwapMpiUpdated(client, requestId),
      onSuccess,
    }),
  };
}

// ----------------------------------------------------------- notificações

export function useNotifications(client: TurnoClient, userId: string) {
  return useQuery(myNotificationsQuery(client, userId));
}

export function useMarkNotificationsRead(client: TurnoClient, userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids?: readonly string[]) => markNotificationsRead(client, userId, ids),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all }),
  });
}
