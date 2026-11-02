import { describe, expect, it } from 'vitest';
import { fromLisbonLocal } from '../time';
import { checkWeeklyHours, overlapHours, shiftDurationHours, weeklyHoursSummary } from './hours';
import type { TimeRange } from './types';

const shift = (date: string, start: string, end: string, id?: string): TimeRange => {
  const startsAt = fromLisbonLocal(date, start);
  let endsAt = fromLisbonLocal(date, end);
  if (endsAt <= startsAt) endsAt = new Date(endsAt.getTime() + 24 * 3600_000);
  return { id, startsAt, endsAt };
};

describe('shiftDurationHours', () => {
  it('calcula a duração', () => {
    expect(shiftDurationHours(shift('2026-11-02', '09:00', '17:30'))).toBe(8.5);
  });

  it('turnos que passam a meia-noite', () => {
    expect(shiftDurationHours(shift('2026-11-02', '19:00', '02:00'))).toBe(7);
  });

  it('conta a hora extra na noite em que os relógios atrasam', () => {
    // 25 out 2026: 22:00 de sábado até 06:00 de domingo = 9 horas reais
    const s = {
      startsAt: fromLisbonLocal('2026-10-24', '22:00'),
      endsAt: fromLisbonLocal('2026-10-25', '06:00'),
    };
    expect(shiftDurationHours(s)).toBe(9);
  });
});

describe('weeklyHoursSummary', () => {
  const week = [
    shift('2026-11-02', '09:00', '17:00'),
    shift('2026-11-03', '09:00', '17:00'),
    shift('2026-11-04', '09:00', '17:00'),
    shift('2026-11-05', '09:00', '17:00'),
    shift('2026-11-06', '09:00', '17:00'),
  ];

  it('soma as horas da semana', () => {
    const r = weeklyHoursSummary(week, '2026-11-04T12:00:00Z', 40);
    expect(r.totalHours).toBe(40);
    expect(r.exceeds).toBe(false);
    expect(r.excessHours).toBe(0);
  });

  it('ignora turnos de outras semanas', () => {
    const r = weeklyHoursSummary(
      [...week, shift('2026-11-09', '09:00', '17:00')],
      '2026-11-04T12:00:00Z',
      40,
    );
    expect(r.totalHours).toBe(40);
  });

  it('corta turnos que atravessam a mudança de semana', () => {
    // domingo 8 nov 20:00 → segunda 9 nov 02:00: 4h numa semana, 2h na outra
    const late = shift('2026-11-08', '20:00', '02:00');
    expect(weeklyHoursSummary([late], '2026-11-04T12:00:00Z', 40).totalHours).toBe(4);
    expect(weeklyHoursSummary([late], '2026-11-10T12:00:00Z', 40).totalHours).toBe(2);
  });

  it('overlapHours devolve 0 sem interseção', () => {
    const r = weeklyHoursSummary([], '2026-11-04T12:00:00Z', 40);
    expect(overlapHours(shift('2026-11-20', '09:00', '17:00'), r.week)).toBe(0);
  });
});

describe('checkWeeklyHours', () => {
  const base = [
    shift('2026-11-02', '09:00', '17:00', 'a'),
    shift('2026-11-03', '09:00', '17:00', 'b'),
    shift('2026-11-04', '09:00', '17:00', 'c'),
    shift('2026-11-05', '09:00', '17:00', 'd'),
  ]; // 32 h

  it('sem aviso quando fica dentro do limite', () => {
    const candidate = shift('2026-11-06', '09:00', '17:00');
    expect(checkWeeklyHours({ shifts: base, candidate, weeklyHours: 40 })).toEqual([]);
  });

  it('avisa quando passa do limite', () => {
    const candidate = shift('2026-11-06', '09:00', '19:00');
    const [r] = checkWeeklyHours({ shifts: base, candidate, weeklyHours: 40 });
    expect(r?.totalHours).toBe(42);
    expect(r?.excessHours).toBe(2);
    expect(r?.exceeds).toBe(true);
  });

  it('ao editar, não conta o mesmo turno duas vezes', () => {
    const edited = shift('2026-11-05', '09:00', '18:00', 'd');
    expect(checkWeeklyHours({ shifts: base, candidate: edited, weeklyHours: 33 })).toEqual([]);
    expect(checkWeeklyHours({ shifts: base, candidate: edited, weeklyHours: 32 })).toHaveLength(1);
  });

  it('verifica as duas semanas se o turno atravessa domingo → segunda', () => {
    const nextWeek = [shift('2026-11-09', '09:00', '17:00'), shift('2026-11-10', '09:00', '17:00')];
    const candidate = shift('2026-11-08', '20:00', '04:00'); // 4h + 4h
    const results = checkWeeklyHours({
      shifts: [...base, ...nextWeek],
      candidate,
      weeklyHours: 19,
    });
    expect(results.map((r) => r.totalHours)).toEqual([36, 16 + 4]);
  });

  it('weekly_hours = 0 avisa com qualquer turno', () => {
    const candidate = shift('2026-11-06', '09:00', '10:00');
    expect(checkWeeklyHours({ shifts: [], candidate, weeklyHours: 0 })).toHaveLength(1);
  });
});
