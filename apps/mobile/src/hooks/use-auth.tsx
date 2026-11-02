import { useQueryClient } from '@tanstack/react-query';
import { getErrorMessage, type Session, type TurnoClient } from '@turno/shared';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getSupabase } from '@/lib/supabase';

type AuthState =
  | { status: 'loading' }
  | { status: 'config-error'; message: string }
  | { status: 'signed-out'; client: TurnoClient }
  | { status: 'signed-in'; client: TurnoClient; session: Session };

const AuthContext = createContext<AuthState>({ status: 'loading' });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  const queryClient = useQueryClient();

  useEffect(() => {
    let client: TurnoClient;
    try {
      client = getSupabase();
    } catch (error) {
      setState({ status: 'config-error', message: getErrorMessage(error) });
      return;
    }

    const apply = (session: Session | null) =>
      setState(
        session ? { status: 'signed-in', client, session } : { status: 'signed-out', client },
      );

    void client.auth.getSession().then(({ data }) => apply(data.session));

    const { data } = client.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') queryClient.clear();
      apply(session);
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient]);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
