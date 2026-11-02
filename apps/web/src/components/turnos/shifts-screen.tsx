'use client';

import {
  activeRequestForShift,
  buildWeekView,
  canRequestSwap,
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
  swapStatusLabel,
  toLisbonDateKey,
  weekQueryRange,
  type Shift,
} from '@turno/shared';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Repeat,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/status-badge';
import { useSession } from '@/hooks/use-session';
import { useMyShifts, useShiftMutations, useSwapRequests } from '@/hooks/use-turno-data';
import { cn } from '@/lib/utils';
import { RequestSwapDialog } from '@/components/pedidos/request-swap-dialog';
import { DeleteShiftDialog } from './delete-shift-dialog';
import { ShiftDialog, type ShiftDialogState } from './shift-dialog';

export function ShiftsScreen() {
  const { client, profile } = useSession();
  const [weekStart, setWeekStart] = useState(() => startOfLisbonWeek(new Date()));
  const [dialog, setDialog] = useState<ShiftDialogState | null>(null);
  const [toDelete, setToDelete] = useState<Shift | null>(null);
  const [toRequest, setToRequest] = useState<Shift | null>(null);

  const range = useMemo(() => weekQueryRange(weekStart), [weekStart]);
  const shifts = useMyShifts(client, profile.id, range);
  const swaps = useSwapRequests(client, profile.store_id);
  const mutations = useShiftMutations(client, profile.id, profile.store_id);

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
  const requests = swaps.data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Os meus turnos</h1>

      <Card className="gap-3">
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label="Semana anterior"
            onClick={() => setWeekStart(shiftLisbonWeek(weekStart, -1).start)}
          >
            <ChevronLeft aria-hidden />
          </Button>
          <div className="text-center">
            <p className="font-bold">{formatWeekRange(weekStart)}</p>
            {!isCurrentWeek ? (
              <Button
                variant="link"
                className="min-h-0 p-0 text-sm"
                onClick={() => setWeekStart(startOfLisbonWeek(new Date()))}
              >
                Voltar a esta semana
              </Button>
            ) : (
              <p className="text-muted-foreground text-sm">Esta semana</p>
            )}
          </div>
          <Button
            variant="outline"
            size="icon"
            aria-label="Semana seguinte"
            onClick={() => setWeekStart(shiftLisbonWeek(weekStart, 1).start)}
          >
            <ChevronRight aria-hidden />
          </Button>
        </div>
        <div className="flex items-baseline justify-between border-t pt-3">
          <span className="text-muted-foreground text-sm">Horas nesta semana</span>
          <span className={cn('font-bold', view.exceedsWeeklyHours && 'text-urgent')}>
            {formatHours(view.totalHours)}{' '}
            <span className="text-muted-foreground font-normal">
              de {formatHours(view.weeklyHours)}
            </span>
          </span>
        </div>
      </Card>

      {view.exceedsWeeklyHours || view.shortRests.length ? (
        <Alert variant="urgent">
          <AlertTriangle aria-hidden />
          <AlertTitle>Avisos</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              {view.exceedsWeeklyHours ? (
                <li>
                  {formatHours(view.totalHours)} para um limite de {formatHours(view.weeklyHours)}{' '}
                  (+{formatHours(view.excessHours)}).
                </li>
              ) : null}
              {view.shortRests.map((gap) => (
                <li key={`${String(gap.before.id)}-${String(gap.after.id)}`}>
                  {formatShiftWarning({ kind: 'short_rest', detail: gap })}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      {shifts.isError ? (
        <Alert variant="destructive">
          <AlertTriangle aria-hidden />
          <AlertTitle>Não foi possível carregar os turnos</AlertTitle>
          <AlertDescription>
            {getErrorMessage(shifts.error)}
            <Button variant="link" className="px-0" onClick={() => void shifts.refetch()}>
              Tentar outra vez
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <Button
        size="lg"
        onClick={() =>
          setDialog({
            mode: 'create',
            date: isCurrentWeek ? toLisbonDateKey(new Date()) : toLisbonDateKey(weekStart),
          })
        }
      >
        <Plus aria-hidden />
        Novo turno
      </Button>

      <ol className="flex flex-col gap-3" aria-busy={shifts.isPending}>
        {view.days.map((day) => (
          <li key={day.dateKey}>
            <Card className={cn('gap-2 p-4', day.isToday && 'border-primary')}>
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-bold">
                  {capitalizeFirst(formatDayLong(day.date))}
                  {day.isToday ? <span className="text-primary ml-2 text-sm">hoje</span> : null}
                </h2>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Adicionar turno em ${formatDayLong(day.date)}`}
                  onClick={() => setDialog({ mode: 'create', date: day.dateKey })}
                >
                  <Plus aria-hidden />
                </Button>
              </div>
              {day.shifts.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  {shifts.isPending ? 'A carregar…' : 'Sem turnos.'}
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {day.shifts.map((shift) => {
                    const active = activeRequestForShift(shift.id, requests);
                    const label = formatTimeRange(shift.starts_at, shift.ends_at);
                    return (
                      <li
                        key={shift.id}
                        className="bg-background flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-1"
                      >
                        <div className="py-1">
                          <p className="font-semibold tabular-nums">
                            {label}
                            {toLisbonDateKey(shift.ends_at) !== day.dateKey ? (
                              <span className="text-muted-foreground ml-1 text-sm font-normal">
                                (acaba {formatWeekdayShort(shift.ends_at)})
                              </span>
                            ) : null}
                          </p>
                          <p className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
                            {formatHours(shift.durationHours)}
                            {active ? (
                              <Link
                                href={`/pedidos/${active.id}`}
                                className="underline-offset-2 hover:underline"
                              >
                                <Badge tone={active.status === 'accepted' ? 'urgent' : 'accent'}>
                                  {active.shift?.id === shift.id
                                    ? `Pedido: ${swapStatusLabel[active.status].toLowerCase()}`
                                    : 'Oferecido numa troca'}
                                </Badge>
                              </Link>
                            ) : null}
                          </p>
                        </div>
                        <div className="flex">
                          {canRequestSwap(shift, profile, requests) ? (
                            <Button
                              variant="ghost"
                              onClick={() => setToRequest(shift)}
                              aria-label={`Pedir troca do turno ${label}`}
                            >
                              <Repeat aria-hidden />
                              <span className="hidden sm:inline">Pedir troca</span>
                            </Button>
                          ) : null}
                          {!active ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Editar turno ${label}`}
                              onClick={() => setDialog({ mode: 'edit', shift })}
                            >
                              <Pencil aria-hidden />
                            </Button>
                          ) : null}
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Apagar turno ${label}`}
                            onClick={() => setToDelete(shift)}
                          >
                            <Trash2 aria-hidden />
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </li>
        ))}
      </ol>

      <ShiftDialog
        state={dialog}
        onClose={() => setDialog(null)}
        otherShifts={shifts.data ?? []}
        weeklyHours={profile.weekly_hours}
        mutations={mutations}
      />
      <DeleteShiftDialog
        shift={toDelete}
        onClose={() => setToDelete(null)}
        remove={mutations.remove}
      />
      <RequestSwapDialog shift={toRequest} onClose={() => setToRequest(null)} />
    </div>
  );
}
