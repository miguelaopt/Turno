'use client';

import {
  formatDateTimeShort,
  formatShiftSummary,
  profileName,
  type StoreProfile,
  type SwapRequestWithShifts,
} from '@turno/shared';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { SwapStatusBadge, SwapTypeBadge } from '@/components/status-badge';
import { cn } from '@/lib/utils';

export function SwapCard({
  request,
  profiles,
}: {
  request: SwapRequestWithShifts;
  profiles: StoreProfile[] | undefined;
}) {
  const r = request;
  return (
    <Link
      href={`/pedidos/${r.id}`}
      className={cn(
        'bg-card hover:border-primary focus-visible:ring-ring/50 flex items-center gap-3 rounded-card border p-4 outline-none focus-visible:ring-[3px]',
        r.type === 'cover' && r.status === 'open' && 'border-urgent/40',
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap gap-1.5">
          <SwapTypeBadge type={r.type} />
          <SwapStatusBadge status={r.status} />
        </div>
        <p className="font-bold tabular-nums">
          {r.shift ? formatShiftSummary(r.shift.starts_at, r.shift.ends_at) : 'Turno'}
        </p>
        {r.offered_shift ? (
          <p className="text-sm">
            Em troca de{' '}
            <span className="font-semibold">
              {formatShiftSummary(r.offered_shift.starts_at, r.offered_shift.ends_at)}
            </span>
          </p>
        ) : null}
        <p className="text-muted-foreground text-sm">
          {profileName(profiles, r.requester_id)}
          {r.accepted_by ? ` → ${profileName(profiles, r.accepted_by)}` : ''} ·{' '}
          {formatDateTimeShort(r.created_at)}
        </p>
        {r.note ? <p className="text-muted-foreground truncate text-sm">“{r.note}”</p> : null}
      </div>
      <ChevronRight aria-hidden className="text-muted-foreground size-5 shrink-0" />
    </Link>
  );
}
