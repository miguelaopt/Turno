import {
  SWAP_TYPES,
  formatShiftSummary,
  getErrorMessage,
  swapTypeDescription,
  swapTypeLabel,
  type SwapType,
} from '@turno/shared';
import { colors, radii, spacing } from '@turno/shared/tokens';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, ChoiceRow, Text, styles } from '@/components/ui';
import { useSession } from '@/hooks/use-session';
import { useSwapMutations } from '@/hooks/use-turno-data';

type Params = { shiftId: string; startsAt?: string; endsAt?: string };

export default function RequestSwapScreen() {
  const { client, profile } = useSession();
  const { shiftId, startsAt, endsAt } = useLocalSearchParams<Params>();
  const { create } = useSwapMutations(client, profile.id, profile.store_id);
  const [type, setType] = useState<SwapType>('give');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | undefined>();

  async function submit() {
    setError(undefined);
    try {
      const created = await create.mutateAsync({ shiftId, type, note });
      router.replace(`/pedidos/${created.id}`);
    } catch (err) {
      setError(getErrorMessage(err));
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
              Pedir troca
            </Text>
            {startsAt && endsAt ? (
              <Text weight="semibold">{formatShiftSummary(startsAt, endsAt)}</Text>
            ) : null}
            <Text muted size="sm">
              Os colegas da loja são avisados.
            </Text>
          </View>

          <View style={{ gap: spacing.sm }} accessibilityRole="radiogroup">
            <Text weight="semibold" size="sm">
              O que precisas?
            </Text>
            {SWAP_TYPES.map((t) => (
              <ChoiceRow
                key={t}
                selected={type === t}
                title={swapTypeLabel[t]}
                description={swapTypeDescription[t]}
                tone={t === 'cover' ? 'urgent' : 'accent'}
                onPress={() => setType(t)}
              />
            ))}
          </View>

          <View style={{ gap: spacing.sm }}>
            <Text weight="semibold" size="sm">
              Nota (opcional)
            </Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Ex.: consulta médica"
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={1000}
              accessibilityLabel="Nota (opcional)"
              style={[
                styles.input,
                {
                  minHeight: 88,
                  paddingTop: spacing.md,
                  textAlignVertical: 'top',
                  borderRadius: radii.control,
                },
              ]}
            />
          </View>

          {error ? (
            <Text size="sm" style={{ color: colors.urgent }} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}

          <View style={{ gap: spacing.sm }}>
            <Button
              title={create.isPending ? 'A publicar…' : 'Publicar pedido'}
              loading={create.isPending}
              onPress={() => void submit()}
            />
            <Button title="Cancelar" variant="outline" onPress={() => router.back()} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
