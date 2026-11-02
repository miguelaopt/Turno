// Edge Function "send-push": ver handler.ts e o README (secção Notificações).
import { createHandler } from './handler.ts';

const handler = createHandler({
  SUPABASE_URL: Deno.env.get('SUPABASE_URL'),
  SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
  PUSH_WEBHOOK_SECRET: Deno.env.get('PUSH_WEBHOOK_SECRET'),
  EXPO_ACCESS_TOKEN: Deno.env.get('EXPO_ACCESS_TOKEN'),
});

Deno.serve(handler);
