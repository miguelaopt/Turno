import {
  buildWeekView,
  capitalizeFirst,
  formatDayLong,
  formatHours,
  formatShiftWarning,
  formatTimeRange,
  formatWeekRange,
  formatWeekdayShort,
  getErrorMessage,
  lisbonWeek,
  shiftLisbonWeek,
  startOfLisbonWeek,
  toLisbonDateKey,
  toLisbonTimeString,
  weekQueryRange,
  type MyProfile,
  type Shift,
  type TurnoClient,
} from '@turno/shared';
import { colors, radii, spacing } from '@turno/shared/tokens';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMyShifts, useShiftMutations, useStoreRealtime } from '@/hooks/use-turno-data';
import { Button, Card, Text, WarningBox } from './ui';

export function ShiftsScreen({
  client,
  profile,
  onSignOut,
}: {
  client: TurnoClient;
  profile: MyProfile;
  onSignOut: () => void;
}) {
  const [weekStart, setWeekStart] = useState(() => startOfLisbonWeek(new Date()));
  const range = useMemo(() => weekQueryRange(weekStart), [weekStart]);
  const shifts = useMyShifts(client, profile.id, range);
  const { remove } = useShiftMutations(client, profile.id, profile.store_id);
  useStoreRealtime(client, profile.store_id);

  const view = useMemo(
    () =>
      buildWeekView({
        shifts: shifts.data ?? [],
        weekOf: weekStart,
        weeklyHours: profile.weekly_hours,
      }),
    [shifts.data, weekStart, profile.weekly_hours],
  );
  const isCurrentWeek = lisbonWeek(new Date()).start.getTime() === weekStart.getTime();

  const warnings = [
    ...(view.exceedsWeeklyHours
      ? [
          `${formatHours(view.totalHours)} para um limite de ${formatHours(view.weeklyHours)} (+${formatHours(view.excessHours)}).`,
        ]
      : []),
    ...view.shortRests.map((gap) => formatShiftWarning({ kind: 'short_rest', detail: gap })),
  ];

  const openCreate = (date: string) => router.push({ pathname: '/turno', params: { date } });
  const openEdit = (shift: Shift) =>
    router.push({
      pathname: '/turno',
      params: {
        id: shift.id,
        date: toLisbonDateKey(shift.starts_at),
        startTime: toLisbonTimeString(shift.starts_at),
        endTime: toLisbonTimeString(shift.ends_at),
      },
    });

  const confirmDelete = (shift: Shift) => {
    Alert.alert(
      'Apagar turno?',
      `${capitalizeFirst(formatDayLong(shift.starts_at))}, ${formatTimeRange(shift.starts_at, shift.ends_at)}. Esta ação não se pode desfazer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Apagar',
          style: 'destructive',
          onPress: () =>
            remove.mutate(shift.id, {
              onError: (error) => Alert.alert('Não foi possível apagar', getErrorMessage(error)),
            }),
        },
      ],
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl }}
        refreshControl={
          <RefreshControl
            refreshing={shifts.isRefetching}
            onRefresh={() => void shifts.refetch()}
            tintColor={colors.accent}
          />
        }
      >
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <Text weight="bold" size="sm" style={{ color: colors.accent, letterSpacing: 1 }}>
              TURNO
            </Text>
            <Text weight="bold" size="xxl" accessibilityRole="header">
              Os meus turnos
            </Text>
            <Text muted size="sm">
              {profile.name}
              {profile.store?.name ? ` · ${profile.store.name}` : ''}
            </Text>
          </View>
          <Button title="Sair" variant="ghost" onPress={onSignOut} />
        </View>

        <Card style={{ gap: spacing.sm }}>
          <View
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Button
              variant="outline"
              icon={<Text weight="bold">‹</Text>}
              accessibilityLabel="Semana anterior"
              onPress={() => setWeekStart(shiftLisbonWeek(weekStart, -1).start)}
            />
            <View style={{ alignItems: 'center', flex: 1 }}>
              <Text weight="bold" style={{ textAlign: 'center' }}>
                {formatWeekRange(weekStart)}
              </Text>
              {isCurrentWeek ? (
                <Text muted size="sm">
                  Esta semana
                </Text>
              ) : (
                <Button
                  title="Voltar a esta semana"
                  variant="ghost"
                  onPress={() => setWeekStart(startOfLisbonWeek(new Date()))}
                />
              )}
            </View>
            <Button
              variant="outline"
              icon={<Text weight="bold">›</Text>}
              accessibilityLabel="Semana seguinte"
              onPress={() => setWeekStart(shiftLisbonWeek(weekStart, 1).start)}
            />
          </View>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              borderTopWidth: 1,
              borderTopColor: colors.border,
              paddingTop: spacing.sm,
            }}
          >
            <Text muted size="sm">
              Horas nesta semana
            </Text>
            <Text
              weight="bold"
              style={view.exceedsWeeklyHours ? { color: colors.urgent } : undefined}
            >
              {formatHours(view.totalHours)} <Text muted>de {formatHours(view.weeklyHours)}</Text>
            </Text>
          </View>
        </Card>

        <WarningBox title="Avisos" items={warnings} />

        {shifts.isError ? (
          <WarningBox
            title="Não foi possível carregar os turnos"
            items={[getErrorMessage(shifts.error)]}
          />
        ) : null}

        <Button
          title="Novo turno"
          onPress={() =>
            openCreate(isCurrentWeek ? toLisbonDateKey(new Date()) : toLisbonDateKey(weekStart))
          }
        />

        {view.days.map((day) => (
          <Card
            key={day.dateKey}
            style={[{ gap: spacing.sm }, day.isToday && { borderColor: colors.accent }]}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Text weight="bold" accessibilityRole="header" style={{ flex: 1 }}>
                {capitalizeFirst(formatDayLong(day.date))}
                {day.isToday ? (
                  <Text weight="semibold" size="sm" style={{ color: colors.accent }}>
                    {' '}
                    hoje
                  </Text>
                ) : null}
              </Text>
              <Button
                variant="ghost"
                icon={
                  <Text weight="bold" size="xl" style={{ color: colors.accent }}>
                    +
                  </Text>
                }
                accessibilityLabel={`Adicionar turno em ${formatDayLong(day.date)}`}
                onPress={() => openCreate(day.dateKey)}
              />
            </View>
            {day.shifts.length === 0 ? (
              <Text muted size="sm">
                {shifts.isPending ? 'A carregar…' : 'Sem turnos.'}
              </Text>
            ) : (
              day.shifts.map((shift) => (
                <View
                  key={shift.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: colors.background,
                    borderRadius: radii.control,
                    paddingLeft: spacing.md,
                  }}
                >
                  <View style={{ paddingVertical: spacing.sm }}>
                    <Text weight="semibold" style={{ fontVariant: ['tabular-nums'] }}>
                      {formatTimeRange(shift.starts_at, shift.ends_at)}
                      {toLisbonDateKey(shift.ends_at) !== day.dateKey ? (
                        <Text muted size="sm">
                          {' '}
                          (acaba {formatWeekdayShort(shift.ends_at)})
                        </Text>
                      ) : null}
                    </Text>
                    <Text muted size="sm">
                      {formatHours(shift.durationHours)}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row' }}>
                    <Button
                      title="Editar"
                      variant="ghost"
                      accessibilityLabel={`Editar turno ${formatTimeRange(shift.starts_at, shift.ends_at)}`}
                      onPress={() => openEdit(shift)}
                    />
                    <Button
                      title="Apagar"
                      variant="ghost"
                      accessibilityLabel={`Apagar turno ${formatTimeRange(shift.starts_at, shift.ends_at)}`}
                      onPress={() => confirmDelete(shift)}
                    />
                  </View>
                </View>
              ))
            )}
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
