// Espelho no cliente das regras da RPC transition_swap_request, só para decidir
// que botões mostrar. Quem garante as regras é sempre a base de dados.
import { toDate, type DateInput } from '../time';
import type { Enums } from '../types/database';
import type { SwapStatus } from './labels';

export interface SwapActor {
  id: string;
  role: Enums<'user_role'>;
}

export interface SwapRequestLike {
  id: string;
  requester_id: string;
  accepted_by: string | null;
  status: SwapStatus;
  type: Enums<'swap_type'>;
  mpi_updated_at: string | null;
  shift: { id: string; starts_at: string; ends_at: string; user_id: string } | null;
  offered_shift?: { id: string; starts_at: string; ends_at: string; user_id: string } | null;
  created_at: string;
}

const isFuture = (value: DateInput | undefined, now: DateInput) =>
  value !== undefined && toDate(value).getTime() > toDate(now).getTime();

export const isActiveSwapStatus = (status: SwapStatus) =>
  status === 'open' || status === 'accepted';

export function canAcceptSwap(req: SwapRequestLike, me: SwapActor, now: DateInput = new Date()) {
  return (
    me.role === 'worker' &&
    req.status === 'open' &&
    req.requester_id !== me.id &&
    isFuture(req.shift?.starts_at, now)
  );
}

export function canCancelSwap(req: SwapRequestLike, me: SwapActor) {
  return req.requester_id === me.id && isActiveSwapStatus(req.status);
}

export function canApproveSwap(req: SwapRequestLike, me: SwapActor) {
  return me.role === 'manager' && req.status === 'accepted' && req.requester_id !== me.id;
}

export function canRejectSwap(req: SwapRequestLike, me: SwapActor) {
  return me.role === 'manager' && isActiveSwapStatus(req.status) && req.requester_id !== me.id;
}

export function canMarkMpiUpdated(req: SwapRequestLike, me: SwapActor) {
  return me.role === 'manager' && req.status === 'approved' && !req.mpi_updated_at;
}

/**
 * Pode pedir troca deste turno? Tem de ser seu, ainda não ter começado e não
 * ter outro pedido em curso (nem estar oferecido numa troca aceite).
 */
export function canRequestSwap(
  shift: { id: string; user_id: string; starts_at: string },
  me: SwapActor,
  requests: readonly SwapRequestLike[],
  now: DateInput = new Date(),
) {
  if (shift.user_id !== me.id || !isFuture(shift.starts_at, now)) return false;
  return !requests.some(
    (r) =>
      (r.shift?.id === shift.id && isActiveSwapStatus(r.status)) ||
      (r.offered_shift?.id === shift.id && r.status === 'accepted'),
  );
}

/** Pedido em curso associado a um turno (como pedido ou como turno oferecido). */
export function activeRequestForShift<R extends SwapRequestLike>(
  shiftId: string,
  requests: readonly R[],
): R | undefined {
  return requests.find(
    (r) =>
      (r.shift?.id === shiftId && isActiveSwapStatus(r.status)) ||
      (r.offered_shift?.id === shiftId && r.status === 'accepted'),
  );
}

export interface SwapSection<R> {
  key: 'to_accept' | 'to_decide' | 'mpi_pending' | 'mine' | 'accepted_by_me' | 'open' | 'history';
  title: string;
  empty: string;
  requests: R[];
}

/**
 * Organiza os pedidos da loja em secções, conforme quem está a ver.
 * Ordem: o que precisa de ação primeiro; histórico no fim (mais recente primeiro).
 */
export function groupSwapRequests<R extends SwapRequestLike>(
  requests: readonly R[],
  me: SwapActor,
  now: DateInput = new Date(),
): SwapSection<R>[] {
  const byShiftStart = (a: R, b: R) =>
    toDate(a.shift?.starts_at ?? a.created_at).getTime() -
    toDate(b.shift?.starts_at ?? b.created_at).getTime();
  const byNewest = (a: R, b: R) => toDate(b.created_at).getTime() - toDate(a.created_at).getTime();
  const history = requests.filter((r) => !isActiveSwapStatus(r.status)).sort(byNewest);

  if (me.role === 'manager') {
    return [
      {
        key: 'to_decide',
        title: 'Para aprovar',
        empty: 'Não há pedidos à espera da tua decisão.',
        requests: requests.filter((r) => r.status === 'accepted').sort(byShiftStart),
      },
      {
        key: 'mpi_pending',
        title: 'Passar para o MPI',
        empty: 'Todos os pedidos aprovados já estão no MPI.',
        requests: requests
          .filter((r) => r.status === 'approved' && !r.mpi_updated_at)
          .sort(byShiftStart),
      },
      {
        key: 'open',
        title: 'Abertos (à espera de colega)',
        empty: 'Não há pedidos abertos.',
        requests: requests.filter((r) => r.status === 'open').sort(byShiftStart),
      },
      { key: 'history', title: 'Histórico', empty: 'Ainda não há histórico.', requests: history },
    ];
  }

  return [
    {
      key: 'to_accept',
      title: 'Podes aceitar',
      empty: 'Não há pedidos de colegas neste momento.',
      requests: requests.filter((r) => canAcceptSwap(r, me, now)).sort(byShiftStart),
    },
    {
      key: 'mine',
      title: 'Os meus pedidos',
      empty: 'Não tens pedidos em curso.',
      requests: requests
        .filter((r) => r.requester_id === me.id && isActiveSwapStatus(r.status))
        .sort(byShiftStart),
    },
    {
      key: 'accepted_by_me',
      title: 'Aceitei',
      empty: 'Não aceitaste pedidos em curso.',
      requests: requests
        .filter((r) => r.accepted_by === me.id && r.status === 'accepted')
        .sort(byShiftStart),
    },
    { key: 'history', title: 'Histórico', empty: 'Ainda não há histórico.', requests: history },
  ];
}

/** Número para o badge do separador "Pedidos": o que precisa de ação desta pessoa. */
export function actionableSwapCount(
  requests: readonly SwapRequestLike[],
  me: SwapActor,
  now: DateInput = new Date(),
): number {
  if (me.role === 'manager') {
    return requests.filter(
      (r) => r.status === 'accepted' || (r.status === 'approved' && !r.mpi_updated_at),
    ).length;
  }
  return requests.filter((r) => canAcceptSwap(r, me, now)).length;
}
