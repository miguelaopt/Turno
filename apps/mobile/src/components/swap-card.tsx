import {
  formatDateTimeShort,
  formatShiftSummary,
  profileName,
  type StoreProfile,
  type SwapRequestWithShifts,
} from '@turno/shared';
import { colors, radii, spacing } from '@turno/shared/tokens';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { SwapStatusBadge, SwapTypeBadge } from './swap-badges';
import { Text } from './ui';

export function SwapCard({
  request: r,
  profiles,
}: {
  request: SwapRequestWithShifts;
  profiles: StoreProfile[] | undefined;
}) {
  const summary = r.shift ? formatShiftSummary(r.shift.starts_at, r.shift.ends_at) : 'Turno';
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Pedido de ${profileName(profiles, r.requester_id)}, ${summary}`}
      onPress={() => router.push(`/pedidos/${r.id}`)}
      style={({ pressed }) => ({
        backgroundColor: colors.surface,
        borderColor: r.type === 'cover' && r.status === 'open' ? colors.urgent : colors.border,
        borderWidth: 1,
        borderRadius: radii.card,
        padding: spacing.lg,
        gap: spacing.xs,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <View style={{ flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' }}>
        <SwapTypeBadge type={r.type} />
        <SwapStatusBadge status={r.status} />
      </View>
      <Text weight="bold" style={{ fontVariant: ['tabular-nums'] }}>
        {summary}
      </Text>
      {r.offered_shift ? (
        <Text size="sm">
          Em troca de{' '}
          <Text size="sm" weight="semibold">
            {formatShiftSummary(r.offered_shift.starts_at, r.offered_shift.ends_at)}
          </Text>
        </Text>
      ) : null}
      <Text muted size="sm">
        {profileName(profiles, r.requester_id)}
        {r.accepted_by ? ` → ${profileName(profiles, r.accepted_by)}` : ''} ·{' '}
        {formatDateTimeShort(r.created_at)}
      </Text>
      {r.note ? (
        <Text muted size="sm" numberOfLines={1}>
          “{r.note}”
        </Text>
      ) : null}
    </Pressable>
  );
}
