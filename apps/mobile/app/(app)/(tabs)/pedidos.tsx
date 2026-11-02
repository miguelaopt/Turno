import { getErrorMessage, groupSwapRequests } from '@turno/shared';
import { colors, spacing } from '@turno/shared/tokens';
import { RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SwapCard } from '@/components/swap-card';
import { Text, WarningBox } from '@/components/ui';
import { useSession } from '@/hooks/use-session';
import { useStoreProfiles, useSwapRequests } from '@/hooks/use-turno-data';

export default function PedidosTab() {
  const { client, profile } = useSession();
  const swaps = useSwapRequests(client, profile.store_id);
  const profiles = useStoreProfiles(client, profile.store_id);
  const sections = groupSwapRequests(swaps.data ?? [], profile);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl }}
        refreshControl={
          <RefreshControl
            refreshing={swaps.isRefetching}
            onRefresh={() => void swaps.refetch()}
            tintColor={colors.accent}
          />
        }
      >
        <View style={{ gap: spacing.xs }}>
          <Text weight="bold" size="xxl" accessibilityRole="header">
            {profile.role === 'manager' ? 'Pedidos e aprovações' : 'Pedidos de troca'}
          </Text>
          <Text muted size="sm">
            {profile.role === 'manager'
              ? 'Aprova ou recusa os pedidos aceites e regista quando já atualizaste o MPI.'
              : 'Para pedir uma troca, abre "Turnos" e escolhe "Pedir troca" num turno teu.'}
          </Text>
        </View>

        {swaps.isError ? (
          <WarningBox
            title="Não foi possível carregar os pedidos"
            items={[getErrorMessage(swaps.error)]}
          />
        ) : null}

        {sections.map((section) => (
          <View key={section.key} style={{ gap: spacing.sm }}>
            <Text weight="bold" accessibilityRole="header">
              {section.title}
              {section.requests.length ? (
                <Text muted size="sm">
                  {'  '}
                  {section.requests.length}
                </Text>
              ) : null}
            </Text>
            {swaps.isPending ? (
              <Text muted size="sm">
                A carregar…
              </Text>
            ) : section.requests.length === 0 ? (
              <Text muted size="sm">
                {section.empty}
              </Text>
            ) : (
              section.requests.map((r) => (
                <SwapCard key={r.id} request={r} profiles={profiles.data} />
              ))
            )}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
