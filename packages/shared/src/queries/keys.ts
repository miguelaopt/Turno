// Chaves do TanStack Query partilhadas. Os eventos Realtime invalidam por
// prefixo (ex.: ['shifts']), por isso todas as chaves de uma tabela começam
// pelo mesmo prefixo.
export const queryKeys = {
  profile: (userId: string) => ['profile', userId] as const,
  storeProfiles: (storeId: string) => ['profiles', 'store', storeId] as const,
  shifts: {
    all: ['shifts'] as const,
    mineInRange: (userId: string, fromIso: string, toIso: string) =>
      ['shifts', 'mine', userId, fromIso, toIso] as const,
    usersInRange: (userIds: readonly string[], fromIso: string, toIso: string) =>
      ['shifts', 'users', [...userIds].sort().join(','), fromIso, toIso] as const,
  },
  swapRequests: {
    all: ['swap_requests'] as const,
    list: (storeId: string) => ['swap_requests', 'list', storeId] as const,
    detail: (id: string) => ['swap_requests', 'detail', id] as const,
    events: (id: string) => ['swap_requests', 'events', id] as const,
  },
  notifications: {
    all: ['notifications'] as const,
    mine: (userId: string) => ['notifications', userId] as const,
  },
} as const;
