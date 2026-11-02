// Chaves do TanStack Query partilhadas. Os eventos Realtime invalidam por
// prefixo (ex.: ['shifts']), por isso todas as chaves de turnos começam assim.
export const queryKeys = {
  profile: (userId: string) => ['profile', userId] as const,
  shifts: {
    all: ['shifts'] as const,
    mineInRange: (userId: string, fromIso: string, toIso: string) =>
      ['shifts', 'mine', userId, fromIso, toIso] as const,
  },
  swapRequests: {
    all: ['swap_requests'] as const,
  },
} as const;
