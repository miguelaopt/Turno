import { registerPushToken, unregisterPushToken, type TurnoClient } from '@turno/shared';
import { colors } from '@turno/shared/tokens';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Notificações push (Expo Push Service). A BD cria as notificações; a Edge
// Function send-push envia-as para os tokens registados aqui.

export type PushStatus =
  | { state: 'registered'; token: string }
  | { state: 'needs-permission' }
  | { state: 'denied' }
  | { state: 'unsupported'; reason: string };

let currentToken: string | null = null;

// Notificações recebidas com a app aberta também aparecem.
Notifications.setNotificationHandler({
  handleNotification: () =>
    Promise.resolve({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
});

async function ensureAndroidChannels() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Pedidos de troca',
    importance: Notifications.AndroidImportance.DEFAULT,
    lightColor: colors.accent,
  });
  await Notifications.setNotificationChannelAsync('urgente', {
    name: 'Cobrir faltas (urgente)',
    importance: Notifications.AndroidImportance.MAX,
    lightColor: colors.urgent,
    vibrationPattern: [0, 250, 250, 250],
  });
}

function projectId(): string | undefined {
  const fromConfig = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)
    ?.eas?.projectId;
  return fromConfig || Constants.easConfig?.projectId || undefined;
}

/**
 * Regista este dispositivo para receber push. Só pede autorização se
 * `askPermission` for true (ex.: quando a pessoa carrega em "Ativar").
 */
export async function registerForPush(
  client: TurnoClient,
  { askPermission }: { askPermission: boolean },
): Promise<PushStatus> {
  if (!Device.isDevice) {
    return {
      state: 'unsupported',
      reason: 'As notificações push só funcionam num telemóvel real.',
    };
  }
  if (
    Platform.OS === 'android' &&
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient
  ) {
    return {
      state: 'unsupported',
      reason:
        'No Android, as notificações push precisam de uma build própria (não funcionam no Expo Go).',
    };
  }
  const id = projectId();
  if (!id) {
    return {
      state: 'unsupported',
      reason: 'Falta configurar o projeto EAS (extra.eas.projectId). Ver README.',
    };
  }

  await ensureAndroidChannels();
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    if (!askPermission) return { state: 'needs-permission' };
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  if (status !== 'granted') return { state: 'denied' };

  const token = (await Notifications.getExpoPushTokenAsync({ projectId: id })).data;
  await registerPushToken(client, token, Platform.OS === 'ios' ? 'ios' : 'android');
  currentToken = token;
  return { state: 'registered', token };
}

/** Ao sair: este dispositivo deixa de receber push desta pessoa. */
export async function unregisterCurrentPushToken(client: TurnoClient): Promise<void> {
  if (!currentToken) return;
  try {
    await unregisterPushToken(client, currentToken);
  } finally {
    currentToken = null;
  }
}

/** URL (ex.: /pedidos/<id>) guardado nos dados da notificação. */
export function urlFromNotification(response: Notifications.NotificationResponse): string | null {
  const url = (response.notification.request.content.data as { url?: unknown } | undefined)?.url;
  return typeof url === 'string' && url.startsWith('/') ? url : null;
}
