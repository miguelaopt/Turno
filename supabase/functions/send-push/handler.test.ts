import { assertEquals } from '@std/assert';
import {
  buildExpoMessages,
  createHandler,
  tokensToRemove,
  type NotificationRecord,
} from './handler.ts';

const env = {
  SUPABASE_URL: 'https://projeto.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-de-teste',
  PUSH_WEBHOOK_SECRET: 'segredo',
};

const record: NotificationRecord = {
  id: 'n1',
  user_id: 'u1',
  swap_request_id: 'r1',
  title: 'Cobrir falta: seg., 9 nov., 18:00–00:00',
  body: 'Bruno Costa — Consulta médica',
  urgent: true,
};

const webhook = (body: unknown, secret = 'segredo') =>
  new Request('http://localhost/send-push', {
    method: 'POST',
    headers: { 'x-webhook-secret': secret, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

type Call = { url: string; init?: RequestInit };

function fakeFetch(responses: Record<string, unknown>) {
  const calls: Call[] = [];
  const impl = ((input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    const key = Object.keys(responses).find((k) => url.startsWith(k));
    return Promise.resolve(
      new Response(JSON.stringify(key ? responses[key] : {}), { status: 200 }),
    );
  }) as typeof fetch;
  return { impl, calls };
}

Deno.test('mensagens: urgente vai com prioridade alta e leva ao pedido', () => {
  const [m] = buildExpoMessages(record, ['ExponentPushToken[a]']);
  assertEquals(m?.priority, 'high');
  assertEquals(m?.channelId, 'urgente');
  assertEquals(m?.data.url, '/pedidos/r1');
});

Deno.test('remove só tokens DeviceNotRegistered', () => {
  const msgs = buildExpoMessages(record, ['a', 'b', 'c']);
  const removed = tokensToRemove(msgs, [
    { status: 'ok' },
    { status: 'error', details: { error: 'DeviceNotRegistered' } },
    { status: 'error', details: { error: 'MessageRateExceeded' } },
  ]);
  assertEquals(removed, ['b']);
});

Deno.test('recusa pedidos sem o segredo', async () => {
  const { impl, calls } = fakeFetch({});
  const res = await createHandler(env, impl)(webhook({}, 'errado'));
  assertEquals(res.status, 401);
  assertEquals(calls.length, 0);
});

Deno.test('ignora eventos que não são INSERT em notifications', async () => {
  const { impl } = fakeFetch({});
  const res = await createHandler(
    env,
    impl,
  )(webhook({ type: 'UPDATE', table: 'notifications', schema: 'public', record }));
  assertEquals(await res.json(), { skipped: true });
});

Deno.test('envia para os tokens da pessoa e limpa os inválidos', async () => {
  const { impl, calls } = fakeFetch({
    'https://projeto.supabase.co/rest/v1/push_tokens?select': [
      { token: 'ExponentPushToken[a]' },
      { token: 'ExponentPushToken[b]' },
    ],
    'https://exp.host': {
      data: [{ status: 'ok' }, { status: 'error', details: { error: 'DeviceNotRegistered' } }],
    },
  });
  const res = await createHandler(
    env,
    impl,
  )(webhook({ type: 'INSERT', table: 'notifications', schema: 'public', record }));
  assertEquals(await res.json(), { sent: 2, removed: 1 });

  assertEquals(calls[0]?.url.includes('user_id=eq.u1'), true);
  const sent = JSON.parse(String(calls[1]?.init?.body));
  assertEquals(sent.length, 2);
  assertEquals(calls[2]?.init?.method, 'DELETE');
  assertEquals(
    decodeURIComponent(calls[2]!.url).endsWith('token=in.("ExponentPushToken[b]")'),
    true,
  );
});

Deno.test('sem tokens não chama a Expo', async () => {
  const { impl, calls } = fakeFetch({ 'https://projeto.supabase.co': [] });
  const res = await createHandler(
    env,
    impl,
  )(webhook({ type: 'INSERT', table: 'notifications', schema: 'public', record }));
  assertEquals(await res.json(), { sent: 0, removed: 0 });
  assertEquals(calls.length, 1);
});
