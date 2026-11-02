import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { getErrorMessage } from './errors';

describe('getErrorMessage', () => {
  it('traduz erros do Postgres', () => {
    expect(getErrorMessage({ code: '23503', message: 'violates foreign key' })).toMatch(
      /pedidos de troca/,
    );
    expect(getErrorMessage({ code: '42501', message: 'permission denied' })).toMatch(/permissão/);
  });

  it('traduz erros de autenticação', () => {
    expect(getErrorMessage({ message: 'Signups not allowed for otp', status: 422 })).toMatch(
      /não está registado/,
    );
    expect(getErrorMessage({ message: 'x', status: 429 })).toMatch(/demasiados/);
  });

  it('usa a mensagem do zod', () => {
    const r = z.string().min(3, { error: 'Curto demais.' }).safeParse('a');
    expect(getErrorMessage(r.error)).toBe('Curto demais.');
  });

  it('tem uma mensagem por omissão', () => {
    expect(getErrorMessage(null)).toBe('Ocorreu um erro inesperado.');
  });
});
