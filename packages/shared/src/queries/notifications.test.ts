import { describe, expect, it } from 'vitest';
import { notificationPath, unreadCount, type AppNotification } from './notifications';

const n = (over: Partial<AppNotification>): AppNotification => ({
  id: '1',
  store_id: 's',
  user_id: 'u',
  swap_request_id: null,
  kind: 'swap_open',
  title: 't',
  body: 'b',
  urgent: false,
  read_at: null,
  created_at: '2026-11-02T10:00:00Z',
  ...over,
});

describe('notificações', () => {
  it('conta as não lidas', () => {
    expect(unreadCount([n({}), n({ id: '2', read_at: '2026-11-02T11:00:00Z' })])).toBe(1);
    expect(unreadCount(undefined)).toBe(0);
  });

  it('leva ao pedido certo', () => {
    expect(notificationPath(n({ swap_request_id: 'abc' }))).toBe('/pedidos/abc');
    expect(notificationPath(n({}))).toBe('/notificacoes');
  });
});
