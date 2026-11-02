// Envia por push (Expo Push Service) cada notificação criada na tabela
// public.notifications. É chamado por um Database Webhook em INSERT.
//
// Sem dependências externas: fala com o PostgREST e com a Expo por fetch, o
// que facilita os testes (handler.test.ts) e evita versões de bibliotecas.

export interface NotificationRecord {
  id: string;
  user_id: string;
  swap_request_id: string | null;
  title: string;
  body: string;
  urgent: boolean;
}

export interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  schema: string;
  record: NotificationRecord | null;
}

export interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  sound: 'default';
  priority: 'default' | 'high';
  channelId: 'default' | 'urgente';
  data: { url: string; notificationId: string };
}

export interface Env {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  PUSH_WEBHOOK_SECRET?: string;
  EXPO_ACCESS_TOKEN?: string;
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_BATCH = 100;

/** Igual a notificationPath em @turno/shared: o mesmo caminho na web e na app. */
export function notificationUrl(record: Pick<NotificationRecord, 'swap_request_id'>): string {
  return record.swap_request_id ? `/pedidos/${record.swap_request_id}` : '/notificacoes';
}

export function buildExpoMessages(record: NotificationRecord, tokens: string[]): ExpoMessage[] {
  return tokens.map((to) => ({
    to,
    title: record.title,
    body: record.body,
    sound: 'default',
    priority: record.urgent ? 'high' : 'default',
    channelId: record.urgent ? 'urgente' : 'default',
    data: { url: notificationUrl(record), notificationId: record.id },
  }));
}

interface ExpoTicket {
  status: 'ok' | 'error';
  details?: { error?: string };
}

/** Tokens que a Expo diz já não existirem (app desinstalada, etc.). */
export function tokensToRemove(messages: ExpoMessage[], tickets: ExpoTicket[]): string[] {
  return tickets.flatMap((ticket, i) =>
    ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered' && messages[i]
      ? [messages[i].to]
      : [],
  );
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

export function createHandler(env: Env, fetchImpl: typeof fetch = fetch) {
  return async (req: Request): Promise<Response> => {
    if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PUSH_WEBHOOK_SECRET } = env;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !PUSH_WEBHOOK_SECRET) {
      return json(500, { error: 'missing_env' });
    }
    if (!timingSafeEqual(req.headers.get('x-webhook-secret') ?? '', PUSH_WEBHOOK_SECRET)) {
      return json(401, { error: 'unauthorized' });
    }

    let payload: WebhookPayload;
    try {
      payload = await req.json();
    } catch {
      return json(400, { error: 'invalid_json' });
    }
    if (payload.type !== 'INSERT' || payload.table !== 'notifications' || !payload.record) {
      return json(200, { skipped: true });
    }
    const record = payload.record;

    const rest = `${SUPABASE_URL}/rest/v1/push_tokens`;
    const headers = {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    };

    const tokensRes = await fetchImpl(
      `${rest}?select=token&platform=in.(ios,android)&user_id=eq.${encodeURIComponent(record.user_id)}`,
      { headers },
    );
    if (!tokensRes.ok) return json(502, { error: 'tokens_query_failed' });
    const tokens = ((await tokensRes.json()) as { token: string }[]).map((t) => t.token);
    if (!tokens.length) return json(200, { sent: 0, removed: 0 });

    const messages = buildExpoMessages(record, tokens);
    const toRemove: string[] = [];
    for (let i = 0; i < messages.length; i += EXPO_BATCH) {
      const batch = messages.slice(i, i + EXPO_BATCH);
      const res = await fetchImpl(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          ...(env.EXPO_ACCESS_TOKEN ? { authorization: `Bearer ${env.EXPO_ACCESS_TOKEN}` } : {}),
        },
        body: JSON.stringify(batch),
      });
      if (!res.ok) return json(502, { error: 'expo_failed', status: res.status });
      const { data } = (await res.json()) as { data: ExpoTicket[] };
      toRemove.push(...tokensToRemove(batch, data ?? []));
    }

    if (toRemove.length) {
      const list = toRemove.map((t) => `"${t.replaceAll('"', '\\"')}"`).join(',');
      await fetchImpl(`${rest}?token=in.(${encodeURIComponent(list)})`, {
        method: 'DELETE',
        headers,
      });
    }

    return json(200, { sent: messages.length, removed: toRemove.length });
  };
}
