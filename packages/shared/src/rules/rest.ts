import { hoursBetween, toDate, toLisbonDateKey } from '../time';
import type { TimeRange } from './types';

/**
 * Descanso mínimo, em horas, entre dois períodos diários de trabalho
 * consecutivos (Código do Trabalho, art. 214.º).
 *
 * Os turnos que começam no mesmo dia (Lisboa) contam como um único período
 * diário: um turno partido (ex.: 11:00–15:00 e 19:00–23:00) não gera aviso.
 */
export const MIN_REST_HOURS = 11;

export interface RestGap {
  /** Turno que termina por último no período anterior. */
  before: TimeRange;
  /** Turno que começa primeiro no período seguinte. */
  after: TimeRange;
  /** Horas entre o fim de `before` e o início de `after` (negativo = sobreposição). */
  restHours: number;
}

/** Horas de descanso entre o fim de `before` e o início de `after`. */
export function restHoursBetween(before: TimeRange, after: TimeRange): number {
  return Math.round(hoursBetween(before.endsAt, after.startsAt) * 100) / 100;
}

const ms = (d: TimeRange['startsAt']) => toDate(d).getTime();

function sortByStart(shifts: readonly TimeRange[]): TimeRange[] {
  return [...shifts].sort((a, b) => ms(a.startsAt) - ms(b.startsAt));
}

interface DailyBlock {
  /** Turno que começa mais cedo nesse dia. */
  first: TimeRange;
  /** Turno que acaba mais tarde nesse dia. */
  last: TimeRange;
}

/** Agrupa turnos pelo dia (Lisboa) em que começam. */
function dailyBlocks(shifts: readonly TimeRange[]): DailyBlock[] {
  const byDay = new Map<string, DailyBlock>();
  for (const shift of sortByStart(shifts)) {
    const key = toLisbonDateKey(shift.startsAt);
    const block = byDay.get(key);
    if (!block) {
      byDay.set(key, { first: shift, last: shift });
    } else if (ms(shift.endsAt) > ms(block.last.endsAt)) {
      block.last = shift;
    }
  }
  return [...byDay.values()];
}

/**
 * Pares de períodos diários consecutivos com menos de `minRestHours` de
 * descanso entre si.
 */
export function findShortRests(
  shifts: readonly TimeRange[],
  minRestHours = MIN_REST_HOURS,
): RestGap[] {
  const blocks = dailyBlocks(shifts);
  const gaps: RestGap[] = [];
  for (let i = 1; i < blocks.length; i++) {
    const before = blocks[i - 1]!.last;
    const after = blocks[i]!.first;
    const restHours = restHoursBetween(before, after);
    if (restHours < minRestHours) gaps.push({ before, after, restHours });
  }
  return gaps;
}

const gapKey = (g: RestGap) => `${ms(g.before.startsAt)}|${ms(g.after.startsAt)}|${g.restHours}`;

/**
 * Problemas de descanso que passam a existir se a pessoa ficar com
 * `candidate`: sobreposições diretas (restHours negativo) e períodos diários
 * com menos de `minRestHours` de intervalo que não existiam antes.
 */
export function checkRest(params: {
  shifts: readonly TimeRange[];
  candidate: TimeRange;
  minRestHours?: number;
}): RestGap[] {
  const { candidate, minRestHours = MIN_REST_HOURS } = params;
  const others = params.shifts.filter((s) => !(candidate.id && s.id === candidate.id));
  const start = ms(candidate.startsAt);
  const end = ms(candidate.endsAt);

  const overlaps: RestGap[] = sortByStart(
    others.filter((s) => ms(s.startsAt) < end && ms(s.endsAt) > start),
  ).map((s) => {
    const [before, after] = ms(s.startsAt) <= start ? [s, candidate] : [candidate, s];
    return { before, after, restHours: restHoursBetween(before, after) };
  });

  const existing = new Set(findShortRests(others, minRestHours).map(gapKey));
  const introduced = findShortRests([...others, candidate], minRestHours).filter(
    (g) => g.restHours >= 0 && !existing.has(gapKey(g)),
  );

  return [...overlaps, ...introduced];
}
