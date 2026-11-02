import type { Enums } from '../types/database';

export type SwapType = Enums<'swap_type'>;
export type SwapStatus = Enums<'swap_status'>;
export type SwapEventKind = Enums<'swap_event_kind'>;

export const SWAP_TYPES: readonly SwapType[] = ['swap', 'give', 'cover'];

export const swapTypeLabel: Record<SwapType, string> = {
  swap: 'Trocar turno',
  give: 'Dar turno',
  cover: 'Cobrir falta',
};

export const swapTypeDescription: Record<SwapType, string> = {
  swap: 'Trocas este turno por um turno de quem aceitar.',
  give: 'Dás este turno a quem o quiser fazer.',
  cover: 'Não podes ir e precisas que alguém te cubra. Fica marcado como urgente.',
};

export const swapStatusLabel: Record<SwapStatus, string> = {
  open: 'Aberto',
  accepted: 'À espera da gerência',
  approved: 'Aprovado',
  rejected: 'Recusado',
  cancelled: 'Cancelado',
};

export const swapEventLabel: Record<SwapEventKind, string> = {
  created: 'Pedido criado',
  accepted: 'Aceite',
  approved: 'Aprovado',
  rejected: 'Recusado',
  cancelled: 'Cancelado',
  mpi_updated: 'MPI atualizado',
};

/** Tom visual do estado, para badges: as duas UIs mapeiam isto para cores dos tokens. */
export const swapStatusTone: Record<SwapStatus, 'accent' | 'urgent' | 'muted'> = {
  open: 'accent',
  accepted: 'urgent',
  approved: 'accent',
  rejected: 'muted',
  cancelled: 'muted',
};
