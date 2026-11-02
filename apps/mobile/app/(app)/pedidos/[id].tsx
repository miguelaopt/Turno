import {
  canAcceptSwap,
  canApproveSwap,
  canCancelSwap,
  canMarkMpiUpdated,
  canRejectSwap,
  canRequestSwap,
  evaluateSwapRequest,
  formatDateTimeShort,
  formatHours,
  formatShiftSummary,
  formatShiftWarning,
  getErrorMessage,
  hoursBetween,
  lisbonWeek,
  profileName,
  shiftToRange,
  swapEventLabel,
  swapTypeDescription,
  type Enums,
  type Interval,
  type SwapRequestWithShifts,
} from '@turno/shared';
import { colors, radii, spacing } from '@turno/shared/tokens';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { LoadingScreen, ScreenMessage } from '@/components/screen-message';
import { SwapStatusBadge, SwapTypeBadge } from '@/components/swap-badges';
import { Button, Card, ChoiceRow, Text, WarningBox, styles } from '@/components/ui';
import { useSession } from '@/hooks/use-session';
import {
  useStoreProfiles,
  useSwapMutations,
  useSwapRequest,
  useSwapRequestEvents,
  useSwapRequests,
  useUsersShifts,
} from '@/hooks/use-turno-data';

const DAY = 24 * 3600_000;

function rangeAround(dates: (string | undefined)[]): Interval | null {
  const times = dates.filter((d): d is string => !!d).map((d) => new Date(d).getTime());
  if (!times.length) return null;
  const start = lisbonWeek(Math.min(...times)).start.getTime() - DAY;
  const end = lisbonWeek(Math.max(...times)).end.getTime() + DAY;
  return { start: new Date(start), end: new Date(end) };
}

export default function SwapDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { client } = useSession();
  const request = useSwapRequest(client, id);

  if (request.isPending) return <LoadingScreen />;
  if (request.isError || !request.data) {
    return (
      <ScreenMessage
        title="Pedido não encontrado"
        description={
          request.isError ? getErrorMessage(request.error) : 'Pode ter sido de outra loja.'
        }
      >
        <Button title="Voltar" variant="outline" onPress={() => router.back()} />
      </ScreenMessage>
    );
  }
  return (
    <Detail
      request={request.data}
      refetch={() => void request.refetch()}
      refreshing={request.isRefetching}
    />
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: spacing.md }}>
      <Text muted size="sm" style={{ width: 104 }}>
        {label}
      </Text>
      <Text size="sm" weight="semibold" style={{ flex: 1 }}>
        {value}
      </Text>
    </View>
  );
}

function Detail({
  request: r,
  refetch,
  refreshing,
}: {
  request: SwapRequestWithShifts;
  refetch: () => void;
  refreshing: boolean;
}) {
  const { client, profile } = useSession();
  const profiles = useStoreProfiles(client, profile.store_id);
  const events = useSwapRequestEvents(client, r.id);
  const allRequests = useSwapRequests(client, profile.store_id);
  const mutations = useSwapMutations(client, profile.id, profile.store_id);

  const [offeredId, setOfferedId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const accepting = canAcceptSwap(r, profile);
  const deciding = canApproveSwap(r, profile) || canRejectSwap(r, profile);

  const myFutureRange = useMemo<Interval>(
    () => ({ start: new Date(), end: new Date(Date.now() + 60 * DAY) }),
    [],
  );
  const choosingOffer = accepting && r.type === 'swap';
  const myShifts = useUsersShifts(
    client,
    choosingOffer ? [profile.id] : [],
    choosingOffer ? myFutureRange : null,
  );
  const offerable = (myShifts.data ?? []).filter((s) =>
    canRequestSwap(s, profile, allRequests.data ?? []),
  );
  const chosenOffer = offerable.find((s) => s.id === offeredId) ?? null;
  const offered = useMemo(
    () => r.offered_shift ?? chosenOffer ?? null,
    [r.offered_shift, chosenOffer],
  );

  const acceptorId = accepting ? profile.id : r.accepted_by;
  const showWarnings = (accepting || deciding) && !!acceptorId && !!r.shift;
  const range = useMemo(
    () => (showWarnings ? rangeAround([r.shift?.starts_at, offered?.starts_at]) : null),
    [showWarnings, r.shift?.starts_at, offered?.starts_at],
  );
  const peopleShifts = useUsersShifts(
    client,
    showWarnings && acceptorId ? [r.requester_id, acceptorId] : [],
    range,
  );

  const evaluation = useMemo(() => {
    if (!showWarnings || !acceptorId || !r.shift || !peopleShifts.data || !profiles.data)
      return null;
    const weekly = (uid: string) => profiles.data.find((p) => p.id === uid)?.weekly_hours ?? 40;
    const of = (uid: string) =>
      peopleShifts.data.filter((s) => s.user_id === uid).map(shiftToRange);
    return evaluateSwapRequest({
      type: r.type,
      shift: shiftToRange(r.shift),
      offeredShift: offered ? shiftToRange(offered) : null,
      acceptorShifts: of(acceptorId),
      acceptorWeeklyHours: weekly(acceptorId),
      requesterShifts: of(r.requester_id),
      requesterWeeklyHours: weekly(r.requester_id),
    });
  }, [showWarnings, acceptorId, r, offered, peopleShifts.data, profiles.data]);

  const name = (uid: string | null) => profileName(profiles.data, uid);
  const pending = mutations.transition.isPending || mutations.markMpi.isPending;

  async function run(status: Enums<'swap_status'>) {
    setError(null);
    try {
      await mutations.transition.mutateAsync({
        requestId: r.id,
        status,
        offeredShiftId: status === 'accepted' ? offeredId : null,
        note: status === 'approved' || status === 'rejected' ? note : null,
      });
      setNote('');
      if (status === 'approved') {
        Alert.alert('Pedido aprovado', 'Não te esqueças de atualizar o MPI e de o registar aqui.');
      }
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  const confirmCancel = () =>
    Alert.alert('Cancelar este pedido?', 'Os colegas deixam de o ver como aberto.', [
      { text: 'Não', style: 'cancel' },
      { text: 'Sim, cancelar', style: 'destructive', onPress: () => void run('cancelled') },
    ]);

  async function markMpi() {
    setError(null);
    try {
      await mutations.markMpi.mutateAsync(r.id);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  const acceptorWarnings = (evaluation?.acceptor ?? []).map(formatShiftWarning);
  const requesterWarnings = (evaluation?.requester ?? []).map(formatShiftWarning);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refetch} tintColor={colors.accent} />
        }
      >
        <Card>
          <View style={{ flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' }}>
            <SwapTypeBadge type={r.type} />
            <SwapStatusBadge status={r.status} />
          </View>
          <View style={{ gap: 2 }}>
            <Text
              weight="bold"
              size="xl"
              accessibilityRole="header"
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {r.shift ? formatShiftSummary(r.shift.starts_at, r.shift.ends_at) : 'Turno'}
            </Text>
            {r.shift ? (
              <Text muted size="sm">
                {formatHours(hoursBetween(r.shift.starts_at, r.shift.ends_at))} ·{' '}
                {swapTypeDescription[r.type]}
              </Text>
            ) : null}
          </View>
          <View style={{ gap: spacing.sm }}>
            <Row
              label="Pedido por"
              value={`${name(r.requester_id)} · ${formatDateTimeShort(r.created_at)}`}
            />
            {r.note ? <Row label="Nota" value={`“${r.note}”`} /> : null}
            {r.accepted_by ? <Row label="Aceite por" value={name(r.accepted_by)} /> : null}
            {r.offered_shift ? (
              <Row
                label="Em troca de"
                value={formatShiftSummary(r.offered_shift.starts_at, r.offered_shift.ends_at)}
              />
            ) : null}
            {r.decided_by ? <Row label="Decidido por" value={name(r.decided_by)} /> : null}
            {r.decision_note ? (
              <Row
                label={r.status === 'cancelled' ? 'Motivo' : 'Nota da gerência'}
                value={`“${r.decision_note}”`}
              />
            ) : null}
            {r.status === 'approved' ? (
              <Row
                label="MPI"
                value={
                  r.mpi_updated_at
                    ? `Atualizado por ${name(r.mpi_updated_by)} · ${formatDateTimeShort(r.mpi_updated_at)}`
                    : 'Por atualizar'
                }
              />
            ) : null}
          </View>
        </Card>

        {accepting ? (
          <Card>
            <Text weight="bold" size="lg">
              Aceitar este pedido
            </Text>
            {choosingOffer ? (
              <View style={{ gap: spacing.sm }} accessibilityRole="radiogroup">
                <Text weight="semibold" size="sm">
                  Que turno teu dás em troca?
                </Text>
                {myShifts.isPending ? (
                  <Text muted size="sm">
                    A carregar os teus turnos…
                  </Text>
                ) : offerable.length === 0 ? (
                  <Text muted size="sm">
                    Não tens turnos futuros livres para oferecer. Regista-os em &quot;Turnos&quot;.
                  </Text>
                ) : (
                  offerable.map((s) => (
                    <ChoiceRow
                      key={s.id}
                      selected={offeredId === s.id}
                      title={formatShiftSummary(s.starts_at, s.ends_at)}
                      onPress={() => setOfferedId(s.id)}
                    />
                  ))
                )}
              </View>
            ) : null}
            <WarningBox title="Avisos para ti" items={acceptorWarnings} />
            <Button
              title={mutations.transition.isPending ? 'A aceitar…' : 'Aceitar'}
              loading={mutations.transition.isPending}
              disabled={pending || (choosingOffer && !offeredId)}
              onPress={() => void run('accepted')}
            />
            <Text muted size="sm">
              Depois de aceitares, a gerência ainda tem de aprovar.
            </Text>
          </Card>
        ) : null}

        {deciding ? (
          <Card>
            <Text weight="bold" size="lg">
              Decisão da gerência
            </Text>
            {r.status === 'open' ? (
              <Text muted size="sm">
                Ainda ninguém aceitou. Podes recusar já, se este pedido não for possível.
              </Text>
            ) : null}
            {r.accepted_by ? (
              <>
                {acceptorWarnings.length ? (
                  <WarningBox
                    title={`Avisos para ${name(r.accepted_by)}`}
                    items={acceptorWarnings}
                  />
                ) : peopleShifts.isPending ? null : (
                  <Text muted size="sm">{`Sem avisos para ${name(r.accepted_by)}.`}</Text>
                )}
                {r.type === 'swap' ? (
                  requesterWarnings.length ? (
                    <WarningBox
                      title={`Avisos para ${name(r.requester_id)}`}
                      items={requesterWarnings}
                    />
                  ) : peopleShifts.isPending ? null : (
                    <Text muted size="sm">{`Sem avisos para ${name(r.requester_id)}.`}</Text>
                  )
                ) : null}
                {acceptorWarnings.length || requesterWarnings.length ? (
                  <Text muted size="sm">
                    São avisos, não bloqueios: a decisão é tua.
                  </Text>
                ) : null}
              </>
            ) : null}
            <View style={{ gap: spacing.sm }}>
              <Text weight="semibold" size="sm">
                Nota para a equipa (opcional)
              </Text>
              <TextInput
                value={note}
                onChangeText={setNote}
                multiline
                maxLength={1000}
                accessibilityLabel="Nota para a equipa (opcional)"
                style={[
                  styles.input,
                  {
                    minHeight: 72,
                    paddingTop: spacing.md,
                    textAlignVertical: 'top',
                    borderRadius: radii.control,
                  },
                ]}
              />
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Button
                title="Recusar"
                variant="outline"
                style={{ flex: 1 }}
                disabled={pending || !canRejectSwap(r, profile)}
                onPress={() => void run('rejected')}
              />
              <Button
                title="Aprovar"
                style={{ flex: 1 }}
                disabled={pending || !canApproveSwap(r, profile)}
                onPress={() => void run('approved')}
              />
            </View>
          </Card>
        ) : null}

        {canMarkMpiUpdated(r, profile) ? (
          <Card style={{ borderColor: colors.urgent }}>
            <Text weight="bold">Falta atualizar o MPI</Text>
            <Text muted size="sm">
              Atualiza o horário no portal da empresa à mão e depois regista aqui.
            </Text>
            <Button
              title="Já atualizei o MPI"
              loading={mutations.markMpi.isPending}
              onPress={() => void markMpi()}
            />
          </Card>
        ) : null}

        {canCancelSwap(r, profile) ? (
          <Button
            title="Cancelar pedido"
            variant="outline"
            disabled={pending}
            onPress={confirmCancel}
          />
        ) : null}

        {error ? (
          <Text size="sm" style={{ color: colors.urgent }} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}

        <Card>
          <Text weight="bold" size="lg">
            Histórico
          </Text>
          {events.isPending ? (
            <Text muted size="sm">
              A carregar…
            </Text>
          ) : (
            <View
              style={{
                borderLeftWidth: 2,
                borderLeftColor: colors.border,
                paddingLeft: spacing.lg,
                gap: spacing.md,
              }}
            >
              {(events.data ?? []).map((e) => (
                <View key={e.id} style={{ gap: 2 }}>
                  <View
                    style={{
                      position: 'absolute',
                      left: -spacing.lg - 6,
                      top: 6,
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      backgroundColor: colors.accent,
                    }}
                  />
                  <Text size="sm">
                    <Text size="sm" weight="semibold">
                      {swapEventLabel[e.kind]}
                    </Text>
                    {e.actor_id ? ` por ${name(e.actor_id)}` : ''}
                  </Text>
                  <Text muted size="xs">
                    {formatDateTimeShort(e.created_at)}
                  </Text>
                  {e.note ? <Text size="sm">“{e.note}”</Text> : null}
                </View>
              ))}
            </View>
          )}
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
