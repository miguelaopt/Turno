import { describe, expect, it } from 'vitest';
import { fromLisbonLocal } from '../time';
import { evaluateShiftAssignment, formatShiftWarning } from './warnings';

const s = (date: string, start: string, end: string, id?: string) => ({
  id,
  startsAt: fromLisbonLocal(date, start),
  endsAt: fromLisbonLocal(date, end),
});

describe('evaluateShiftAssignment', () => {
  it('junta avisos de horas e de descanso, em pt-PT', () => {
    const shifts = [s('2026-11-04', '15:00', '23:00', 'fecho')];
    const candidate = s('2026-11-05', '07:00', '15:00');
    const warnings = evaluateShiftAssignment({ shifts, candidate, weeklyHours: 10 });

    expect(warnings.map((w) => w.kind)).toEqual(['short_rest', 'weekly_hours_exceeded']);
    expect(warnings.map(formatShiftWarning)).toEqual([
      'Só 8 h de descanso entre quarta-feira, 4 de novembro às 23:00 e quinta-feira, 5 de novembro às 07:00 (mínimo 11 h).',
      'Semana de 2–8 de novembro de 2026: 16 h para um limite de 10 h (+6 h).',
    ]);
  });

  it('distingue sobreposição de pouco descanso', () => {
    const shifts = [s('2026-11-04', '09:00', '17:00')];
    const warnings = evaluateShiftAssignment({
      shifts,
      candidate: s('2026-11-04', '16:00', '20:00'),
      weeklyHours: 40,
    });
    expect(warnings.map((w) => w.kind)).toEqual(['overlap']);
    expect(formatShiftWarning(warnings[0]!)).toBe(
      'Sobreposição com outro turno em quarta-feira, 4 de novembro.',
    );
  });

  it('sem avisos quando está tudo bem', () => {
    expect(
      evaluateShiftAssignment({
        shifts: [s('2026-11-02', '09:00', '17:00')],
        candidate: s('2026-11-03', '09:00', '17:00'),
        weeklyHours: 40,
      }),
    ).toEqual([]);
  });
});
