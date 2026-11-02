import {
  swapStatusLabel,
  swapStatusTone,
  swapTypeLabel,
  type SwapStatus,
  type SwapType,
} from '@turno/shared';
import { cn } from '@/lib/utils';

const tones = {
  accent: 'bg-secondary text-secondary-foreground',
  urgent: 'bg-urgent-soft text-urgent',
  muted: 'bg-muted text-muted-foreground border',
} as const;

export function Badge({
  tone,
  children,
  className,
}: {
  tone: keyof typeof tones;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function SwapStatusBadge({ status }: { status: SwapStatus }) {
  return <Badge tone={swapStatusTone[status]}>{swapStatusLabel[status]}</Badge>;
}

export function SwapTypeBadge({ type }: { type: SwapType }) {
  return <Badge tone={type === 'cover' ? 'urgent' : 'accent'}>{swapTypeLabel[type]}</Badge>;
}
