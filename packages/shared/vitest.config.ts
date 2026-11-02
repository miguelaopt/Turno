import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // Os testes não dependem do fuso da máquina: forçamos UTC para provar
    // que os cálculos usam sempre Europe/Lisbon explicitamente.
    env: { TZ: 'UTC' },
  },
});
