'use client';

import type { MyProfile, Session, TurnoClient } from '@turno/shared';
import { createContext, useContext, type ReactNode } from 'react';

export interface SessionValue {
  client: TurnoClient;
  session: Session;
  profile: MyProfile;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ value, children }: { value: SessionValue; children: ReactNode }) {
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

/** Sessão + perfil de quem está a usar a app. Só existe dentro de app/(app). */
export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession fora de SessionProvider');
  return value;
}
