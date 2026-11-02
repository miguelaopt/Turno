import {
  lisbonWeek,
  lisbonWeekDays,
  toDate,
  toLisbonDateKey,
  type DateInput,
  type Interval,
} from '../time';
import { findShortRests, type RestGap } from '../rules/rest';
import { shiftDurationHours, weeklyHoursSummary } from '../rules/hours';

export interface WeekViewShift {
  id: string;
  starts_at: string;
  ends_at: string;
}

export interface WeekViewDay<S extends WeekViewShift> {
  /** Meia-noite (Lisboa) do dia. */
  date: Date;
  dateKey: string;
  isToday: boolean;
  /** Turnos que começam neste dia, por ordem. */
  shifts: (S & { durationHours: number })[];
}

export interface WeekView<S extends WeekViewShift> {
  week: Interval;
  days: WeekViewDay<S>[];
  totalHours: number;
  weeklyHours: number;
  exceedsWeeklyHours: boolean;
  excessHours: number;
  /** Pares com menos de 11h de descanso que envolvem esta semana. */
  shortRests: RestGap[];
}

/**
 * Prepara a semana para mostrar: 7 dias com os turnos de cada um, total de
 * horas e avisos. `shifts` pode incluir turnos dos dias vizinhos (para detetar
 * pouco descanso na fronteira da semana); só os que começam na semana aparecem
 * nos dias.
 */
export function buildWeekView<S extends WeekViewShift>(params: {
  shifts: readonly S[];
  weekOf: DateInput;
  weeklyHours: number;
  now?: DateInput;
}): WeekView<S> {
  const week = lisbonWeek(params.weekOf);
  const todayKey = toLisbonDateKey(params.now ?? new Date());
  const ranges = params.shifts.map((s) => ({ id: s.id, startsAt: s.starts_at, endsAt: s.ends_at }));

  const byDay = new Map<string, (S & { durationHours: number })[]>();
  const sorted = [...params.shifts].sort(
    (a, b) => toDate(a.starts_at).getTime() - toDate(b.starts_at).getTime(),
  );
  for (const shift of sorted) {
    const key = toLisbonDateKey(shift.starts_at);
    const list = byDay.get(key) ?? [];
    list.push({
      ...shift,
      durationHours: shiftDurationHours({ startsAt: shift.starts_at, endsAt: shift.ends_at }),
    });
    byDay.set(key, list);
  }

  const days = lisbonWeekDays(week.start).map((date) => {
    const dateKey = toLisbonDateKey(date);
    return { date, dateKey, isToday: dateKey === todayKey, shifts: byDay.get(dateKey) ?? [] };
  });

  const summary = weeklyHoursSummary(ranges, week.start, params.weeklyHours);
  const weekStart = week.start.getTime();
  const weekEnd = week.end.getTime();
  const shortRests = findShortRests(ranges).filter((gap) => {
    // Mostra o aviso se algum dos dois turnos tocar esta semana.
    const touches = (r: { startsAt: DateInput; endsAt: DateInput }) =>
      toDate(r.startsAt).getTime() < weekEnd && toDate(r.endsAt).getTime() > weekStart;
    return touches(gap.before) || touches(gap.after);
  });

  return {
    week,
    days,
    totalHours: summary.totalHours,
    weeklyHours: params.weeklyHours,
    exceedsWeeklyHours: summary.exceeds,
    excessHours: summary.excessHours,
    shortRests,
  };
}

/** Intervalo a pedir à BD para uma semana: inclui um dia de margem de cada lado. */
export function weekQueryRange(weekOf: DateInput): Interval {
  const week = lisbonWeek(weekOf);
  const day = 24 * 3600_000;
  return { start: new Date(week.start.getTime() - day), end: new Date(week.end.getTime() + day) };
}
