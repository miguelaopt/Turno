# CLAUDE.md — Turno

Guia para próximas sessões. Ler antes de mexer no código.

## O produto

App para a equipa de um restaurante pedir, aceitar e aprovar trocas de turno, com registo escrito
de tudo. Duas versões sempre sincronizadas: site (`apps/web`) e app de telemóvel (`apps/mobile`).

Fluxo: um trabalhador publica um pedido (`swap` trocar, `give` dar o turno, `cover` cobrir
uma falta) → um colega aceita → a gerente aprova ou recusa → a gerente atualiza o MPI à mão.

**Limites que não se negoceiam**

- O Turno NÃO substitui nem se liga ao portal interno da empresa (MPI): nada de scraping, nada de
  dados da empresa, nenhuma integração. Cada pessoa regista os seus próprios turnos.
- Interface toda em **português de Portugal (pt-PT)**. Datas e horas sempre no fuso
  **Europe/Lisbon**, seja qual for o fuso do dispositivo.
- Sem cores, nomes ou logótipos de marcas reais.
- Nunca escrever chaves reais nem a service role key no repositório. As apps só usam a anon key.

## Estado das fases

- **Fase 1 (feita):**
  - Monorepo, migração com RLS e RPC, seed e `packages/shared`.
  - Login por magic link.
  - "Os meus turnos" (listar, criar, editar, apagar) com Realtime, na web e no mobile.
- **Fase 2 (feita):**
  - Pedidos de troca: trocar, dar, cobrir falta.
  - Aceitar, aprovar ou recusar, com avisos de horas e de descanso para a gerente.
  - Reatribuição dos turnos ao aprovar.
  - Registo de "MPI atualizado".
  - Histórico de cada pedido (`swap_request_events`).
  - Notificações na app (`notifications`) e push no mobile (Edge Function `send-push` + Expo).
- **Por decidir / próximas fases** (não fazer sem pedido):
  - Push no browser (Web Push com VAPID e service worker).
  - Expirar pedidos abertos cujo turno já passou. Hoje ficam `open`, mas ninguém os pode aceitar.
  - Quem aceitou poder desistir (`accepted → open`).
  - Importar turnos a partir de screenshot (`source = 'screenshot'` já existe no enum).

## Arquitetura

```
apps/web         Next.js 16 (App Router) + TypeScript + Tailwind v4 + shadcn/ui
apps/mobile      Expo SDK 58 + Expo Router + TypeScript
packages/shared  @turno/shared — TypeScript sem build (transpilado pelas apps)
supabase/        migrations/, seed.sql, checks/rls_checks.sql, functions/send-push (Deno), config.toml
```

Monorepo pnpm workspaces + Turborepo. Scripts na raiz: `dev`, `build`, `lint`, `typecheck`,
`test`, `format`, `db:*`, `gen:types`.

### Sincronização

- O Supabase é a única fonte de verdade. Nada de estado de servidor fora do TanStack Query.
- As duas apps usam as mesmas funções de `@turno/shared` (`myShiftsQuery`, `createShift`, …) e
  as mesmas `queryKeys`. Todas as chaves de turnos começam por `['shifts']`.
- `subscribeAndInvalidate` (shared) subscreve o Realtime em `shifts`, `swap_requests` e
  `swap_request_events` da loja, e em `notifications` da pessoa.
  - Invalida conforme `REALTIME_INVALIDATIONS`. Uma mudança em `shifts` invalida também
    `['swap_requests']`, porque os pedidos embebem os turnos.
  - INSERT/UPDATE vêm filtrados. DELETE não suporta filtros no Realtime, por isso só é ouvido em
    `shifts`, sem filtro (só traz a chave primária).
- O Realtime é subscrito uma vez, no layout de `(app)` de cada app (AppShell na web,
  `app/(app)/_layout.tsx` no mobile).
- Ao reconectar, invalida tudo (podem ter-se perdido eventos).

### packages/shared

- `types/database.ts` — tipos no formato do `supabase gen types`. Foram escritos à mão na fase 1
  (sem Supabase a correr); regenerar com `pnpm gen:types` depois de aplicar migrações.
- `schemas/` — zod (v4). `shiftFormSchema` + `shiftFormToTimes`: se a hora de fim ≤ início, o
  turno acaba no dia seguinte. Máximo 16 h (igual ao `check` da BD).
- `time/` — tudo o que é data/hora em Lisboa (`fromLisbonLocal`, `lisbonWeek`, formatação pt-PT).
  Usa só `Intl.DateTimeFormat#formatToParts` para funcionar igual em browser, Node e Hermes.
  Semanas de segunda 00:00 a segunda 00:00 (Lisboa). **Nunca** usar `getHours()`/`getDay()` nem
  `toLocaleString` sem `timeZone`.
- `rules/` — funções puras com testes:
  - `checkWeeklyHours` — avisa se um turno põe a pessoa acima de `weekly_hours` nessa semana
    (verifica as duas semanas se o turno atravessar domingo → segunda).
  - `checkRest` / `findShortRests` — menos de 11 h de descanso entre **períodos diários**
    consecutivos (Código do Trabalho, art. 214.º). Turnos que começam no mesmo dia contam como um
    período (turno partido não gera aviso).
  - `evaluateShiftAssignment` + `formatShiftWarning` — junta tudo em mensagens pt-PT.
  - São **avisos, não bloqueios**: a decisão é da gerente.
- `views/week.ts` — `buildWeekView` prepara a semana (dias, totais, avisos) para as duas UIs.
- `swaps/`:
  - Textos pt-PT dos tipos, estados e eventos.
  - Permissões (`canAcceptSwap`, `canApproveSwap`, …). Espelham a RPC e servem só para decidir
    que botões mostrar.
  - `groupSwapRequests`: as secções da lista de pedidos, por papel.
  - `actionableSwapCount`: o número do badge.
  - `evaluateSwapRequest`: avisos para quem aceita e, numa troca, também para quem pediu.
- `time/` também tem `formatShiftSummary` ("qui., 5 nov., 07:00–15:00"). Usa abreviaturas fixas
  iguais às de `private.format_shift` na BD, porque o ICU varia entre motores.
- `queries/`, `supabase/` — cliente (`createTurnoClient`), auth (`sendMagicLink`,
  `parseAuthCallbackUrl`), Realtime.
- `tokens.ts` — cores, raios, espaçamentos, Manrope, alvo de toque. Fonte única de design.
- **Sem React em shared.** Os hooks (`apps/*/src/hooks/use-turno-data.ts`) são finos e
  **idênticos** nas duas apps (só muda o comentário e o `'use client'`). Ficam fora de shared para
  evitar duas cópias do React no monorepo. Se mudares um, muda o outro.
- Rotas iguais nas duas apps: `/turnos` (no mobile, `/`), `/pedidos`, `/pedidos/<id>` e
  `/notificacoes`. As notificações levam a `notificationPath()` (`/pedidos/<id>`), tanto na web
  como no push do mobile.

### Web (apps/web)

- Auth só no cliente: `createTurnoClient({ platform: 'web' })` guarda a sessão em localStorage e,
  com `detectSessionInUrl` + PKCE, troca o `code` quando o browser abre `/auth/callback`. Não há
  dados privados renderizados no servidor; as permissões são garantidas por RLS. Se um dia for
  preciso SSR com dados privados, migrar para `@supabase/ssr` (cookies).
- O cliente Supabase só é criado no browser (`getBrowserSupabase`), por isso o `next build` não
  precisa das variáveis de ambiente.
- Tokens: o layout injeta `tokensToCss()` (variáveis `--turno-*`); `globals.css` só as mapeia
  para os nomes do shadcn/Tailwind. Não escrever valores hex no CSS.
- shadcn/ui: componentes em `src/components/ui` (escritos à mão a partir do registo, porque a
  rede da sessão bloqueava `ui.shadcn.com`). `components.json` está pronto para `shadcn add`.
- Manrope via `@fontsource-variable/manrope` (sem pedidos ao Google Fonts no build).

### Web: estrutura

- `app/(app)/layout.tsx` verifica a sessão e o perfil e fornece `useSession()`.
- `components/app-shell.tsx` tem o cabeçalho, a navegação com badges e o Realtime.
- `components/pedidos/` tem a lista, o detalhe (aceitar, decidir, MPI, histórico) e o diálogo
  "Pedir troca".

### Mobile (apps/mobile)

- `app/(app)/_layout.tsx`: sessão, perfil, Realtime e push.
- `app/(app)/(tabs)`: Turnos, Pedidos e Notificações.
- Modais: `turno` e `pedir-troca`.
- `pedidos/[id]`: o detalhe do pedido.
- Push: `src/lib/push.ts` + `src/hooks/use-push.ts`.
  - Não pede autorização sozinho. Só pede quando a pessoa carrega em "Ativar notificações".
  - Precisa de `extra.eas.projectId` (`npx eas init`).
  - No Android não funciona no Expo Go (precisa de uma development build).
  - Ao sair da conta, o token é removido (`unregister_push_token`).

- Sessão em AsyncStorage; `autoRefreshToken` liga/desliga com o `AppState`.
- Magic link: `emailRedirectTo = Linking.createURL('auth/callback')` → `turno://auth/callback`
  (build própria) ou `exp://<ip>:8081/--/auth/callback` (Expo Go). `app/auth/callback.tsx` troca o
  código com `exchangeCodeForSession` (uma vez por código).
- `react-native-url-polyfill/auto` é necessário (o `URL` do RN não tem `search`/`hash`).
- Componentes base em `src/components/ui.tsx` (Text com pesos Manrope, Button ≥ 44 pt, Card,
  TextField, WarningBox). Horas escritas com teclado numérico + `maskTimeInput`.

## Base de dados (supabase/migrations)

Tabelas:

- `stores`
- `profiles` (id = auth.users.id)
- `shifts`
- `swap_requests`, com `offered_shift_id`, `accepted_at`, `decided_at`, `decision_note`,
  `mpi_updated_at` e `mpi_updated_by`
- `swap_request_events` (histórico só de leitura)
- `notifications`
- `push_tokens`

Enums: `user_role`, `shift_source`, `swap_type`, `swap_status`, `swap_event_kind`,
`notification_kind`, `push_platform`.

Migrações:

- `20261102120000_initial_schema.sql` (fase 1)
- `20261103120000_swap_workflow.sql` (fase 2: substitui `transition_swap_request`)

Regras RLS (todas cobertas em `supabase/checks/rls_checks.sql`):

- Cada pessoa só lê linhas do seu `store_id` (`private.current_store_id()`, security definer).
- Turnos: ler os da loja; criar/editar/apagar só os próprios.
- Pedidos: só se criam sobre turnos próprios, sempre em `open` (grants por coluna impedem
  escolher `status`, `accepted_by`, `decided_by`).
- **Sem UPDATE/DELETE direto em `swap_requests`.** As mudanças de estado só passam pela RPC
  `public.transition_swap_request(p_request_id, p_status, p_offered_shift_id?, p_note?)`:
  - `open → accepted`: worker da loja que não seja quem pediu; o turno ainda não começou.
    - Para `swap` é obrigatório oferecer um turno: tem de ser seu, futuro e sem outra troca em
      curso.
    - Para `give` e `cover` não se oferece turno.
  - `open|accepted → cancelled`: só quem pediu.
  - `accepted → approved`: `manager` da loja, que não seja quem pediu.
    - **Reatribui os turnos:** o turno do pedido passa para `accepted_by`; numa troca, o turno
      oferecido passa para quem pediu.
    - Antes, verifica que os donos não mudaram entretanto.
  - `open|accepted → rejected`: `manager` da loja, com nota opcional (`decision_note`).
  - `mark_swap_mpi_updated(id)`: só `manager`, só em pedidos aprovados; é idempotente.
- Triggers:
  - `private.validate_new_swap_request`: só se pedem trocas de turnos futuros que não estejam
    oferecidos noutra troca.
  - `private.lock_shift_with_active_request`: não se mudam as horas de um turno com um pedido em
    curso, nem de um turno oferecido numa troca aceite.
  - `private.on_swap_request_change`: escreve o evento no histórico e cria as notificações, com
    textos em pt-PT e datas de Lisboa (`private.format_shift`).
- `swap_request_events`: os clientes só leem. Ninguém escreve diretamente; só o trigger.
- `notifications`: cada pessoa lê as suas e só pode mudar `read_at`.
- `register_push_token` e `unregister_push_token`: um token passa para a última pessoa que entrou
  nesse dispositivo.
- `profiles`: cada pessoa só pode mudar o próprio `name`. `role`, `store_id` e `weekly_hours` só
  por admin (SQL/painel).
- `push_tokens`: cada pessoa gere os seus.
- Push: Database Webhook (INSERT em `notifications`) → Edge Function `send-push`.
  - A função autentica-se com o cabeçalho `x-webhook-secret` (`PUSH_WEBHOOK_SECRET`) e corre com
    `verify_jwt = false`.
  - Lê os tokens com a service role e envia pela Expo Push API.
  - Remove os tokens `DeviceNotRegistered`.
  - Não tem dependências: só `fetch`. Os testes são Deno (`pnpm functions:test`).
- Integridade: FKs compostas `(user_id, store_id)` garantem que turnos e pedidos são da mesma
  loja da pessoa. Um turno com pedidos associados não pode ser apagado (`on delete restrict`,
  "registo escrito de tudo").
- Um único pedido ativo (`open`/`accepted`) por turno (índice único parcial).

As verificações de `supabase/checks/rls_checks.sql` (68 casos) correm com `pnpm db:check`.

Regras para novas migrações: ficheiro novo em `supabase/migrations/` (nunca editar uma migração já
aplicada), funções com `set search_path = ''`, funções auxiliares no schema `private`, `revoke`
de `anon`, acrescentar casos a `supabase/checks/rls_checks.sql` e regenerar os tipos.

## Convenções

- TypeScript strict (`noUncheckedIndexedAccess` incluído). Sem `any`.
- Texto visível ao utilizador sempre em pt-PT ("ecrã", "telemóvel", "registar", tu informal).
  Erros técnicos passam por `getErrorMessage` (shared).
- Datas: guardar instantes (`timestamptz`, ISO UTC); converter para Lisboa só para mostrar ou ao
  ler formulários, com as funções de `@turno/shared`.
- Design: fundo `#F5F4F0`, cartões brancos com borda `#E4E2DC` e cantos de 16 px, texto `#16191D`,
  secundário `#5B616B`, acento `#0F6E6A`, urgente `#B4440E`, Manrope, alvos de toque ≥ 44 px.
  Usar sempre os tokens, nunca valores soltos.
- Lógica de negócio pura vai para `packages/shared` com testes Vitest.
- Antes de concluir: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
  Se mexeres na Edge Function, corre também `pnpm functions:check && pnpm functions:test`.
  Se mexeres em SQL, corre também `pnpm db:check`.
- Commits pequenos, mensagens em inglês ou português, branch por funcionalidade, PR para `main`.
