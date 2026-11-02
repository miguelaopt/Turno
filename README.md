# Turno

App para a equipa de um restaurante pedir, aceitar e aprovar trocas de turno, com registo escrito
de tudo. Existe em duas versões sempre sincronizadas: **site** (Next.js) e **app de telemóvel**
(Expo). O Supabase é a única fonte de verdade.

> O Turno **não substitui nem se liga** ao portal interno da empresa (MPI). Cada pessoa regista
> os seus próprios turnos; depois de aprovar uma troca, a gerente atualiza o MPI à mão.

**Estado:** fase 1 — login por magic link e "Os meus turnos" (criar, editar, apagar) com
sincronização em tempo real entre web e mobile. Trocas, aprovações e notificações são a fase 2.

## Estrutura

```
apps/web         Next.js (App Router) + Tailwind + shadcn/ui
apps/mobile      Expo (Expo Router)
packages/shared  tipos da BD, zod, queries, Realtime, regras de horas/descanso, tokens de design
supabase/        migrações SQL, seed, verificações de RLS, config do CLI
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

O seed cria a loja "Restaurante Exemplo — Baixa", a gerente `gerente@turno.test` e os
trabalhadores `ana@turno.test`, `bruno@turno.test` e `carla@turno.test`, com turnos na semana
atual. Os emails do magic link aparecem no Mailpit/Inbucket: <http://127.0.0.1:54324>.

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

1. **Aplicar a migração.** Com o CLI:
   ```bash
   npx supabase link --project-ref <ref-do-projeto>
   npx supabase db push
   ```
   Ou copia `supabase/migrations/20261102120000_initial_schema.sql` para o SQL Editor e executa.
   **Não** corras o `seed.sql` num projeto real (cria utilizadores de teste em `auth.users`).
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
5. **Realtime:** a migração junta `shifts` e `swap_requests` à publicação `supabase_realtime`.
   Confirma em Database → Publications.

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
