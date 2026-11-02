import { describe, expect, it } from 'vitest';
import { parseAuthCallbackUrl } from './auth';

describe('parseAuthCallbackUrl', () => {
  it('lê o código PKCE da query', () => {
    expect(parseAuthCallbackUrl('turno://auth/callback?code=abc123')).toEqual({ code: 'abc123' });
  });

  it('funciona com URLs do Expo Go', () => {
    expect(parseAuthCallbackUrl('exp://192.168.1.10:8081/--/auth/callback?code=xyz')).toEqual({
      code: 'xyz',
    });
  });

  it('lê erros do fragmento', () => {
    expect(
      parseAuthCallbackUrl(
        'https://turno.exemplo/auth/callback#error=access_denied&error_description=Email+link+is+invalid+or+has+expired',
      ),
    ).toEqual({ error: 'Email link is invalid or has expired' });
  });
});
