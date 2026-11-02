import { describe, expect, it } from 'vitest';
import { colors, minTouchTarget, radii, tokensToCss } from './tokens';

describe('tokens', () => {
  it('tem os valores de design acordados', () => {
    expect(colors).toMatchObject({
      background: '#F5F4F0',
      surface: '#FFFFFF',
      border: '#E4E2DC',
      text: '#16191D',
      textMuted: '#5B616B',
      accent: '#0F6E6A',
      urgent: '#B4440E',
    });
    expect(radii.card).toBe(16);
    expect(minTouchTarget).toBeGreaterThanOrEqual(44);
  });

  it('gera variáveis CSS', () => {
    const css = tokensToCss();
    expect(css).toContain('--turno-color-background: #F5F4F0;');
    expect(css).toContain('--turno-color-text-muted: #5B616B;');
    expect(css).toContain('--turno-radius-card: 16px;');
  });
});
