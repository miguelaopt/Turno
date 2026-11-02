import { describe, expect, it } from 'vitest';
import {
  emailSchema,
  fieldErrors,
  parseSupabaseEnv,
  shiftFormSchema,
  shiftFormToTimes,
} from './index';

describe('shiftFormSchema', () => {
  it('aceita um turno normal', () => {
    expect(
      shiftFormSchema.safeParse({ date: '2026-11-02', startTime: '09:00', endTime: '17:00' })
        .success,
    ).toBe(true);
  });

  it('aceita turnos que acabam no dia seguinte', () => {
    const values = { date: '2026-11-02', startTime: '19:00', endTime: '02:00' };
    expect(shiftFormSchema.safeParse(values).success).toBe(true);
    const { startsAt, endsAt } = shiftFormToTimes(values);
    expect(startsAt.toISOString()).toBe('2026-11-02T19:00:00.000Z');
    expect(endsAt.toISOString()).toBe('2026-11-03T02:00:00.000Z');
  });

  it('passa a meia-noite no fim do mês', () => {
    const { endsAt } = shiftFormToTimes({
      date: '2026-12-31',
      startTime: '20:00',
      endTime: '01:00',
    });
    expect(endsAt.toISOString()).toBe('2027-01-01T01:00:00.000Z');
  });

  it('recusa início igual ao fim', () => {
    const r = shiftFormSchema.safeParse({
      date: '2026-11-02',
      startTime: '09:00',
      endTime: '09:00',
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(fieldErrors(r.error).endTime).toMatch(/diferente/);
  });

  it('recusa turnos com mais de 16 horas', () => {
    const r = shiftFormSchema.safeParse({
      date: '2026-11-02',
      startTime: '06:00',
      endTime: '23:00',
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(fieldErrors(r.error).endTime).toMatch(/16 horas/);
  });

  it('recusa horas mal escritas', () => {
    const r = shiftFormSchema.safeParse({ date: '2026-11-02', startTime: '9h', endTime: '17:00' });
    expect(r.success).toBe(false);
    if (!r.success) expect(fieldErrors(r.error).startTime).toBe('Hora de início inválida (HH:MM).');
  });
});

describe('emailSchema', () => {
  it('normaliza o email', () => {
    expect(emailSchema.parse('  Ana@Exemplo.PT ')).toBe('ana@exemplo.pt');
  });

  it('recusa emails inválidos', () => {
    expect(emailSchema.safeParse('ana@').success).toBe(false);
  });
});

describe('parseSupabaseEnv', () => {
  it('explica o que falta', () => {
    expect(() => parseSupabaseEnv({ url: '', anonKey: '' })).toThrow(/\.env/);
  });

  it('aceita valores válidos', () => {
    expect(parseSupabaseEnv({ url: 'http://127.0.0.1:54321', anonKey: 'x'.repeat(40) }).url).toBe(
      'http://127.0.0.1:54321',
    );
  });
});
