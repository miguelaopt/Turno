'use client';

import {
  SWAP_TYPES,
  capitalizeFirst,
  formatDayLong,
  formatTimeRange,
  getErrorMessage,
  swapTypeDescription,
  swapTypeLabel,
  type Shift,
  type SwapType,
} from '@turno/shared';
import { useRouter } from 'next/navigation';
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
import { Label } from '@/components/ui/label';
import { useSession } from '@/hooks/use-session';
import { useSwapMutations } from '@/hooks/use-turno-data';
import { cn } from '@/lib/utils';

export function RequestSwapDialog({
  shift,
  onClose,
}: {
  shift: Shift | null;
  onClose: () => void;
}) {
  const { client, profile } = useSession();
  const router = useRouter();
  const { create } = useSwapMutations(client, profile.id, profile.store_id);
  const [type, setType] = useState<SwapType>('give');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shift) return;
    setType('give');
    setNote('');
    setError(null);
  }, [shift]);

  async function submit() {
    if (!shift) return;
    setError(null);
    try {
      const created = await create.mutateAsync({ shiftId: shift.id, type, note });
      onClose();
      router.push(`/pedidos/${created.id}`);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  return (
    <Dialog open={shift !== null} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pedir troca</DialogTitle>
          <DialogDescription>
            {shift
              ? `${capitalizeFirst(formatDayLong(shift.starts_at))}, ${formatTimeRange(shift.starts_at, shift.ends_at)}.`
              : null}{' '}
            Os colegas da loja são avisados.
          </DialogDescription>
        </DialogHeader>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold">O que precisas?</legend>
          {SWAP_TYPES.map((t) => (
            <label
              key={t}
              className={cn(
                'min-h-touch flex cursor-pointer items-start gap-3 rounded-lg border p-3',
                type === t && 'border-primary bg-secondary',
                type === t && t === 'cover' && 'border-urgent bg-urgent-soft',
              )}
            >
              <input
                type="radio"
                name="swap-type"
                value={t}
                checked={type === t}
                onChange={() => setType(t)}
                className="accent-primary mt-1 size-4"
              />
              <span>
                <span className="block font-semibold">{swapTypeLabel[t]}</span>
                <span className="text-muted-foreground text-sm">{swapTypeDescription[t]}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <div className="flex flex-col gap-2">
          <Label htmlFor="swap-note">Nota (opcional)</Label>
          <textarea
            id="swap-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="Ex.: consulta médica"
            className="bg-card focus-visible:border-ring focus-visible:ring-ring/50 rounded-lg border px-3 py-2 text-base outline-none focus-visible:ring-[3px]"
          />
        </div>

        {error ? (
          <p className="text-urgent text-sm" role="alert">
            {error}
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} disabled={create.isPending}>
            {create.isPending ? 'A publicar…' : 'Publicar pedido'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
