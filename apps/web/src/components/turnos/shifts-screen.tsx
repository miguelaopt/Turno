'use client';

import {
  buildWeekView,
  capitalizeFirst,
  formatDayLong,
  formatHours,
  formatShiftWarning,
  formatTimeRange,
  formatWeekRange,
  formatWeekdayShort,
  lisbonWeek,
  shiftLisbonWeek,
  startOfLisbonWeek,
  toLisbonDateKey,
  weekQueryRange,
  getErrorMessage,
  type MyProfile,
  type Shift,
  type TurnoClient,
} from '@turno/shared';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useMyShifts, useShiftMutations, useStoreRealtime } from '@/hooks/use-turno-data';
import { cn } from '@/lib/utils';
import { DeleteShiftDialog } from './delete-shift-dialog';
import { ShiftDialog, type ShiftDialogState } from './shift-dialog';

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
  const [dialog, setDialog] = useState<ShiftDialogState | null>(null);
  const [toDelete, setToDelete] = useState<Shift | null>(null);

  const range = useMemo(() => weekQueryRange(weekStart), [weekStart]);
  const shifts = useMyShifts(client, profile.id, range);
  const mutations = useShiftMutations(client, profile.id, profile.store_id);
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
  const storeName = profile.store?.name;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-4 px-4 py-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-primary text-sm font-bold tracking-wide uppercase">Turno</p>
          <h1 className="text-2xl font-bold">Os meus turnos</h1>
          <p className="text-muted-foreground text-sm">
            {profile.name}
            {storeName ? ` · ${storeName}` : ''}
          </p>
        </div>
        <Button variant="ghost" onClick={onSignOut}>
          <LogOut aria-hidden />
          Sair
        </Button>
      </header>

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
                  (+
                  {formatHours(view.excessHours)}).
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
                  {day.shifts.map((shift) => (
                    <li
                      key={shift.id}
                      className="bg-background flex items-center justify-between gap-2 rounded-lg px-3 py-1"
                    >
                      <div>
                        <p className="font-semibold tabular-nums">
                          {formatTimeRange(shift.starts_at, shift.ends_at)}
                          {toLisbonDateKey(shift.ends_at) !== day.dateKey ? (
                            <span className="text-muted-foreground ml-1 text-sm font-normal">
                              (acaba {formatWeekdayShort(shift.ends_at)})
                            </span>
                          ) : null}
                        </p>
                        <p className="text-muted-foreground text-sm">
                          {formatHours(shift.durationHours)}
                        </p>
                      </div>
                      <div className="flex">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Editar turno ${formatTimeRange(shift.starts_at, shift.ends_at)}`}
                          onClick={() => setDialog({ mode: 'edit', shift })}
                        >
                          <Pencil aria-hidden />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Apagar turno ${formatTimeRange(shift.starts_at, shift.ends_at)}`}
                          onClick={() => setToDelete(shift)}
                        >
                          <Trash2 aria-hidden />
                        </Button>
                      </div>
                    </li>
                  ))}
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
    </div>
  );
}
