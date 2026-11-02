import {
  capitalizeFirst,
  evaluateShiftAssignment,
  fieldErrors,
  formatShiftWarning,
  formatWeekRange,
  formatWeekdayShort,
  getErrorMessage,
  lisbonWeekDays,
  maskTimeInput,
  shiftFormSchema,
  shiftFormToTimes,
  shiftLisbonWeek,
  shiftToRange,
  startOfLisbonWeek,
  toLisbonDateKey,
  fromLisbonLocal,
  weekQueryRange,
  zonedParts,
  type MyProfile,
  type Session,
  type ShiftFormValues,
  type TurnoClient,
} from '@turno/shared';
import { colors, radii, spacing } from '@turno/shared/tokens';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LoadingScreen } from '@/components/screen-message';
import { Button, Text, TextField, WarningBox } from '@/components/ui';
import { useAuth } from '@/hooks/use-auth';
import { useMyProfile, useMyShifts, useShiftMutations } from '@/hooks/use-turno-data';

type Params = { id?: string; date?: string; startTime?: string; endTime?: string };

/** Modal para criar ou editar um turno. */
export default function ShiftFormScreen() {
  const auth = useAuth();
  if (auth.status === 'loading') return <LoadingScreen />;
  if (auth.status !== 'signed-in') return <Redirect href="/" />;
  return <WithProfile client={auth.client} session={auth.session} />;
}

function WithProfile({ client, session }: { client: TurnoClient; session: Session }) {
  const profile = useMyProfile(client, session.user.id);
  if (!profile.data) return <LoadingScreen />;
  return <ShiftForm client={client} profile={profile.data} />;
}

function ShiftForm({ client, profile }: { client: TurnoClient; profile: MyProfile }) {
  const params = useLocalSearchParams<Params>();
  const editingId = params.id;
  const [values, setValues] = useState<ShiftFormValues>(() => ({
    date: params.date ?? toLisbonDateKey(new Date()),
    startTime: params.startTime ?? '09:00',
    endTime: params.endTime ?? '17:00',
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | undefined>();

  // Semana mostrada no seletor de dia.
  const [pickerWeek, setPickerWeek] = useState(() =>
    startOfLisbonWeek(fromLisbonLocal(values.date, '12:00')),
  );
  const days = useMemo(() => lisbonWeekDays(pickerWeek), [pickerWeek]);

  // Turnos à volta do dia escolhido, para os avisos.
  const range = useMemo(() => weekQueryRange(fromLisbonLocal(values.date, '12:00')), [values.date]);
  const others = useMyShifts(client, profile.id, range);
  const mutations = useShiftMutations(client, profile.id, profile.store_id);

  const parsed = shiftFormSchema.safeParse(values);
  const warnings = parsed.success
    ? evaluateShiftAssignment({
        shifts: (others.data ?? []).map(shiftToRange),
        candidate: { id: editingId, ...shiftFormToTimes(parsed.data) },
        weeklyHours: profile.weekly_hours,
      })
    : [];
  const pending = mutations.create.isPending || mutations.update.isPending;

  const update = (key: keyof ShiftFormValues, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors(({ [key]: _removed, ...rest }) => rest);
  };

  async function save() {
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setSubmitError(undefined);
    const times = shiftFormToTimes(parsed.data);
    try {
      if (editingId) await mutations.update.mutateAsync({ id: editingId, ...times });
      else await mutations.create.mutateAsync(times);
      router.back();
    } catch (error) {
      setSubmitError(getErrorMessage(error));
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ gap: spacing.xs }}>
            <Text weight="bold" size="xl" accessibilityRole="header">
              {editingId ? 'Editar turno' : 'Novo turno'}
            </Text>
            <Text muted size="sm">
              Horas de Lisboa. Se a hora de fim for antes da de início, o turno acaba no dia
              seguinte.
            </Text>
          </View>

          <View style={{ gap: spacing.sm }}>
            <Text weight="semibold" size="sm">
              Dia
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Button
                variant="ghost"
                icon={<Text weight="bold">‹</Text>}
                accessibilityLabel="Semana anterior"
                onPress={() => setPickerWeek(shiftLisbonWeek(pickerWeek, -1).start)}
              />
              <Text size="sm" weight="semibold">
                {formatWeekRange(pickerWeek)}
              </Text>
              <Button
                variant="ghost"
                icon={<Text weight="bold">›</Text>}
                accessibilityLabel="Semana seguinte"
                onPress={() => setPickerWeek(shiftLisbonWeek(pickerWeek, 1).start)}
              />
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.xs }} accessibilityRole="radiogroup">
              {days.map((day) => {
                const key = toLisbonDateKey(day);
                const selected = key === values.date;
                return (
                  <Pressable
                    key={key}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={key}
                    onPress={() => update('date', key)}
                    style={{
                      flex: 1,
                      minHeight: 56,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: radii.control,
                      borderWidth: 1,
                      borderColor: selected ? colors.accent : colors.border,
                      backgroundColor: selected ? colors.accent : colors.surface,
                    }}
                  >
                    <Text
                      size="xs"
                      style={{ color: selected ? colors.accentForeground : colors.textMuted }}
                    >
                      {capitalizeFirst(formatWeekdayShort(day)).replace('.', '')}
                    </Text>
                    <Text
                      weight="bold"
                      style={{ color: selected ? colors.accentForeground : colors.text }}
                    >
                      {zonedParts(day).day}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {errors.date ? (
              <Text size="sm" style={{ color: colors.urgent }}>
                {errors.date}
              </Text>
            ) : null}
          </View>

          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <TextField
                label="Início"
                value={values.startTime}
                onChangeText={(t) => update('startTime', maskTimeInput(t))}
                placeholder="09:00"
                keyboardType="number-pad"
                maxLength={5}
                error={errors.startTime}
              />
            </View>
            <View style={{ flex: 1 }}>
              <TextField
                label="Fim"
                value={values.endTime}
                onChangeText={(t) => update('endTime', maskTimeInput(t))}
                placeholder="17:00"
                keyboardType="number-pad"
                maxLength={5}
                error={errors.endTime}
              />
            </View>
          </View>

          {warnings.length ? (
            <WarningBox
              title="Avisos (podes guardar na mesma)"
              items={warnings.map(formatShiftWarning)}
            />
          ) : null}

          {submitError ? (
            <Text size="sm" style={{ color: colors.urgent }} accessibilityRole="alert">
              {submitError}
            </Text>
          ) : null}

          <View style={{ gap: spacing.sm }}>
            <Button
              title={pending ? 'A guardar…' : 'Guardar'}
              loading={pending}
              onPress={() => void save()}
            />
            <Button title="Cancelar" variant="outline" onPress={() => router.back()} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
