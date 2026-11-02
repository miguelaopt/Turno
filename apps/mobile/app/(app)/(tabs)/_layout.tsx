import Ionicons from '@expo/vector-icons/Ionicons';
import { actionableSwapCount, unreadCount } from '@turno/shared';
import { colors, fontFamily } from '@turno/shared/tokens';
import { Tabs } from 'expo-router';
import { useSession } from '@/hooks/use-session';
import { useNotifications, useSwapRequests } from '@/hooks/use-turno-data';

export default function TabsLayout() {
  const { client, profile } = useSession();
  const swaps = useSwapRequests(client, profile.store_id);
  const notifications = useNotifications(client, profile.id);
  const pending = swaps.data ? actionableSwapCount(swaps.data, profile) : 0;
  const unread = unreadCount(notifications.data);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          minHeight: 56,
        },
        tabBarLabelStyle: { fontFamily: fontFamily.native.semibold, fontSize: 12 },
        tabBarBadgeStyle: { backgroundColor: colors.urgent, fontFamily: fontFamily.native.bold },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Turnos',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" color={color as string} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="pedidos"
        options={{
          title: profile.role === 'manager' ? 'Aprovações' : 'Pedidos',
          tabBarBadge: pending || undefined,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="swap-horizontal" color={color as string} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="notificacoes"
        options={{
          title: 'Notificações',
          tabBarBadge: unread || undefined,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="notifications-outline" color={color as string} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
