import {
  swapStatusLabel,
  swapStatusTone,
  swapTypeLabel,
  type SwapStatus,
  type SwapType,
} from '@turno/shared';
import { Badge } from './ui';

export function SwapStatusBadge({ status }: { status: SwapStatus }) {
  return <Badge tone={swapStatusTone[status]} label={swapStatusLabel[status]} />;
}

export function SwapTypeBadge({ type }: { type: SwapType }) {
  return <Badge tone={type === 'cover' ? 'urgent' : 'accent'} label={swapTypeLabel[type]} />;
}
