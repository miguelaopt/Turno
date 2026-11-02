import { describe, expect, it } from 'vitest';
import { fromLisbonLocal } from '../time';
import { checkRest, findShortRests, MIN_REST_HOURS, restHoursBetween } from './rest';
import type { TimeRange } from './types';

const shift = (date: string, start: string, end: string, id?: string): TimeRange => {
  const startsAt = fromLisbonLocal(date, start);
  let endsAt = fromLisbonLocal(date, end);
  if (endsAt <= startsAt) endsAt = new Date(endsAt.getTime() + 24 * 3600_000);
  return { id, startsAt, endsAt };
};

describe('restHoursBetween', () => {
  it('mede do fim de um ao início do outro', () => {
    expect(
      restHoursBetween(
        shift('2026-11-04', '15:00', '23:00'),
        shift('2026-11-05', '07:00', '15:00'),
      ),
    ).toBe(8);
  });

  it('é negativo quando há sobreposição', () => {
    expect(
      restHoursBetween(
        shift('2026-11-04', '09:00', '17:00'),
        shift('2026-11-04', '16:00', '20:00'),
      ),
    ).toBe(-1);
  });
});

describe('findShortRests', () => {
  it('o mínimo é 11 horas', () => {
    expect(MIN_REST_HOURS).toBe(11);
  });

  it('encontra o fecho seguido de abertura', () => {
    const shifts = [
      shift('2026-11-05', '07:00', '15:00', 'abertura'),
      shift('2026-11-04', '15:00', '23:00', 'fecho'),
      shift('2026-11-02', '09:00', '17:00', 'seg'),
    ];
    const gaps = findShortRests(shifts);
    expect(gaps).toHaveLength(1);
    expect(gaps[0]?.before.id).toBe('fecho');
    expect(gaps[0]?.after.id).toBe('abertura');
    expect(gaps[0]?.restHours).toBe(8);
  });

  it('turno partido no mesmo dia não é aviso', () => {
    const shifts = [shift('2026-11-04', '11:00', '15:00'), shift('2026-11-04', '19:00', '23:00')];
    expect(findShortRests(shifts)).toEqual([]);
  });

  it('com turno partido, compara o fim do último turno com o dia seguinte', () => {
    const shifts = [
      shift('2026-11-04', '11:00', '15:00', 'almoco'),
      shift('2026-11-04', '19:00', '23:00', 'jantar'),
      shift('2026-11-05', '08:00', '12:00', 'manha'),
    ];
    const gaps = findShortRests(shifts);
    expect(gaps).toHaveLength(1);
    expect(gaps[0]?.before.id).toBe('jantar');
    expect(gaps[0]?.restHours).toBe(9);
  });

  it('exatamente 11 horas não é aviso', () => {
    const shifts = [shift('2026-11-04', '12:00', '20:00'), shift('2026-11-05', '07:00', '15:00')];
    expect(findShortRests(shifts)).toEqual([]);
  });

  it('respeita a mudança de hora (a noite de 25 out tem mais uma hora)', () => {
    // Sáb 24 out 23:00 → dom 25 out 09:00 = 11 horas reais (10 no relógio)
    const shifts = [shift('2026-10-24', '15:00', '23:00'), shift('2026-10-25', '09:00', '17:00')];
    expect(findShortRests(shifts)).toEqual([]);
  });
});

describe('checkRest', () => {
  const existing = [
    shift('2026-11-02', '09:00', '17:00', 'seg'),
    shift('2026-11-04', '09:00', '17:00', 'qua'),
  ];

  it('sem aviso com descanso suficiente', () => {
    expect(
      checkRest({ shifts: existing, candidate: shift('2026-11-03', '09:00', '17:00') }),
    ).toEqual([]);
  });

  it('avisa sobre o turno anterior', () => {
    const gaps = checkRest({ shifts: existing, candidate: shift('2026-11-03', '02:00', '08:00') });
    expect(gaps).toHaveLength(1);
    expect(gaps[0]?.before.id).toBe('seg');
    expect(gaps[0]?.restHours).toBe(9);
  });

  it('avisa sobre o turno seguinte', () => {
    const gaps = checkRest({ shifts: existing, candidate: shift('2026-11-03', '17:00', '23:30') });
    expect(gaps).toHaveLength(1);
    expect(gaps[0]?.after.id).toBe('qua');
    expect(gaps[0]?.restHours).toBe(9.5);
  });

  it('avisa sobre os dois lados', () => {
    const gaps = checkRest({ shifts: existing, candidate: shift('2026-11-03', '01:00', '23:00') });
    expect(gaps.map((g) => g.restHours)).toEqual([8, 10]);
  });

  it('deteta sobreposições', () => {
    const gaps = checkRest({ shifts: existing, candidate: shift('2026-11-02', '16:00', '20:00') });
    expect(gaps.some((g) => g.restHours < 0)).toBe(true);
  });

  it('não repete avisos que já existiam sem o candidato', () => {
    const shifts = [shift('2026-11-04', '15:00', '23:00'), shift('2026-11-05', '07:00', '12:00')];
    // Juntar um segundo turno na quinta à tarde não cria um problema novo.
    expect(checkRest({ shifts, candidate: shift('2026-11-05', '16:00', '20:00') })).toEqual([]);
  });

  it('acrescentar um turno ao mesmo dia não gera aviso de descanso', () => {
    const candidate = shift('2026-11-04', '19:00', '23:00');
    expect(checkRest({ shifts: existing, candidate })).toEqual([]);
  });

  it('ao editar, ignora a versão antiga do próprio turno', () => {
    const edited = shift('2026-11-04', '10:00', '18:00', 'qua');
    expect(checkRest({ shifts: existing, candidate: edited })).toEqual([]);
  });

  it('aceita um mínimo diferente', () => {
    const candidate = shift('2026-11-03', '03:00', '08:00'); // 10 h depois de seg
    expect(checkRest({ shifts: existing, candidate, minRestHours: 11 })).toHaveLength(1);
    expect(checkRest({ shifts: existing, candidate, minRestHours: 8 })).toEqual([]);
  });
});
