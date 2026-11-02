// Tokens de design do Turno: a única fonte de verdade para web e mobile.
// Valores neutros, sem cores nem logótipos de marcas reais.

export const colors = {
  background: '#F5F4F0',
  surface: '#FFFFFF',
  border: '#E4E2DC',
  text: '#16191D',
  textMuted: '#5B616B',
  accent: '#0F6E6A',
  accentForeground: '#FFFFFF',
  accentSoft: '#E3F0EF',
  urgent: '#B4440E',
  urgentForeground: '#FFFFFF',
  urgentSoft: '#F8E9E1',
} as const;

export const radii = {
  card: 16,
  control: 12,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const fontFamily = {
  /** Nome da família; no mobile os pesos são carregados como famílias separadas. */
  sans: 'Manrope',
  native: {
    regular: 'Manrope_400Regular',
    medium: 'Manrope_500Medium',
    semibold: 'Manrope_600SemiBold',
    bold: 'Manrope_700Bold',
  },
} as const;

export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
} as const;

/** Alvo de toque mínimo (px / pt). */
export const minTouchTarget = 44;

export const tokens = { colors, radii, spacing, fontFamily, fontSize, minTouchTarget } as const;
export type Tokens = typeof tokens;

const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/** Variáveis CSS (--turno-*) geradas a partir dos tokens, para a web. */
export function tokensToCssVariables(): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [k, v] of Object.entries(colors)) vars[`--turno-color-${kebab(k)}`] = v;
  for (const [k, v] of Object.entries(radii)) vars[`--turno-radius-${kebab(k)}`] = `${v}px`;
  vars['--turno-min-touch'] = `${minTouchTarget}px`;
  return vars;
}

/** O mesmo que tokensToCssVariables, como texto para um bloco :root { ... }. */
export function tokensToCss(): string {
  const body = Object.entries(tokensToCssVariables())
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n');
  return `:root {\n${body}\n}`;
}
