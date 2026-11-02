import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createTurnoClient, type TurnoClient } from '@turno/shared';
import { AppState } from 'react-native';

let client: TurnoClient | undefined;

/**
 * Cliente Supabase da app (singleton). A sessão fica no AsyncStorage e o
 * código do magic link é trocado em app/auth/callback.tsx.
 */
export function getSupabase(): TurnoClient {
  if (client) return client;
  const created = createTurnoClient({
    // Referências literais: o Expo substitui-as no bundle.
    url: process.env.EXPO_PUBLIC_SUPABASE_URL,
    anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    platform: 'native',
    storage: AsyncStorage,
  });

  // Só renovar o token enquanto a app está em primeiro plano.
  AppState.addEventListener('change', (state) => {
    if (state === 'active') void created.auth.startAutoRefresh();
    else void created.auth.stopAutoRefresh();
  });

  client = created;
  return created;
}
