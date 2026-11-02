# Turno

App para a equipa de um restaurante pedir, aceitar e aprovar trocas de turno, com registo escrito
de tudo. Existe em duas versões sempre sincronizadas: **site** (Next.js) e **app de telemóvel**
(Expo). O Supabase é a única fonte de verdade.

> O Turno **não substitui nem se liga** ao portal interno da empresa (MPI). Cada pessoa regista
> os seus próprios turnos; depois de aprovar uma troca, a gerente atualiza o MPI à mão.

**Estado:**

- **Fase 1:** login por magic link e "Os meus turnos" (criar, editar, apagar), com sincronização
  em tempo real entre web e mobile.
- **Fase 2:** pedidos de troca (trocar, dar o turno, cobrir falta), aceitação por colegas,
  aprovação ou recusa pela gerência (com avisos de horas e de descanso), histórico de cada pedido,
  registo de "MPI atualizado", notificações na app e push no telemóvel.

## Como funciona uma troca

1. Em **Turnos**, a pessoa escolhe "Pedir troca" num turno seu que ainda não começou e indica o
   tipo:
   - **Trocar turno:** quem aceitar dá um turno seu em troca.
   - **Dar turno:** alguém fica com o turno.
   - **Cobrir falta:** a pessoa não pode ir. O pedido é marcado como urgente.
2. Os colegas veem o pedido em **Pedidos → Podes aceitar** e aceitam. Numa troca, escolhem o
   turno que oferecem.
3. A gerente vê o pedido em **Pedidos e aprovações → Para aprovar**, com avisos se alguém fica
   acima das horas semanais ou com menos de 11 h de descanso. Os avisos não bloqueiam: a gerente
   aprova ou recusa, com uma nota opcional.
4. Ao aprovar, o Turno passa o turno para quem aceitou (e, numa troca, o turno oferecido para quem
   pediu).
5. A gerente atualiza o MPI à mão e carrega em **"Já atualizei o MPI"**.

Cada passo fica no histórico do pedido, com quem fez o quê e quando.

## Estrutura

```
apps/web         Next.js (App Router) + Tailwind + shadcn/ui
apps/mobile      Expo (Expo Router)
packages/shared  tipos da BD, zod, queries, Realtime, regras de horas/descanso/trocas, tokens
supabase/        migrações SQL, seed, verificações de RLS, Edge Function de push, config do CLI
```

## Requisitos

- Node.js ≥ 20.19 e pnpm 10 (`corepack enable` ativa a versão certa)
- Para Supabase local: Docker a correr (o CLI é usado via `npx supabase`)
- Para o telemóvel: app **Expo Go** (iOS ou Android) na mesma rede Wi‑Fi do computador

## Correr localmente

### 1. Instalar

```bash
pnpm install
```

### 2. Base de dados

**Opção A: Supabase local (Docker)**

```bash
pnpm db:start   # arranca o Supabase e mostra o API URL e a anon key
pnpm db:reset   # aplica supabase/migrations + supabase/seed.sql
pnpm db:check   # (opcional) corre as verificações de RLS em supabase/checks
```

O seed cria:

- a loja "Restaurante Exemplo — Baixa";
- a gerente `gerente@turno.test`;
- os trabalhadores `ana@turno.test`, `bruno@turno.test` e `carla@turno.test`, com turnos na
  semana atual e na seguinte;
- dois pedidos de exemplo: um "cobrir falta" aberto e uma troca já aceite, à espera da gerente.

Os emails do magic link aparecem no Mailpit/Inbucket: <http://127.0.0.1:54324>.

**Opção B: projeto Supabase alojado** — ver [Supabase alojado](#supabase-alojado).

### 3. Variáveis de ambiente

```bash
cp apps/web/.env.example apps/web/.env.local
cp apps/mobile/.env.example apps/mobile/.env
```

Preenche com o URL e a **anon key** (local: o que o `pnpm db:start` mostrou; alojado: Project
Settings → API). **Nunca** uses a service role key nestes ficheiros: tudo o que começa por
`NEXT_PUBLIC_` ou `EXPO_PUBLIC_` vai parar ao browser ou à app.

### 4. Web

```bash
pnpm dev:web    # http://localhost:3000
```

Entra com um dos emails do seed e abre o link no **mesmo navegador** onde o pediste (o login usa
PKCE e o código só funciona onde foi pedido).

### 5. Mobile no Expo Go

```bash
pnpm dev:mobile # mostra um QR code
```

1. Em `apps/mobile/.env`, o `EXPO_PUBLIC_SUPABASE_URL` tem de ser alcançável pelo telemóvel: com
   Supabase local usa o IP do computador na rede (ex.: `http://192.168.1.20:54321`), não
   `127.0.0.1`.
2. Lê o QR code com a câmara (iOS) ou com a app Expo Go (Android).
3. Pede o link no ecrã de login e abre o email **no telemóvel**. O link redireciona para
   `exp://<ip>:8081/--/auth/callback?code=…`, que abre o Expo Go e conclui o login.
   - Com Supabase local, o link do email aponta para `http://127.0.0.1:54321/auth/v1/verify…`.
     No telemóvel, troca `127.0.0.1` pelo IP do computador antes de o abrir (ou usa um projeto
     alojado, onde isto não acontece).
   - Numa build própria (`expo run:ios` / `expo run:android` ou EAS), o destino é
     `turno://auth/callback`.

Para testar a sincronização: abre "Os meus turnos" na web e no telemóvel com a mesma conta, cria
ou apaga um turno num lado e vê-o mudar no outro sem recarregar.

## Supabase alojado

1. **Aplicar as migrações.** Com o CLI:
   ```bash
   npx supabase link --project-ref <ref-do-projeto>
   npx supabase db push
   ```
   Ou executa no SQL Editor os ficheiros de `supabase/migrations/`, **por ordem**.
   **Não** corras o `seed.sql` num projeto real: cria utilizadores de teste em `auth.users`.
2. **Auth → URL Configuration**
   - Site URL: o URL público da web (ou `http://localhost:3000` enquanto não houver).
   - Redirect URLs:
     - `http://localhost:3000/auth/callback`
     - `https://<o-teu-dominio>/auth/callback`
     - `turno://**` (builds próprias da app)
     - `exp://**` (Expo Go; podes restringir a `exp://192.168.1.*:8081/**`)
3. **Auth → Sign In / Providers**: Email ativo; desliga **"Allow new users to sign up"**. A app já
   pede o link com `shouldCreateUser: false`, só entra quem foi adicionado.
4. **Adicionar pessoas.** Authentication → Users → "Add user" / "Invite user" com o email. Depois,
   no SQL Editor:
   ```sql
   insert into public.stores (name) values ('Nome da loja') returning id;
   insert into public.profiles (id, store_id, name, role, weekly_hours)
   values ('<id do auth.users>', '<id da loja>', 'Nome', 'worker', 40);
   -- role: 'worker' ou 'manager'
   ```
5. **Realtime:** as migrações juntam `shifts`, `swap_requests`, `swap_request_events` e
   `notifications` à publicação `supabase_realtime`. Confirma em Database → Publications.
6. **Notificações push:** ver a secção seguinte.

## Notificações

As notificações são criadas pela base de dados (trigger em `swap_requests`):

| Acontecimento     | Quem recebe                                                            |
| ----------------- | ---------------------------------------------------------------------- |
| Pedido criado     | os trabalhadores da loja, exceto quem pediu ("cobrir falta" é urgente) |
| Pedido aceite     | quem pediu e a gerência                                                |
| Aprovado/recusado | quem pediu e quem aceitou                                              |
| Cancelado         | quem tinha aceitado                                                    |

Na web e na app aparecem em tempo real, no separador "Notificações". Para chegarem também por
**push ao telemóvel**:

1. **Publicar a Edge Function:**
   ```bash
   pnpm functions:deploy        # = npx supabase functions deploy send-push --no-verify-jwt
   ```
2. **Definir o segredo** que o webhook vai enviar (gera um valor aleatório, por exemplo com
   `openssl rand -hex 32`):
   ```bash
   npx supabase secrets set PUSH_WEBHOOK_SECRET=<valor>
   # opcional, se ativares "enhanced security" na Expo:
   npx supabase secrets set EXPO_ACCESS_TOKEN=<token>
   ```
   O `SUPABASE_URL` e o `SUPABASE_SERVICE_ROLE_KEY` já existem nas Edge Functions. Não os
   copies para lado nenhum.
3. **Criar o Database Webhook** (Database → Webhooks → Create a new hook):
   - Tabela `public.notifications`, evento **Insert**
   - Tipo: Supabase Edge Functions → `send-push`, método POST
   - HTTP Header: `x-webhook-secret` com o mesmo valor do passo 2
4. **App mobile:**
   - Corre `npx eas init` em `apps/mobile`, que preenche `extra.eas.projectId` no `app.json`.
     O token de push precisa deste id.
   - **Android:** desde o SDK 53, o Expo Go não recebe push remotas. Usa uma development build
     (`npx expo run:android` ou `npx eas build --profile development`).
   - **iOS:** usa também uma development build, para teres o comportamento real.
   - A app pede autorização no separador "Notificações" ("Ativar notificações") e regista o
     token com a RPC `register_push_token`. Ao sair da conta, o token é removido.
5. **Web:** não há push no browser nesta fase. As notificações aparecem dentro da app, em tempo
   real.

Para testar a função localmente: `pnpm functions:test` (testes Deno, sem rede) ou
`npx supabase functions serve send-push --env-file supabase/functions/.env` (não faças commit
desse `.env`).

## Comandos

| Comando           | O que faz                                        |
| ----------------- | ------------------------------------------------ |
| `pnpm dev`        | web + mobile em paralelo (Turborepo)             |
| `pnpm dev:web`    | só a web                                         |
| `pnpm dev:mobile` | só o Expo                                        |
| `pnpm build`      | build de produção (web)                          |
| `pnpm lint`       | ESLint em todos os pacotes                       |
| `pnpm typecheck`  | TypeScript (strict) em todos os pacotes          |
| `pnpm test`       | Vitest (`packages/shared`)                       |
| `pnpm format`     | Prettier                                         |
| `pnpm db:check`   | verificações de RLS/RPC contra o Supabase local  |
| `pnpm gen:types`  | regenera `packages/shared/src/types/database.ts` |

## Problemas comuns

- **"Configuração em falta"** no ecrã: falta o `.env.local` (web) ou `.env` (mobile), ou o Expo
  foi arrancado antes de o criares (para o Expo, reinicia com `pnpm --filter @turno/mobile exec expo start --clear`).
- **"Este email não está registado"**: a pessoa não existe em `auth.users` (ver passo 4 acima).
- **"Conta sem perfil"**: existe em `auth.users` mas não tem linha em `profiles`.
- **Metro não encontra um módulo** no monorepo: tenta `pnpm --filter @turno/mobile exec expo start --clear`. Se persistir,
  acrescenta `node-linker=hoisted` ao `.npmrc`, apaga os `node_modules` e corre `pnpm install`.
