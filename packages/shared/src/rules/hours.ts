import { hoursBetween, lisbonWeek, toDate, type Interval } from '../time';
import type { TimeRange } from './types';

/** Duração de um turno em horas. */
export function shiftDurationHours(shift: TimeRange): number {
  return Math.max(0, hoursBetween(shift.startsAt, shift.endsAt));
}

/** Horas de um turno que caem dentro de um intervalo (o turno é cortado nos limites). */
export function overlapHours(shift: TimeRange, interval: Interval): number {
  const start = Math.max(toDate(shift.startsAt).getTime(), interval.start.getTime());
  const end = Math.min(toDate(shift.endsAt).getTime(), interval.end.getTime());
  return end > start ? hoursBetween(start, end) : 0;
}

/** Total de horas dos turnos dentro do intervalo. */
export function totalHoursInInterval(shifts: readonly TimeRange[], interval: Interval): number {
  return shifts.reduce((sum, shift) => sum + overlapHours(shift, interval), 0);
}

export interface WeeklyHoursResult {
  week: Interval;
  totalHours: number;
  limitHours: number;
  /** Horas acima do limite (0 se não exceder). */
  excessHours: number;
  exceeds: boolean;
}

/** Horas de uma semana (Lisboa, segunda a domingo) face ao limite semanal. */
export function weeklyHoursSummary(
  shifts: readonly TimeRange[],
  weekOf: TimeRange['startsAt'],
  limitHours: number,
): WeeklyHoursResult {
  const week = lisbonWeek(weekOf);
  const totalHours = round(totalHoursInInterval(shifts, week));
  const excessHours = round(Math.max(0, totalHours - limitHours));
  return { week, totalHours, limitHours, excessHours, exceeds: excessHours > 0 };
}

/**
 * Se a pessoa ficar com `candidate`, ultrapassa as horas semanais?
 * Verifica todas as semanas que o candidato toca (um turno de domingo à noite
 * pode acabar na semana seguinte). Devolve só as semanas que excedem.
 */
export function checkWeeklyHours(params: {
  shifts: readonly TimeRange[];
  candidate: TimeRange;
  weeklyHours: number;
}): WeeklyHoursResult[] {
  const { candidate, weeklyHours } = params;
  const others = params.shifts.filter((s) => !(candidate.id && s.id === candidate.id));
  const all = [...others, candidate];

  const weeks = [lisbonWeek(candidate.startsAt)];
  const endWeek = lisbonWeek(toDate(toDate(candidate.endsAt).getTime() - 1));
  if (endWeek.start.getTime() !== weeks[0]!.start.getTime()) weeks.push(endWeek);

  return weeks
    .map((week) => weeklyHoursSummary(all, week.start, weeklyHours))
    .filter((result) => result.exceeds);
}

/** Arredonda a 2 casas para evitar 7.999999 em somas de frações. */
function round(n: number): number {
  return Math.round(n * 100) / 100;
}
