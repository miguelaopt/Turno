import { getErrorMessage, type TurnoClient } from '@turno/shared';
import * as Notifications from 'expo-notifications';
import { router, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { registerForPush, urlFromNotification, type PushStatus } from '@/lib/push';

/**
 * Regista o dispositivo (sem perguntar, se já houver autorização) e abre o
 * pedido certo quando se toca numa notificação.
 */
export function usePush(client: TurnoClient) {
  const [status, setStatus] = useState<PushStatus | { state: 'loading' }>({ state: 'loading' });
  const [error, setError] = useState<string | null>(null);

  const register = useCallback(
    async (askPermission: boolean) => {
      setError(null);
      try {
        setStatus(await registerForPush(client, { askPermission }));
      } catch (err) {
        setError(getErrorMessage(err));
        setStatus({ state: 'needs-permission' });
      }
    },
    [client],
  );

  useEffect(() => {
    void register(false);
  }, [register]);

  return { status, error, enable: () => register(true) };
}

/** Navega para o URL da notificação tocada (também com a app fechada). */
export function useNotificationNavigation() {
  useEffect(() => {
    const go = (response: Notifications.NotificationResponse | null) => {
      const url = response ? urlFromNotification(response) : null;
      if (url) router.push(url as Href);
    };
    void Notifications.getLastNotificationResponseAsync().then(go);
    const sub = Notifications.addNotificationResponseReceivedListener(go);
    return () => sub.remove();
  }, []);
}
