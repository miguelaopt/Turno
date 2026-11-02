import { describe, expect, it } from 'vitest';
import {
  capitalizeFirst,
  formatDateTimeShort,
  formatShiftSummary,
  maskTimeInput,
  formatDayLong,
  formatHours,
  formatTime,
  formatWeekRange,
  fromLisbonLocal,
  hoursBetween,
  lisbonWeek,
  lisbonWeekDays,
  shiftLisbonWeek,
  startOfLisbonWeek,
  toLisbonDateKey,
  toLisbonTimeString,
} from './index';

describe('fromLisbonLocal', () => {
  it('no inverno, Lisboa = UTC', () => {
    expect(fromLisbonLocal('2026-01-15', '09:00').toISOString()).toBe('2026-01-15T09:00:00.000Z');
  });

  it('no verão, Lisboa = UTC+1', () => {
    expect(fromLisbonLocal('2026-07-15', '09:00').toISOString()).toBe('2026-07-15T08:00:00.000Z');
  });

  it('rejeita formatos inválidos', () => {
    expect(() => fromLisbonLocal('15/07/2026', '09:00')).toThrow();
    expect(() => fromLisbonLocal('2026-07-15', '25:00')).toThrow();
  });

  it('é o inverso de toLisbonDateKey/toLisbonTimeString', () => {
    const d = new Date('2026-08-01T22:30:00Z'); // 23:30 em Lisboa
    expect(toLisbonDateKey(d)).toBe('2026-08-01');
    expect(toLisbonTimeString(d)).toBe('23:30');
    expect(fromLisbonLocal(toLisbonDateKey(d), toLisbonTimeString(d)).getTime()).toBe(d.getTime());
  });

  it('usa o dia de Lisboa e não o UTC perto da meia-noite', () => {
    // 23:30 UTC de 31 jul = 00:30 de 1 ago em Lisboa (verão)
    expect(toLisbonDateKey('2026-07-31T23:30:00Z')).toBe('2026-08-01');
  });
});

describe('semanas (segunda a domingo, Lisboa)', () => {
  it('começa à segunda-feira às 00:00 de Lisboa', () => {
    // quarta, 4 nov 2026
    const start = startOfLisbonWeek('2026-11-04T12:00:00Z');
    expect(start.toISOString()).toBe('2026-11-02T00:00:00.000Z');
  });

  it('domingo pertence à semana que começou na segunda anterior', () => {
    const start = startOfLisbonWeek('2026-11-08T22:00:00Z');
    expect(toLisbonDateKey(start)).toBe('2026-11-02');
  });

  it('segunda às 00:30 de Lisboa no verão (ainda domingo em UTC) já é a semana nova', () => {
    const start = startOfLisbonWeek('2026-07-12T23:30:00Z'); // seg 13 jul 00:30 Lisboa
    expect(toLisbonDateKey(start)).toBe('2026-07-13');
    expect(start.toISOString()).toBe('2026-07-12T23:00:00.000Z');
  });

  it('a semana da mudança de hora de outubro tem 169 horas', () => {
    // 25 out 2026: os relógios atrasam 1h em Lisboa
    const week = lisbonWeek('2026-10-21T12:00:00Z');
    expect(hoursBetween(week.start, week.end)).toBe(169);
  });

  it('a semana da mudança de hora de março tem 167 horas', () => {
    // 29 mar 2026: os relógios adiantam 1h
    const week = lisbonWeek('2026-03-25T12:00:00Z');
    expect(hoursBetween(week.start, week.end)).toBe(167);
  });

  it('lisbonWeekDays devolve 7 meias-noites seguidas', () => {
    const days = lisbonWeekDays('2026-10-21T12:00:00Z').map(toLisbonDateKey);
    expect(days).toEqual([
      '2026-10-19',
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
    ]);
  });

  it('shiftLisbonWeek avança e recua semanas', () => {
    const next = shiftLisbonWeek('2026-11-02T00:00:00Z', 1);
    expect(toLisbonDateKey(next.start)).toBe('2026-11-09');
    const prev = shiftLisbonWeek('2026-11-02T00:00:00Z', -1);
    expect(toLisbonDateKey(prev.start)).toBe('2026-10-26');
  });
});

describe('formatação pt-PT', () => {
  it('formata horas em 24h no fuso de Lisboa', () => {
    expect(formatTime('2026-07-15T08:00:00Z')).toBe('09:00');
    expect(formatTime('2026-07-15T23:00:00Z')).toBe('00:00');
  });

  it('formata o dia por extenso', () => {
    expect(formatDayLong('2026-11-02T10:00:00Z')).toBe('segunda-feira, 2 de novembro');
  });

  it('formata intervalos de semana', () => {
    expect(formatWeekRange('2026-11-04T10:00:00Z')).toBe('2–8 de novembro de 2026');
    expect(formatWeekRange('2026-12-01T10:00:00Z')).toBe('30 de novembro – 6 de dezembro de 2026');
    expect(formatWeekRange('2026-12-30T10:00:00Z')).toBe(
      '28 de dezembro de 2026 – 3 de janeiro de 2027',
    );
  });

  it('capitaliza só a primeira letra', () => {
    expect(capitalizeFirst(formatDayLong('2026-11-02T10:00:00Z'))).toBe(
      'Segunda-feira, 2 de novembro',
    );
  });

  it('formata horas com vírgula decimal', () => {
    expect(formatHours(7.5)).toBe('7,5 h');
    expect(formatHours(40)).toBe('40 h');
  });
});

describe('maskTimeInput', () => {
  it('formata o que se escreve no teclado numérico', () => {
    expect(maskTimeInput('9')).toBe('9');
    expect(maskTimeInput('17')).toBe('17');
    expect(maskTimeInput('930')).toBe('09:30');
    expect(maskTimeInput('1730')).toBe('17:30');
    expect(maskTimeInput('17:30')).toBe('17:30');
    expect(maskTimeInput('173045')).toBe('17:30');
  });
});

describe('formatos curtos', () => {
  it('igual ao texto gerado pela BD (private.format_shift)', () => {
    expect(formatShiftSummary('2026-11-05T07:00:00Z', '2026-11-05T15:00:00Z')).toBe(
      'qui., 5 nov., 07:00–15:00',
    );
    expect(formatShiftSummary('2026-11-09T18:00:00Z', '2026-11-10T00:00:00Z')).toBe(
      'seg., 9 nov., 18:00–00:00',
    );
    expect(formatShiftSummary('2026-05-16T10:00:00Z', '2026-05-16T15:00:00Z')).toBe(
      'sáb., 16 mai., 11:00–16:00',
    );
  });

  it('data e hora', () => {
    expect(formatDateTimeShort('2026-11-02T14:05:00Z')).toBe('seg., 2 nov., 14:05');
  });
});
