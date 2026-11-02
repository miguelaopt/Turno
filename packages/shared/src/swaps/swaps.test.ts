import { describe, expect, it } from 'vitest';
import { fromLisbonLocal } from '../time';
import { formatShiftWarning } from '../rules/warnings';
import {
  actionableSwapCount,
  activeRequestForShift,
  canAcceptSwap,
  canApproveSwap,
  canCancelSwap,
  canMarkMpiUpdated,
  canRejectSwap,
  canRequestSwap,
  evaluateSwapRequest,
  groupSwapRequests,
  swapStatusLabel,
  swapTypeLabel,
  type SwapActor,
  type SwapRequestLike,
} from './index';

const NOW = '2026-11-02T12:00:00Z';
const ana: SwapActor = { id: 'ana', role: 'worker' };
const bruno: SwapActor = { id: 'bruno', role: 'worker' };
const helena: SwapActor = { id: 'helena', role: 'manager' };

const shift = (id: string, user_id: string, starts: string, ends: string) => ({
  id,
  user_id,
  starts_at: new Date(starts).toISOString(),
  ends_at: new Date(ends).toISOString(),
});

const req = (over: Partial<SwapRequestLike> & { id: string }): SwapRequestLike => ({
  requester_id: 'ana',
  accepted_by: null,
  status: 'open',
  type: 'give',
  mpi_updated_at: null,
  shift: shift(`s-${over.id}`, 'ana', '2026-11-05T09:00:00Z', '2026-11-05T17:00:00Z'),
  offered_shift: null,
  created_at: '2026-11-01T10:00:00Z',
  ...over,
});

describe('textos pt-PT', () => {
  it('tem rótulos para tipos e estados', () => {
    expect(swapTypeLabel.cover).toBe('Cobrir falta');
    expect(swapStatusLabel.accepted).toBe('À espera da gerência');
  });
});

describe('permissões (espelho da RPC)', () => {
  it('aceitar: worker, não é quem pediu, pedido aberto, turno futuro', () => {
    const r = req({ id: '1' });
    expect(canAcceptSwap(r, bruno, NOW)).toBe(true);
    expect(canAcceptSwap(r, ana, NOW)).toBe(false);
    expect(canAcceptSwap(r, helena, NOW)).toBe(false);
    expect(canAcceptSwap({ ...r, status: 'accepted' }, bruno, NOW)).toBe(false);
    expect(canAcceptSwap(r, bruno, '2026-11-05T10:00:00Z')).toBe(false);
  });

  it('cancelar: só quem pediu, enquanto está em curso', () => {
    expect(canCancelSwap(req({ id: '1' }), ana)).toBe(true);
    expect(canCancelSwap(req({ id: '1', status: 'accepted' }), ana)).toBe(true);
    expect(canCancelSwap(req({ id: '1', status: 'approved' }), ana)).toBe(false);
    expect(canCancelSwap(req({ id: '1' }), bruno)).toBe(false);
  });

  it('aprovar só aceites; recusar abertos ou aceites; só manager', () => {
    expect(canApproveSwap(req({ id: '1', status: 'accepted' }), helena)).toBe(true);
    expect(canApproveSwap(req({ id: '1', status: 'open' }), helena)).toBe(false);
    expect(canApproveSwap(req({ id: '1', status: 'accepted' }), bruno)).toBe(false);
    expect(canRejectSwap(req({ id: '1', status: 'open' }), helena)).toBe(true);
    expect(canRejectSwap(req({ id: '1', status: 'approved' }), helena)).toBe(false);
  });

  it('a gerente não decide pedidos seus', () => {
    const own = req({ id: '1', status: 'accepted', requester_id: 'helena' });
    expect(canApproveSwap(own, helena)).toBe(false);
    expect(canRejectSwap(own, helena)).toBe(false);
  });

  it('MPI: aprovado e ainda não registado', () => {
    expect(canMarkMpiUpdated(req({ id: '1', status: 'approved' }), helena)).toBe(true);
    expect(
      canMarkMpiUpdated(req({ id: '1', status: 'approved', mpi_updated_at: NOW }), helena),
    ).toBe(false);
  });

  it('pedir troca: turno próprio, futuro e sem pedido em curso', () => {
    const s = shift('x', 'ana', '2026-11-06T09:00:00Z', '2026-11-06T17:00:00Z');
    expect(canRequestSwap(s, ana, [], NOW)).toBe(true);
    expect(canRequestSwap(s, bruno, [], NOW)).toBe(false);
    expect(canRequestSwap(s, ana, [], '2026-11-06T10:00:00Z')).toBe(false);
    expect(canRequestSwap(s, ana, [req({ id: '1', shift: s })], NOW)).toBe(false);
    expect(canRequestSwap(s, ana, [req({ id: '1', shift: s, status: 'rejected' })], NOW)).toBe(
      true,
    );
    const offeredElsewhere = req({ id: '2', status: 'accepted', offered_shift: s });
    expect(canRequestSwap(s, ana, [offeredElsewhere], NOW)).toBe(false);
    expect(activeRequestForShift('x', [offeredElsewhere])?.id).toBe('2');
  });
});

describe('groupSwapRequests', () => {
  const requests = [
    req({ id: 'aberto-ana' }),
    req({ id: 'aberto-bruno', requester_id: 'bruno' }),
    req({ id: 'aceite-por-bruno', status: 'accepted', accepted_by: 'bruno' }),
    req({
      id: 'aprovado',
      status: 'approved',
      accepted_by: 'bruno',
      created_at: '2026-11-01T11:00:00Z',
    }),
    req({ id: 'mpi-feito', status: 'approved', accepted_by: 'bruno', mpi_updated_at: NOW }),
    req({ id: 'cancelado', status: 'cancelled', created_at: '2026-11-01T12:00:00Z' }),
  ];
  const ids = (sections: ReturnType<typeof groupSwapRequests>, key: string) =>
    sections.find((s) => s.key === key)?.requests.map((r) => r.id);

  it('para trabalhadores', () => {
    const g = groupSwapRequests(requests, bruno, NOW);
    expect(g.map((s) => s.key)).toEqual(['to_accept', 'mine', 'accepted_by_me', 'history']);
    expect(ids(g, 'to_accept')).toEqual(['aberto-ana']);
    expect(ids(g, 'mine')).toEqual(['aberto-bruno']);
    expect(ids(g, 'accepted_by_me')).toEqual(['aceite-por-bruno']);
    expect(ids(g, 'history')).toEqual(['cancelado', 'aprovado', 'mpi-feito']);
  });

  it('para a gerência', () => {
    const g = groupSwapRequests(requests, helena, NOW);
    expect(g.map((s) => s.key)).toEqual(['to_decide', 'mpi_pending', 'open', 'history']);
    expect(ids(g, 'to_decide')).toEqual(['aceite-por-bruno']);
    expect(ids(g, 'mpi_pending')).toEqual(['aprovado']);
    expect(ids(g, 'open')).toEqual(['aberto-ana', 'aberto-bruno']);
  });

  it('badge: o que precisa de ação', () => {
    expect(actionableSwapCount(requests, bruno, NOW)).toBe(1);
    expect(actionableSwapCount(requests, ana, NOW)).toBe(1); // o aberto do Bruno
    expect(actionableSwapCount(requests, helena, NOW)).toBe(2);
  });
});

describe('evaluateSwapRequest', () => {
  const r = (id: string, date: string, start: string, end: string) => ({
    id,
    startsAt: fromLisbonLocal(date, start),
    endsAt: fromLisbonLocal(date, end),
  });

  it('dar turno: avisa quem aceita sobre descanso e horas', () => {
    const ev = evaluateSwapRequest({
      type: 'give',
      shift: r('pedido', '2026-11-05', '07:00', '15:00'),
      acceptorShifts: [
        r('b1', '2026-11-04', '15:00', '23:00'),
        r('b2', '2026-11-03', '09:00', '17:00'),
      ],
      acceptorWeeklyHours: 20,
      requesterShifts: [],
      requesterWeeklyHours: 40,
    });
    expect(ev.acceptor.map((w) => w.kind)).toEqual(['short_rest', 'weekly_hours_exceeded']);
    expect(ev.requester).toEqual([]);
  });

  it('troca: quem aceita deixa de ter o turno oferecido; quem pediu ganha-o', () => {
    const offered = r('oferecido', '2026-11-05', '07:00', '15:00');
    const ev = evaluateSwapRequest({
      type: 'swap',
      shift: r('pedido', '2026-11-06', '09:00', '17:00'),
      offeredShift: offered,
      acceptorShifts: [offered],
      acceptorWeeklyHours: 8,
      requesterShifts: [
        r('pedido', '2026-11-06', '09:00', '17:00'),
        r('a1', '2026-11-04', '16:00', '23:00'),
      ],
      requesterWeeklyHours: 40,
    });
    // Sem o oferecido, quem aceita fica só com 8h: dentro do limite.
    expect(ev.acceptor).toEqual([]);
    // Quem pediu fica com 07:00 de quinta depois de sair às 23:00 de quarta.
    expect(ev.requester.map(formatShiftWarning)).toEqual([
      'Só 8 h de descanso entre quarta-feira, 4 de novembro às 23:00 e quinta-feira, 5 de novembro às 07:00 (mínimo 11 h).',
    ]);
  });

  it('ignora o turno oferecido se o tipo não for troca', () => {
    const ev = evaluateSwapRequest({
      type: 'cover',
      shift: r('pedido', '2026-11-06', '09:00', '17:00'),
      offeredShift: r('x', '2026-11-05', '09:00', '17:00'),
      acceptorShifts: [],
      acceptorWeeklyHours: 40,
      requesterShifts: [],
      requesterWeeklyHours: 40,
    });
    expect(ev.requester).toEqual([]);
  });
});
