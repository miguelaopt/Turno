-- =============================================================================
-- Turno — migração inicial (fase 1)
--
-- Tabelas: stores, profiles, shifts, swap_requests, push_tokens
-- Regras de acesso (RLS):
--   * Cada pessoa só lê linhas do seu store_id.
--   * Só se criam pedidos de troca sobre turnos próprios.
--   * Qualquer worker da loja pode aceitar um pedido, exceto quem o fez.
--   * Só role = 'manager' aprova ou recusa.
--   * As mudanças de estado de um pedido passam SEMPRE pela função
--     public.transition_swap_request (RPC); o cliente não tem UPDATE direto.
--
-- Nota: o Turno não se liga ao portal interno da empresa (MPI). Cada pessoa
-- regista os seus próprios turnos.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Schema privado para funções auxiliares (não exposto pela API do PostgREST)
-- -----------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
create type public.user_role as enum ('worker', 'manager');
create type public.shift_source as enum ('manual', 'screenshot');
create type public.swap_type as enum ('swap', 'give', 'cover');
create type public.swap_status as enum ('open', 'accepted', 'approved', 'rejected', 'cancelled');
create type public.push_platform as enum ('ios', 'android', 'web');

-- -----------------------------------------------------------------------------
-- Tabelas
-- -----------------------------------------------------------------------------
create table public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 120),
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete restrict,
  name text not null check (char_length(trim(name)) between 1 and 120),
  role public.user_role not null default 'worker',
  weekly_hours integer not null default 40 check (weekly_hours between 0 and 168),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Permite FKs compostas (user_id, store_id) que garantem coerência de loja.
  unique (id, store_id)
);

create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  user_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  source public.shift_source not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shifts_ends_after_starts check (ends_at > starts_at),
  constraint shifts_max_duration check (ends_at - starts_at <= interval '16 hours'),
  -- O turno pertence a uma pessoa da mesma loja.
  constraint shifts_user_store_fk foreign key (user_id, store_id)
    references public.profiles (id, store_id) on update cascade on delete cascade,
  unique (id, store_id)
);

create table public.swap_requests (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  -- restrict: não se apaga um turno que tem histórico de pedidos (registo escrito).
  shift_id uuid not null,
  requester_id uuid not null references public.profiles (id) on delete restrict,
  type public.swap_type not null,
  status public.swap_status not null default 'open',
  accepted_by uuid references public.profiles (id) on delete restrict,
  decided_by uuid references public.profiles (id) on delete restrict,
  note text check (note is null or char_length(note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint swap_requests_shift_store_fk foreign key (shift_id, store_id)
    references public.shifts (id, store_id) on delete restrict,
  constraint swap_requests_requester_store_fk foreign key (requester_id, store_id)
    references public.profiles (id, store_id),
  constraint swap_requests_not_self_accept check (accepted_by is null or accepted_by <> requester_id),
  -- Coerência entre estado e colunas preenchidas.
  constraint swap_requests_status_consistency check (
    case status
      when 'open' then accepted_by is null and decided_by is null
      when 'accepted' then accepted_by is not null and decided_by is null
      when 'approved' then accepted_by is not null and decided_by is not null
      when 'rejected' then decided_by is not null
      when 'cancelled' then decided_by is null
    end
  )
);

create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  platform public.push_platform not null,
  token text not null unique check (char_length(token) between 1 and 4096),
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Índices
-- -----------------------------------------------------------------------------
create index profiles_store_id_idx on public.profiles (store_id);
create index shifts_store_starts_idx on public.shifts (store_id, starts_at);
create index shifts_user_starts_idx on public.shifts (user_id, starts_at);
create index swap_requests_store_status_idx on public.swap_requests (store_id, status, created_at desc);
create index swap_requests_shift_idx on public.swap_requests (shift_id);
create index swap_requests_requester_idx on public.swap_requests (requester_id);
create index swap_requests_accepted_by_idx on public.swap_requests (accepted_by) where accepted_by is not null;
create index swap_requests_decided_by_idx on public.swap_requests (decided_by) where decided_by is not null;
create index push_tokens_user_idx on public.push_tokens (user_id);
-- No máximo um pedido ativo (open/accepted) por turno.
create unique index swap_requests_one_active_per_shift
  on public.swap_requests (shift_id) where status in ('open', 'accepted');

-- -----------------------------------------------------------------------------
-- updated_at automático
-- -----------------------------------------------------------------------------
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();
create trigger shifts_set_updated_at before update on public.shifts
  for each row execute function private.set_updated_at();
create trigger swap_requests_set_updated_at before update on public.swap_requests
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Funções auxiliares para RLS (security definer para evitar recursão nas
-- políticas de profiles; search_path vazio para evitar sequestro de nomes).
-- -----------------------------------------------------------------------------
create or replace function private.current_store_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.store_id from public.profiles p where p.id = (select auth.uid());
$$;

create or replace function private.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles p where p.id = (select auth.uid());
$$;

revoke all on function private.current_store_id() from public;
revoke all on function private.current_user_role() from public;
grant execute on function private.current_store_id() to authenticated;
grant execute on function private.current_user_role() to authenticated;

-- -----------------------------------------------------------------------------
-- Privilégios de tabela: anon não tem acesso; authenticated só o necessário.
-- (O Supabase concede tudo por omissão; aqui restringimos explicitamente.)
-- -----------------------------------------------------------------------------
revoke all on public.stores, public.profiles, public.shifts, public.swap_requests, public.push_tokens
  from anon, authenticated;

grant select on public.stores to authenticated;
grant select on public.profiles to authenticated;
grant update (name) on public.profiles to authenticated;  -- role/loja/horas só via admin
grant select, delete on public.shifts to authenticated;
grant insert (store_id, user_id, starts_at, ends_at, source) on public.shifts to authenticated;
grant update (starts_at, ends_at, source) on public.shifts to authenticated;
grant select on public.swap_requests to authenticated;
grant insert (store_id, shift_id, requester_id, type, note) on public.swap_requests to authenticated;
grant select, delete on public.push_tokens to authenticated;
grant insert (user_id, platform, token) on public.push_tokens to authenticated;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.stores enable row level security;
alter table public.profiles enable row level security;
alter table public.shifts enable row level security;
alter table public.swap_requests enable row level security;
alter table public.push_tokens enable row level security;

-- stores: só a própria loja
create policy "stores: ler a própria loja"
  on public.stores for select to authenticated
  using (id = (select private.current_store_id()));

-- profiles: ler colegas da mesma loja; editar só o próprio nome
create policy "profiles: ler perfis da mesma loja"
  on public.profiles for select to authenticated
  using (store_id = (select private.current_store_id()));

create policy "profiles: editar o próprio perfil"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- shifts: ler turnos da loja; criar/editar/apagar só os próprios
create policy "shifts: ler turnos da mesma loja"
  on public.shifts for select to authenticated
  using (store_id = (select private.current_store_id()));

create policy "shifts: criar turnos próprios"
  on public.shifts for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and store_id = (select private.current_store_id())
  );

create policy "shifts: editar turnos próprios"
  on public.shifts for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and store_id = (select private.current_store_id())
  );

create policy "shifts: apagar turnos próprios"
  on public.shifts for delete to authenticated
  using (user_id = (select auth.uid()));

-- swap_requests: ler os da loja; criar só sobre turnos próprios.
-- Não há política de UPDATE nem DELETE: mudanças de estado só via RPC.
create policy "swap_requests: ler pedidos da mesma loja"
  on public.swap_requests for select to authenticated
  using (store_id = (select private.current_store_id()));

create policy "swap_requests: criar pedidos sobre turnos próprios"
  on public.swap_requests for insert to authenticated
  with check (
    requester_id = (select auth.uid())
    and store_id = (select private.current_store_id())
    and exists (
      select 1 from public.shifts s
      where s.id = shift_id
        and s.user_id = (select auth.uid())
        and s.store_id = swap_requests.store_id
    )
  );

-- push_tokens: cada pessoa gere apenas os seus
create policy "push_tokens: ler os próprios"
  on public.push_tokens for select to authenticated
  using (user_id = (select auth.uid()));

create policy "push_tokens: registar os próprios"
  on public.push_tokens for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "push_tokens: apagar os próprios"
  on public.push_tokens for delete to authenticated
  using (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- RPC: transição de estado de um pedido de troca
--
--   open     -> accepted   worker da loja, que não seja quem pediu
--   open     -> cancelled  quem pediu
--   accepted -> cancelled  quem pediu
--   accepted -> approved   manager da loja
--   open     -> rejected   manager da loja
--   accepted -> rejected   manager da loja
--
-- Qualquer outra transição é recusada. A função não altera os turnos: o que
-- acontece aos turnos após a aprovação é decidido na fase 2.
-- -----------------------------------------------------------------------------
create or replace function public.transition_swap_request(
  p_request_id uuid,
  p_status public.swap_status
)
returns public.swap_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_me public.profiles;
  v_req public.swap_requests;
begin
  if v_uid is null then
    raise exception 'Sessão inválida.' using errcode = '42501';
  end if;

  select * into v_me from public.profiles where id = v_uid;
  if not found then
    raise exception 'Perfil não encontrado.' using errcode = '42501';
  end if;

  -- Bloqueia a linha para evitar corridas (ex.: duas pessoas a aceitar).
  select * into v_req from public.swap_requests where id = p_request_id for update;
  if not found or v_req.store_id <> v_me.store_id then
    raise exception 'Pedido não encontrado.' using errcode = 'P0002';
  end if;

  if v_req.status = 'open' and p_status = 'accepted' then
    if v_me.role <> 'worker' then
      raise exception 'Só trabalhadores podem aceitar pedidos.' using errcode = '42501';
    end if;
    if v_req.requester_id = v_uid then
      raise exception 'Não podes aceitar o teu próprio pedido.' using errcode = '42501';
    end if;
    update public.swap_requests
      set status = 'accepted', accepted_by = v_uid
      where id = p_request_id
      returning * into v_req;

  elsif v_req.status in ('open', 'accepted') and p_status = 'cancelled' then
    if v_req.requester_id <> v_uid then
      raise exception 'Só quem fez o pedido o pode cancelar.' using errcode = '42501';
    end if;
    update public.swap_requests
      set status = 'cancelled'
      where id = p_request_id
      returning * into v_req;

  elsif (v_req.status = 'accepted' and p_status = 'approved')
     or (v_req.status in ('open', 'accepted') and p_status = 'rejected') then
    if v_me.role <> 'manager' then
      raise exception 'Só a gerência pode aprovar ou recusar pedidos.' using errcode = '42501';
    end if;
    update public.swap_requests
      set status = p_status, decided_by = v_uid
      where id = p_request_id
      returning * into v_req;

  else
    raise exception 'Transição inválida: % -> %.', v_req.status, p_status using errcode = '22023';
  end if;

  return v_req;
end;
$$;

revoke all on function public.transition_swap_request(uuid, public.swap_status) from public, anon;
grant execute on function public.transition_swap_request(uuid, public.swap_status) to authenticated;

-- -----------------------------------------------------------------------------
-- Realtime: as apps subscrevem alterações em shifts e swap_requests.
-- (O Realtime aplica as políticas RLS de SELECT a INSERT/UPDATE.)
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.shifts, public.swap_requests;
  end if;
end;
$$;
