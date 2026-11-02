import { createContext, useContext, type ReactNode } from 'react';
import type { usePush } from './use-push';

type PushValue = ReturnType<typeof usePush>;
const PushContext = createContext<PushValue | null>(null);

export function PushProvider({ value, children }: { value: PushValue; children: ReactNode }) {
  return <PushContext.Provider value={value}>{children}</PushContext.Provider>;
}

export function usePushStatus(): PushValue {
  const value = useContext(PushContext);
  if (!value) throw new Error('usePushStatus fora de PushProvider');
  return value;
}
