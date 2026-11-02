import { describe, expect, it } from 'vitest';
import { fromLisbonLocal, toLisbonDateKey } from '../time';
import { buildWeekView, weekQueryRange } from './week';

const row = (id: string, date: string, start: string, endDate: string, end: string) => ({
  id,
  starts_at: fromLisbonLocal(date, start).toISOString(),
  ends_at: fromLisbonLocal(endDate, end).toISOString(),
});

describe('buildWeekView', () => {
  const shifts = [
    row('domingo-anterior', '2026-11-01', '15:00', '2026-11-01', '23:00'),
    row('seg', '2026-11-02', '07:00', '2026-11-02', '15:00'),
    row('qua-noite', '2026-11-04', '19:00', '2026-11-05', '02:00'),
    row('qua-manha', '2026-11-04', '09:00', '2026-11-04', '12:00'),
  ];

  const view = buildWeekView({
    shifts,
    weekOf: '2026-11-04T12:00:00Z',
    weeklyHours: 16,
    now: '2026-11-04T10:00:00Z',
  });

  it('tem 7 dias de segunda a domingo', () => {
    expect(view.days.map((d) => d.dateKey)).toEqual([
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
      '2026-11-05',
      '2026-11-06',
      '2026-11-07',
      '2026-11-08',
    ]);
  });

  it('marca o dia de hoje', () => {
    expect(view.days.filter((d) => d.isToday).map((d) => d.dateKey)).toEqual(['2026-11-04']);
  });

  it('agrupa pelo dia de início e ordena', () => {
    expect(view.days[0]?.shifts.map((s) => s.id)).toEqual(['seg']);
    expect(view.days[2]?.shifts.map((s) => s.id)).toEqual(['qua-manha', 'qua-noite']);
    expect(view.days[2]?.shifts[1]?.durationHours).toBe(7);
  });

  it('não mostra turnos de fora da semana, mas usa-os para o descanso', () => {
    expect(view.days.flatMap((d) => d.shifts).map((s) => s.id)).not.toContain('domingo-anterior');
    expect(view.shortRests).toHaveLength(1);
    expect(view.shortRests[0]?.before.id).toBe('domingo-anterior');
    expect(view.shortRests[0]?.restHours).toBe(8);
  });

  it('soma as horas e compara com o limite', () => {
    expect(view.totalHours).toBe(18);
    expect(view.exceedsWeeklyHours).toBe(true);
    expect(view.excessHours).toBe(2);
  });
});

describe('weekQueryRange', () => {
  it('acrescenta um dia de cada lado', () => {
    const r = weekQueryRange('2026-11-04T12:00:00Z');
    expect(toLisbonDateKey(r.start)).toBe('2026-11-01');
    expect(toLisbonDateKey(r.end)).toBe('2026-11-10');
  });
});
