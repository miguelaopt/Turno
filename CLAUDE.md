# CLAUDE.md — Turno

Guia para próximas sessões. Ler antes de mexer no código.

## O produto

App para a equipa de um restaurante pedir, aceitar e aprovar trocas de turno, com registo escrito
de tudo. Duas versões sempre sincronizadas: site (`apps/web`) e app de telemóvel (`apps/mobile`).

Fluxo (fase 2): um trabalhador publica um pedido (`swap` trocar, `give` dar o turno, `cover` cobrir
uma falta) → um colega aceita → a gerente aprova ou recusa → a gerente atualiza o MPI à mão.

**Limites que não se negoceiam**

- O Turno NÃO substitui nem se liga ao portal interno da empresa (MPI): nada de scraping, nada de
  dados da empresa, nenhuma integração. Cada pessoa regista os seus próprios turnos.
- Interface toda em **português de Portugal (pt-PT)**. Datas e horas sempre no fuso
  **Europe/Lisbon**, seja qual for o fuso do dispositivo.
- Sem cores, nomes ou logótipos de marcas reais.
- Nunca escrever chaves reais nem a service role key no repositório. As apps só usam a anon key.

## Estado das fases

- **Fase 1 (feita):** monorepo, migração com RLS e RPC, seed, `packages/shared`, login por magic
  link e "Os meus turnos" (listar, criar, editar, apagar) com Realtime, em web e mobile.
- **Fase 2 (não começar sem pedido explícito):** UI de pedidos de troca, aceitar, aprovar/recusar,
  avisos de horas/descanso na decisão da gerente, notificações push (`push_tokens`).

## Arquitetura

```
apps/web         Next.js 16 (App Router) + TypeScript + Tailwind v4 + shadcn/ui
apps/mobile      Expo SDK 58 + Expo Router + TypeScript
packages/shared  @turno/shared — TypeScript sem build (transpilado pelas apps)
supabase/        migrations/, seed.sql, checks/rls_checks.sql, config.toml
```

Monorepo pnpm workspaces + Turborepo. Scripts na raiz: `dev`, `build`, `lint`, `typecheck`,
`test`, `format`, `db:*`, `gen:types`.

### Sincronização

- O Supabase é a única fonte de verdade. Nada de estado de servidor fora do TanStack Query.
- As duas apps usam as mesmas funções de `@turno/shared` (`myShiftsQuery`, `createShift`, …) e
  as mesmas `queryKeys`. Todas as chaves de turnos começam por `['shifts']`.
- `subscribeAndInvalidate` (shared) subscreve o Realtime em `shifts` e `swap_requests` da loja e
  invalida `['shifts']` / `['swap_requests']`. INSERT/UPDATE vêm filtrados por `store_id`; DELETE
  não suporta filtros no Realtime, por isso é ouvido sem filtro (só traz a chave primária).
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
- `queries/`, `supabase/` — cliente (`createTurnoClient`), auth (`sendMagicLink`,
  `parseAuthCallbackUrl`), Realtime.
- `tokens.ts` — cores, raios, espaçamentos, Manrope, alvo de toque. Fonte única de design.
- **Sem React em shared.** Os hooks (`useMyShifts`, `useShiftMutations`, `useStoreRealtime`) são
  finos e existem em cada app (`apps/*/src/hooks/use-turno-data.ts`), para evitar duas cópias do
  React no monorepo. Se mudares um, muda o outro.

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

### Mobile (apps/mobile)

- Sessão em AsyncStorage; `autoRefreshToken` liga/desliga com o `AppState`.
- Magic link: `emailRedirectTo = Linking.createURL('auth/callback')` → `turno://auth/callback`
  (build própria) ou `exp://<ip>:8081/--/auth/callback` (Expo Go). `app/auth/callback.tsx` troca o
  código com `exchangeCodeForSession` (uma vez por código).
- `react-native-url-polyfill/auto` é necessário (o `URL` do RN não tem `search`/`hash`).
- Componentes base em `src/components/ui.tsx` (Text com pesos Manrope, Button ≥ 44 pt, Card,
  TextField, WarningBox). Horas escritas com teclado numérico + `maskTimeInput`.

## Base de dados (supabase/migrations)

Tabelas: `stores`, `profiles` (id = auth.users.id), `shifts`, `swap_requests`, `push_tokens`.
Enums: `user_role`, `shift_source`, `swap_type`, `swap_status`, `push_platform`.

Regras RLS (todas cobertas em `supabase/checks/rls_checks.sql`):

- Cada pessoa só lê linhas do seu `store_id` (`private.current_store_id()`, security definer).
- Turnos: ler os da loja; criar/editar/apagar só os próprios.
- Pedidos: só se criam sobre turnos próprios, sempre em `open` (grants por coluna impedem
  escolher `status`, `accepted_by`, `decided_by`).
- **Sem UPDATE/DELETE direto em `swap_requests`.** Mudanças de estado só pela RPC
  `public.transition_swap_request(p_request_id, p_status)`:
  - `open → accepted`: worker da loja que não seja quem pediu (grava `accepted_by`)
  - `open|accepted → cancelled`: quem pediu
  - `accepted → approved`, `open|accepted → rejected`: só `manager` (grava `decided_by`)
  - A RPC ainda não mexe nos turnos; decidir na fase 2 o que acontece aos `shifts` aprovados.
- `profiles`: cada pessoa só pode mudar o próprio `name`. `role`, `store_id` e `weekly_hours` só
  por admin (SQL/painel).
- `push_tokens`: cada pessoa gere os seus.
- Integridade: FKs compostas `(user_id, store_id)` garantem que turnos e pedidos são da mesma
  loja da pessoa. Um turno com pedidos associados não pode ser apagado (`on delete restrict`,
  "registo escrito de tudo").
- Um único pedido ativo (`open`/`accepted`) por turno (índice único parcial).

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
- Commits pequenos, mensagens em inglês ou português, branch por funcionalidade, PR para `main`.
