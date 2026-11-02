'use client';

import {
  evaluateShiftAssignment,
  fieldErrors,
  formatShiftWarning,
  getErrorMessage,
  shiftFormSchema,
  shiftFormToTimes,
  shiftToRange,
  toLisbonDateKey,
  toLisbonTimeString,
  type Shift,
  type ShiftFormValues,
} from '@turno/shared';
import { AlertTriangle } from 'lucide-react';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { useShiftMutations } from '@/hooks/use-turno-data';

export type ShiftDialogState = { mode: 'create'; date: string } | { mode: 'edit'; shift: Shift };

function initialValues(state: ShiftDialogState): ShiftFormValues {
  if (state.mode === 'create') return { date: state.date, startTime: '09:00', endTime: '17:00' };
  return {
    date: toLisbonDateKey(state.shift.starts_at),
    startTime: toLisbonTimeString(state.shift.starts_at),
    endTime: toLisbonTimeString(state.shift.ends_at),
  };
}

export function ShiftDialog({
  state,
  onClose,
  otherShifts,
  weeklyHours,
  mutations,
}: {
  state: ShiftDialogState | null;
  onClose: () => void;
  otherShifts: Shift[];
  weeklyHours: number;
  mutations: ReturnType<typeof useShiftMutations>;
}) {
  const [values, setValues] = useState<ShiftFormValues>({ date: '', startTime: '', endTime: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!state) return;
    setValues(initialValues(state));
    setErrors({});
    setSubmitError(null);
  }, [state]);

  const parsed = shiftFormSchema.safeParse(values);
  const editingId = state?.mode === 'edit' ? state.shift.id : undefined;

  // Avisos (não bloqueiam): horas semanais e descanso entre turnos.
  const warnings = parsed.success
    ? evaluateShiftAssignment({
        shifts: otherShifts.map(shiftToRange),
        candidate: { id: editingId, ...shiftFormToTimes(parsed.data) },
        weeklyHours,
      })
    : [];

  const pending = mutations.create.isPending || mutations.update.isPending;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setSubmitError(null);
    const times = shiftFormToTimes(parsed.data);
    try {
      if (state?.mode === 'edit') {
        await mutations.update.mutateAsync({ id: state.shift.id, ...times });
      } else {
        await mutations.create.mutateAsync(times);
      }
      onClose();
    } catch (error) {
      setSubmitError(getErrorMessage(error));
    }
  }

  const set = (key: keyof ShiftFormValues) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setValues((v) => ({ ...v, [key]: e.target.value }));
    setErrors((current) => {
      const { [key]: _removed, ...rest } = current;
      return rest;
    });
  };

  return (
    <Dialog open={state !== null} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{state?.mode === 'edit' ? 'Editar turno' : 'Novo turno'}</DialogTitle>
          <DialogDescription>
            Horas de Lisboa. Se a hora de fim for antes da de início, o turno acaba no dia seguinte.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <Field id="date" label="Dia" error={errors.date}>
            <Input
              id="date"
              type="date"
              required
              value={values.date}
              aria-invalid={errors.date ? true : undefined}
              aria-describedby={errors.date ? 'date-error' : undefined}
              onChange={set('date')}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id="startTime" label="Início" error={errors.startTime}>
              <Input
                id="startTime"
                type="time"
                step={300}
                required
                value={values.startTime}
                aria-invalid={errors.startTime ? true : undefined}
                aria-describedby={errors.startTime ? 'startTime-error' : undefined}
                onChange={set('startTime')}
              />
            </Field>
            <Field id="endTime" label="Fim" error={errors.endTime}>
              <Input
                id="endTime"
                type="time"
                step={300}
                required
                value={values.endTime}
                aria-invalid={errors.endTime ? true : undefined}
                aria-describedby={errors.endTime ? 'endTime-error' : undefined}
                onChange={set('endTime')}
              />
            </Field>
          </div>

          {warnings.length ? (
            <Alert variant="urgent">
              <AlertTriangle aria-hidden />
              <AlertDescription>
                <ul className="list-disc pl-4">
                  {warnings.map((w, i) => (
                    <li key={i}>{formatShiftWarning(w)}</li>
                  ))}
                </ul>
                <p>É só um aviso: podes guardar na mesma.</p>
              </AlertDescription>
            </Alert>
          ) : null}

          {submitError ? (
            <p className="text-urgent text-sm" role="alert">
              {submitError}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'A guardar…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string | undefined;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-urgent text-sm" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
