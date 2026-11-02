import { formatDayLong, formatHours, formatTime, formatWeekRange } from '../time';
import { checkWeeklyHours, type WeeklyHoursResult } from './hours';
import { checkRest, MIN_REST_HOURS, type RestGap } from './rest';
import type { TimeRange } from './types';

// Avisos (não bloqueios): servem para a gerente decidir com informação.

export type ShiftWarning =
  | { kind: 'weekly_hours_exceeded'; detail: WeeklyHoursResult }
  | { kind: 'short_rest'; detail: RestGap }
  | { kind: 'overlap'; detail: RestGap };

/** Avisos se a pessoa ficar com o turno `candidate`. */
export function evaluateShiftAssignment(params: {
  shifts: readonly TimeRange[];
  candidate: TimeRange;
  weeklyHours: number;
  minRestHours?: number;
}): ShiftWarning[] {
  const warnings: ShiftWarning[] = [];
  for (const detail of checkRest(params)) {
    warnings.push({ kind: detail.restHours < 0 ? 'overlap' : 'short_rest', detail });
  }
  for (const detail of checkWeeklyHours(params)) {
    warnings.push({ kind: 'weekly_hours_exceeded', detail });
  }
  return warnings;
}

/** Mensagem em pt-PT para mostrar ao utilizador. */
export function formatShiftWarning(warning: ShiftWarning): string {
  switch (warning.kind) {
    case 'weekly_hours_exceeded': {
      const d = warning.detail;
      return (
        `Semana de ${formatWeekRange(d.week.start)}: ${formatHours(d.totalHours)} ` +
        `para um limite de ${formatHours(d.limitHours)} (+${formatHours(d.excessHours)}).`
      );
    }
    case 'short_rest': {
      const d = warning.detail;
      return (
        `Só ${formatHours(d.restHours)} de descanso entre ${formatDayLong(d.before.endsAt)} ` +
        `às ${formatTime(d.before.endsAt)} e ${formatDayLong(d.after.startsAt)} às ` +
        `${formatTime(d.after.startsAt)} (mínimo ${MIN_REST_HOURS} h).`
      );
    }
    case 'overlap': {
      const d = warning.detail;
      return `Sobreposição com outro turno em ${formatDayLong(d.after.startsAt)}.`;
    }
  }
}
