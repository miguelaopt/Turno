'use client';

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
import { AlertTriangle, ArrowLeft, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { SwapStatusBadge, SwapTypeBadge } from '@/components/status-badge';
import { useSession } from '@/hooks/use-session';
import {
  useStoreProfiles,
  useSwapMutations,
  useSwapRequest,
  useSwapRequestEvents,
  useSwapRequests,
  useUsersShifts,
} from '@/hooks/use-turno-data';
import { cn } from '@/lib/utils';

const DAY = 24 * 3600_000;

/** Intervalo que cobre as semanas dos turnos envolvidos, com um dia de margem. */
function rangeAround(dates: (string | undefined)[]): Interval | null {
  const times = dates.filter((d): d is string => !!d).map((d) => new Date(d).getTime());
  if (!times.length) return null;
  const start = lisbonWeek(Math.min(...times)).start.getTime() - DAY;
  const end = lisbonWeek(Math.max(...times)).end.getTime() + DAY;
  return { start: new Date(start), end: new Date(end) };
}

export function SwapDetail({ id }: { id: string }) {
  const { client, profile } = useSession();
  const request = useSwapRequest(client, id);

  if (request.isPending) return <p className="text-muted-foreground text-sm">A carregar…</p>;
  if (request.isError || !request.data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pedido não encontrado</CardTitle>
        </CardHeader>
        <p className="text-muted-foreground text-sm">
          {request.isError ? getErrorMessage(request.error) : 'Pode ter sido de outra loja.'}
        </p>
        <Button asChild variant="outline">
          <Link href="/pedidos">Voltar aos pedidos</Link>
        </Button>
      </Card>
    );
  }
  return <SwapDetailLoaded request={request.data} key={`${profile.id}-${id}`} />;
}

function SwapDetailLoaded({ request: r }: { request: SwapRequestWithShifts }) {
  const { client, profile } = useSession();
  const profiles = useStoreProfiles(client, profile.store_id);
  const events = useSwapRequestEvents(client, r.id);
  const allRequests = useSwapRequests(client, profile.store_id);
  const mutations = useSwapMutations(client, profile.id, profile.store_id);

  const [offeredId, setOfferedId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [justApproved, setJustApproved] = useState(false);

  const accepting = canAcceptSwap(r, profile);
  const deciding = canApproveSwap(r, profile) || canRejectSwap(r, profile);

  // Os meus turnos futuros, para escolher o que ofereço numa troca.
  const myFutureRange = useMemo<Interval>(
    () => ({ start: new Date(), end: new Date(Date.now() + 60 * DAY) }),
    [],
  );
  const myShifts = useUsersShifts(
    client,
    accepting && r.type === 'swap' ? [profile.id] : [],
    accepting && r.type === 'swap' ? myFutureRange : null,
  );
  const offerable = (myShifts.data ?? []).filter((s) =>
    canRequestSwap(s, profile, allRequests.data ?? []),
  );
  const chosenOffer = offerable.find((s) => s.id === offeredId) ?? null;
  const offered = useMemo(
    () => r.offered_shift ?? chosenOffer ?? null,
    [r.offered_shift, chosenOffer],
  );

  // Avisos: para quem aceita (eu, ou quem aceitou) e, numa troca, para quem pediu.
  const acceptorId = accepting ? profile.id : r.accepted_by;
  const showWarnings = (accepting || deciding) && !!acceptorId && !!r.shift;
  const range = useMemo(
    () => (showWarnings ? rangeAround([r.shift?.starts_at, offered?.starts_at]) : null),
    [showWarnings, r.shift?.starts_at, offered?.starts_at],
  );
  const people = showWarnings && acceptorId ? [r.requester_id, acceptorId] : [];
  const peopleShifts = useUsersShifts(client, people, range);

  const evaluation = useMemo(() => {
    if (!showWarnings || !acceptorId || !r.shift || !peopleShifts.data || !profiles.data) {
      return null;
    }
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
  const pending =
    mutations.transition.isPending || mutations.markMpi.isPending || mutations.create.isPending;

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
      setConfirmCancel(false);
      if (status === 'approved') setJustApproved(true);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function markMpi() {
    setError(null);
    try {
      await mutations.markMpi.mutateAsync(r.id);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  const acceptorWarnings = evaluation?.acceptor ?? [];
  const requesterWarnings = evaluation?.requester ?? [];

  return (
    <div className="flex flex-col gap-4">
      <Button asChild variant="ghost" className="self-start">
        <Link href="/pedidos">
          <ArrowLeft aria-hidden />
          Pedidos
        </Link>
      </Button>

      <Card>
        <div className="flex flex-wrap gap-1.5">
          <SwapTypeBadge type={r.type} />
          <SwapStatusBadge status={r.status} />
        </div>
        <div>
          <h1 className="text-xl font-bold tabular-nums">
            {r.shift ? formatShiftSummary(r.shift.starts_at, r.shift.ends_at) : 'Turno'}
          </h1>
          {r.shift ? (
            <p className="text-muted-foreground text-sm">
              {formatHours(hoursBetween(r.shift.starts_at, r.shift.ends_at))} ·{' '}
              {swapTypeDescription[r.type]}
            </p>
          ) : null}
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Pedido por</dt>
          <dd className="font-semibold">
            {name(r.requester_id)}{' '}
            <span className="text-muted-foreground font-normal">
              · {formatDateTimeShort(r.created_at)}
            </span>
          </dd>
          {r.note ? (
            <>
              <dt className="text-muted-foreground">Nota</dt>
              <dd>“{r.note}”</dd>
            </>
          ) : null}
          {r.accepted_by ? (
            <>
              <dt className="text-muted-foreground">Aceite por</dt>
              <dd className="font-semibold">{name(r.accepted_by)}</dd>
            </>
          ) : null}
          {r.offered_shift ? (
            <>
              <dt className="text-muted-foreground">Em troca de</dt>
              <dd className="font-semibold tabular-nums">
                {formatShiftSummary(r.offered_shift.starts_at, r.offered_shift.ends_at)}
              </dd>
            </>
          ) : null}
          {r.decided_by ? (
            <>
              <dt className="text-muted-foreground">Decidido por</dt>
              <dd className="font-semibold">{name(r.decided_by)}</dd>
            </>
          ) : null}
          {r.decision_note ? (
            <>
              <dt className="text-muted-foreground">
                {r.status === 'cancelled' ? 'Motivo' : 'Nota da gerência'}
              </dt>
              <dd>“{r.decision_note}”</dd>
            </>
          ) : null}
          {r.status === 'approved' ? (
            <>
              <dt className="text-muted-foreground">MPI</dt>
              <dd className={cn('font-semibold', !r.mpi_updated_at && 'text-urgent')}>
                {r.mpi_updated_at
                  ? `Atualizado por ${name(r.mpi_updated_by)} · ${formatDateTimeShort(r.mpi_updated_at)}`
                  : 'Por atualizar'}
              </dd>
            </>
          ) : null}
        </dl>
      </Card>

      {/* ------------------------------------------------------------ ações */}
      {accepting ? (
        <Card>
          <CardHeader>
            <CardTitle>Aceitar este pedido</CardTitle>
          </CardHeader>
          {r.type === 'swap' ? (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-semibold">Que turno teu dás em troca?</legend>
              {myShifts.isPending ? (
                <p className="text-muted-foreground text-sm">A carregar os teus turnos…</p>
              ) : offerable.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Não tens turnos futuros livres para oferecer. Regista-os em &quot;Turnos&quot;.
                </p>
              ) : (
                offerable.map((s) => (
                  <label
                    key={s.id}
                    className={cn(
                      'min-h-touch flex cursor-pointer items-center gap-3 rounded-lg border px-3',
                      offeredId === s.id && 'border-primary bg-secondary',
                    )}
                  >
                    <input
                      type="radio"
                      name="offered"
                      checked={offeredId === s.id}
                      onChange={() => setOfferedId(s.id)}
                      className="accent-primary size-4"
                    />
                    <span className="font-semibold tabular-nums">
                      {formatShiftSummary(s.starts_at, s.ends_at)}
                    </span>
                  </label>
                ))
              )}
            </fieldset>
          ) : null}
          <Warnings title="Avisos para ti" items={acceptorWarnings.map(formatShiftWarning)} />
          <Button
            size="lg"
            disabled={pending || (r.type === 'swap' && !offeredId)}
            onClick={() => void run('accepted')}
          >
            {mutations.transition.isPending ? 'A aceitar…' : 'Aceitar'}
          </Button>
          <p className="text-muted-foreground text-sm">
            Depois de aceitares, a gerência ainda tem de aprovar.
          </p>
        </Card>
      ) : null}

      {deciding ? (
        <Card>
          <CardHeader>
            <CardTitle>Decisão da gerência</CardTitle>
          </CardHeader>
          {r.status === 'open' ? (
            <p className="text-muted-foreground text-sm">
              Ainda ninguém aceitou. Podes recusar já, se este pedido não for possível.
            </p>
          ) : null}
          {r.accepted_by ? (
            <>
              <Warnings
                title={`Avisos para ${name(r.accepted_by)}`}
                items={acceptorWarnings.map(formatShiftWarning)}
                emptyText={
                  peopleShifts.isPending ? undefined : `Sem avisos para ${name(r.accepted_by)}.`
                }
              />
              {r.type === 'swap' ? (
                <Warnings
                  title={`Avisos para ${name(r.requester_id)}`}
                  items={requesterWarnings.map(formatShiftWarning)}
                  emptyText={
                    peopleShifts.isPending ? undefined : `Sem avisos para ${name(r.requester_id)}.`
                  }
                />
              ) : null}
            </>
          ) : null}
          <div className="flex flex-col gap-2">
            <Label htmlFor="decision-note">Nota para a equipa (opcional)</Label>
            <textarea
              id="decision-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={1000}
              className="bg-card focus-visible:border-ring focus-visible:ring-ring/50 rounded-lg border px-3 py-2 text-base outline-none focus-visible:ring-[3px]"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              disabled={pending || !canRejectSwap(r, profile)}
              onClick={() => void run('rejected')}
            >
              Recusar
            </Button>
            <Button
              disabled={pending || !canApproveSwap(r, profile)}
              onClick={() => void run('approved')}
            >
              Aprovar
            </Button>
          </div>
        </Card>
      ) : null}

      {canMarkMpiUpdated(r, profile) ? (
        <Alert variant={justApproved ? 'urgent' : 'default'}>
          <CheckCircle2 aria-hidden />
          <AlertTitle>Falta atualizar o MPI</AlertTitle>
          <AlertDescription>
            <p>Atualiza o horário no portal da empresa à mão e depois regista aqui.</p>
            <Button className="mt-2" disabled={pending} onClick={() => void markMpi()}>
              Já atualizei o MPI
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {canCancelSwap(r, profile) ? (
        confirmCancel ? (
          <Card className="gap-3">
            <p className="font-semibold">Cancelar este pedido?</p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => setConfirmCancel(false)}>
                Não
              </Button>
              <Button
                variant="destructive"
                disabled={pending}
                onClick={() => void run('cancelled')}
              >
                Sim, cancelar
              </Button>
            </div>
          </Card>
        ) : (
          <Button variant="outline" onClick={() => setConfirmCancel(true)}>
            Cancelar pedido
          </Button>
        )
      ) : null}

      {error ? (
        <p className="text-urgent text-sm" role="alert">
          {error}
        </p>
      ) : null}

      {/* -------------------------------------------------------- histórico */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico</CardTitle>
        </CardHeader>
        {events.isPending ? (
          <p className="text-muted-foreground text-sm">A carregar…</p>
        ) : (
          <ol className="flex flex-col gap-3 border-l-2 pl-4">
            {(events.data ?? []).map((e) => (
              <li key={e.id} className="relative">
                <span
                  aria-hidden
                  className="bg-primary absolute top-1.5 -left-[1.4rem] size-2.5 rounded-full"
                />
                <p className="text-sm">
                  <span className="font-semibold">{swapEventLabel[e.kind]}</span>
                  {e.actor_id ? ` por ${name(e.actor_id)}` : ''}
                </p>
                <p className="text-muted-foreground text-xs">{formatDateTimeShort(e.created_at)}</p>
                {e.note ? <p className="text-sm">“{e.note}”</p> : null}
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}

function Warnings({
  title,
  items,
  emptyText,
}: {
  title: string;
  items: string[];
  emptyText?: string | undefined;
}) {
  if (!items.length) {
    return emptyText ? <p className="text-muted-foreground text-sm">{emptyText}</p> : null;
  }
  return (
    <Alert variant="urgent">
      <AlertTriangle aria-hidden />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        <ul className="list-disc pl-4">
          {items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
        <p>São avisos, não bloqueios: a decisão é da gerência.</p>
      </AlertDescription>
    </Alert>
  );
}
