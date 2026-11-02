'use client';

import { formatDayLong, formatTimeRange, getErrorMessage, type Shift } from '@turno/shared';
import type { UseMutationResult } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function DeleteShiftDialog({
  shift,
  onClose,
  remove,
}: {
  shift: Shift | null;
  onClose: () => void;
  remove: UseMutationResult<void, Error, string>;
}) {
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setError(null), [shift]);

  async function confirm() {
    if (!shift) return;
    try {
      await remove.mutateAsync(shift.id);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  return (
    <Dialog open={shift !== null} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Apagar turno?</DialogTitle>
          <DialogDescription>
            {shift
              ? `${formatDayLong(shift.starts_at)}, ${formatTimeRange(shift.starts_at, shift.ends_at)}.`
              : null}{' '}
            Esta ação não se pode desfazer.
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <p className="text-urgent text-sm" role="alert">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={() => void confirm()} disabled={remove.isPending}>
            {remove.isPending ? 'A apagar…' : 'Apagar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
