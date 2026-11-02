import { describe, expect, it, vi } from 'vitest';
import type { TurnoClient } from './client';
import { subscribeAndInvalidate } from './realtime';

type Handler = (payload: { eventType: 'INSERT' | 'UPDATE' | 'DELETE'; new: object }) => void;

function fakeClient() {
  const listeners: {
    filter: { event: string; table: string; filter?: string };
    handler: Handler;
  }[] = [];
  let statusCb: (s: string) => void = () => {};
  const channel = {
    on(_type: string, filter: { event: string; table: string; filter?: string }, handler: Handler) {
      listeners.push({ filter, handler });
      return channel;
    },
    subscribe(cb: (s: string) => void) {
      statusCb = cb;
      return channel;
    },
  };
  const client = {
    channel: vi.fn(() => channel),
    removeChannel: vi.fn(async () => 'ok'),
  } as unknown as TurnoClient;
  return { client, listeners, setStatus: (s: string) => statusCb(s) };
}

describe('subscribeAndInvalidate', () => {
  it('filtra por loja e por pessoa, e só ouve DELETE em shifts', () => {
    const { client, listeners } = fakeClient();
    subscribeAndInvalidate(
      client,
      { storeId: 'loja', userId: 'ana' },
      { invalidateQueries: vi.fn(async () => {}) },
    );
    const deletes = listeners.filter((l) => l.filter.event === 'DELETE').map((l) => l.filter.table);
    expect(deletes).toEqual(['shifts']);
    const notif = listeners.find((l) => l.filter.table === 'notifications');
    expect(notif?.filter.filter).toBe('user_id=eq.ana');
    const shifts = listeners.find(
      (l) => l.filter.table === 'shifts' && l.filter.event === 'INSERT',
    );
    expect(shifts?.filter.filter).toBe('store_id=eq.loja');
  });

  it('invalida a cache certa e repassa o evento', () => {
    const { client, listeners } = fakeClient();
    const invalidateQueries = vi.fn(async () => {});
    const onEvent = vi.fn();
    subscribeAndInvalidate(
      client,
      { storeId: 'loja', userId: 'ana' },
      { invalidateQueries },
      onEvent,
    );

    listeners
      .find((l) => l.filter.table === 'shifts' && l.filter.event === 'UPDATE')!
      .handler({ eventType: 'UPDATE', new: { id: '1' } });
    expect(
      invalidateQueries.mock.calls.map(
        (c) => (c as unknown as [{ queryKey: unknown[] }])[0].queryKey,
      ),
    ).toEqual([['shifts'], ['swap_requests']]);

    listeners
      .find((l) => l.filter.table === 'notifications')!
      .handler({ eventType: 'INSERT', new: { title: 'Olá' } });
    expect(onEvent).toHaveBeenLastCalledWith({
      table: 'notifications',
      eventType: 'INSERT',
      record: { title: 'Olá' },
    });
  });

  it('ao reconectar, invalida tudo (podem ter-se perdido eventos)', () => {
    const { client, setStatus } = fakeClient();
    const invalidateQueries = vi.fn(async () => {});
    subscribeAndInvalidate(client, { storeId: 'loja', userId: 'ana' }, { invalidateQueries });
    setStatus('SUBSCRIBED');
    expect(invalidateQueries).not.toHaveBeenCalled();
    setStatus('CHANNEL_ERROR');
    setStatus('SUBSCRIBED');
    expect(invalidateQueries.mock.calls.length).toBeGreaterThanOrEqual(4);
  });
});
