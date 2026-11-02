import {
  formatDateTimeShort,
  getErrorMessage,
  notificationPath,
  unreadCount,
  type AppNotification,
} from '@turno/shared';
import { colors, radii, spacing } from '@turno/shared/tokens';
import { router, type Href } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, Text, WarningBox } from '@/components/ui';
import { usePushStatus } from '@/hooks/push-context';
import { useSession } from '@/hooks/use-session';
import { useMarkNotificationsRead, useNotifications } from '@/hooks/use-turno-data';

export default function NotificacoesTab() {
  const { client, profile } = useSession();
  const notifications = useNotifications(client, profile.id);
  const markRead = useMarkNotificationsRead(client, profile.id);
  const push = usePushStatus();
  const unread = unreadCount(notifications.data);

  const open = (n: AppNotification) => {
    if (!n.read_at) markRead.mutate([n.id]);
    router.push(notificationPath(n) as Href);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl }}
        refreshControl={
          <RefreshControl
            refreshing={notifications.isRefetching}
            onRefresh={() => void notifications.refetch()}
            tintColor={colors.accent}
          />
        }
      >
        <Text weight="bold" size="xxl" accessibilityRole="header">
          Notificações
        </Text>

        {push.status.state === 'needs-permission' || push.status.state === 'denied' ? (
          <Card style={{ gap: spacing.sm }}>
            <Text weight="bold">Avisos no telemóvel</Text>
            <Text muted size="sm">
              {push.status.state === 'denied'
                ? 'As notificações estão bloqueadas. Ativa-as nas definições do telemóvel.'
                : 'Recebe um aviso quando alguém precisa de troca ou quando um pedido teu muda.'}
            </Text>
            {push.status.state === 'needs-permission' ? (
              <Button title="Ativar notificações" onPress={() => void push.enable()} />
            ) : null}
            {push.error ? (
              <Text size="sm" style={{ color: colors.urgent }}>
                {push.error}
              </Text>
            ) : null}
          </Card>
        ) : null}
        {push.status.state === 'unsupported' ? (
          <Text muted size="sm">
            {push.status.reason}
          </Text>
        ) : null}

        {unread > 0 ? (
          <Button
            title="Marcar todas como lidas"
            variant="outline"
            loading={markRead.isPending}
            onPress={() => markRead.mutate(undefined)}
          />
        ) : null}

        {notifications.isError ? (
          <WarningBox
            title="Não foi possível carregar as notificações"
            items={[getErrorMessage(notifications.error)]}
          />
        ) : null}

        {notifications.isPending ? (
          <Text muted size="sm">
            A carregar…
          </Text>
        ) : !notifications.data?.length ? (
          <Text muted size="sm">
            Ainda não tens notificações.
          </Text>
        ) : (
          notifications.data.map((n) => (
            <Pressable
              key={n.id}
              accessibilityRole="button"
              accessibilityHint={n.read_at ? undefined : 'Não lida'}
              onPress={() => open(n)}
              style={({ pressed }) => ({
                backgroundColor: n.urgent && !n.read_at ? colors.urgentSoft : colors.surface,
                borderColor: !n.read_at
                  ? n.urgent
                    ? colors.urgent
                    : colors.accent
                  : colors.border,
                borderWidth: 1,
                borderRadius: radii.card,
                padding: spacing.lg,
                gap: spacing.xs,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <View
                style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}
              >
                <Text weight={n.read_at ? 'semibold' : 'bold'} style={{ flex: 1 }}>
                  {n.urgent ? (
                    <Text weight="bold" style={{ color: colors.urgent }}>
                      Urgente ·{' '}
                    </Text>
                  ) : null}
                  {n.title}
                </Text>
                {!n.read_at ? (
                  <View
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      backgroundColor: colors.accent,
                      marginTop: 6,
                    }}
                  />
                ) : null}
              </View>
              <Text size="sm">{n.body}</Text>
              <Text muted size="xs">
                {formatDateTimeShort(n.created_at)}
              </Text>
            </Pressable>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
