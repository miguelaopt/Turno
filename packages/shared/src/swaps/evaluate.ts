import type { TimeRange } from '../rules/types';
import { evaluateShiftAssignment, type ShiftWarning } from '../rules/warnings';
import type { SwapType } from './labels';

export interface SwapEvaluation {
  /** Avisos para quem fica com o turno do pedido. */
  acceptor: ShiftWarning[];
  /** Avisos para quem pediu (só em trocas: fica com o turno oferecido). */
  requester: ShiftWarning[];
}

/**
 * Avisos (não bloqueios) se a troca for aprovada:
 *  - quem aceita fica com `shift` e, numa troca, deixa de ter `offeredShift`;
 *  - numa troca, quem pediu fica com `offeredShift` e deixa de ter `shift`.
 */
export function evaluateSwapRequest(params: {
  type: SwapType;
  shift: TimeRange & { id: string };
  offeredShift?: (TimeRange & { id: string }) | null;
  acceptorShifts: readonly TimeRange[];
  acceptorWeeklyHours: number;
  requesterShifts: readonly TimeRange[];
  requesterWeeklyHours: number;
}): SwapEvaluation {
  const offered = params.type === 'swap' ? (params.offeredShift ?? null) : null;

  const acceptor = evaluateShiftAssignment({
    shifts: params.acceptorShifts.filter((s) => !offered || s.id !== offered.id),
    candidate: params.shift,
    weeklyHours: params.acceptorWeeklyHours,
  });

  const requester = offered
    ? evaluateShiftAssignment({
        shifts: params.requesterShifts.filter((s) => s.id !== params.shift.id),
        candidate: offered,
        weeklyHours: params.requesterWeeklyHours,
      })
    : [];

  return { acceptor, requester };
}
