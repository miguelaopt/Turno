-- =============================================================================
-- Turno — fase 2: fluxo de trocas, histórico e notificações
--
--  * swap_requests ganha: offered_shift_id (o turno que quem aceita dá em troca,
--    só para type = 'swap'), datas de aceitação/decisão, nota da decisão e o
--    registo de "MPI atualizado" pela gerente.
--  * transition_swap_request passa a aceitar o turno oferecido e uma nota, e a
--    aprovação reatribui os turnos no Turno (o MPI continua a ser atualizado à
--    mão pela gerente, que o regista com mark_swap_mpi_updated).
--  * swap_request_events: histórico só de leitura (registo escrito de tudo).
--  * notifications: notificações na app, geradas pela base de dados. Um Database
--    Webhook em INSERT envia-as por push (supabase/functions/send-push).
--  * register_push_token / unregister_push_token para a app mobile.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- swap_requests: novas colunas e restrições
-- -----------------------------------------------------------------------------
alter table public.swap_requests
  add column offered_shift_id uuid,
  add column accepted_at timestamptz,
  add column decided_at timestamptz,
  add column decision_note text check (decision_note is null or char_length(decision_note) <= 1000),
  add column mpi_updated_at timestamptz,
  add column mpi_updated_by uuid references public.profiles (id) on delete restrict,
  add constraint swap_requests_offered_shift_store_fk foreign key (offered_shift_id, store_id)
    references public.shifts (id, store_id) on delete restrict,
  add constraint swap_requests_offered_only_for_swap
    check (offered_shift_id is null or type = 'swap'),
  add constraint swap_requests_offered_not_same
    check (offered_shift_id is null or offered_shift_id <> shift_id),
  -- Uma troca aceite tem sempre um turno oferecido.
  add constraint swap_requests_swap_has_offer
    check (type <> 'swap' or status not in ('accepted', 'approved') or offered_shift_id is not null),
  add constraint swap_requests_mpi_only_when_approved
    check (mpi_updated_at is null or status = 'approved'),
  add constraint swap_requests_mpi_consistency
    check ((mpi_updated_at is null) = (mpi_updated_by is null));

create index swap_requests_offered_shift_idx on public.swap_requests (offered_shift_id)
  where offered_shift_id is not null;
-- Um turno só pode estar oferecido num pedido aceite de cada vez.
create unique index swap_requests_one_accepted_offer
  on public.swap_requests (offered_shift_id) where status = 'accepted';
create index swap_requests_mpi_pending_idx on public.swap_requests (store_id)
  where status = 'approved' and mpi_updated_at is null;

-- -----------------------------------------------------------------------------
-- Formatação pt-PT de turnos para textos gerados na BD (notificações).
-- Ex.: "qui., 5 nov., 07:00–15:00"
-- -----------------------------------------------------------------------------
create or replace function private.format_shift(p_starts timestamptz, p_ends timestamptz)
returns text
language sql
stable -- depende dos dados de fuso horário
set search_path = ''
as $$
  select
    (array['seg.', 'ter.', 'qua.', 'qui.', 'sex.', 'sáb.', 'dom.'])[extract(isodow from l.s)::int]
    || ', ' || extract(day from l.s)::int || ' '
    || (array['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'])[extract(month from l.s)::int]
    || ', ' || to_char(l.s, 'HH24:MI') || '–' || to_char(l.e, 'HH24:MI')
  from (select p_starts at time zone 'Europe/Lisbon' as s, p_ends at time zone 'Europe/Lisbon' as e) l;
$$;

-- -----------------------------------------------------------------------------
-- Validações ao criar pedidos (correm depois das políticas RLS)
-- -----------------------------------------------------------------------------
create or replace function private.validate_new_swap_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_starts timestamptz;
begin
  select s.starts_at into v_starts from public.shifts s where s.id = new.shift_id;
  if v_starts is null or v_starts <= now() then
    raise exception 'Só podes pedir trocas de turnos que ainda não começaram.' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.swap_requests r
    where r.offered_shift_id = new.shift_id and r.status = 'accepted'
  ) then
    raise exception 'Este turno está oferecido noutra troca em curso.' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger swap_requests_validate_insert
  before insert on public.swap_requests
  for each row execute function private.validate_new_swap_request();

-- -----------------------------------------------------------------------------
-- Não se mudam as horas de um turno com um pedido em curso: quem aceitou
-- aceitou aquelas horas. (Apagar já é impedido pela FK com restrict.)
-- -----------------------------------------------------------------------------
create or replace function private.lock_shift_with_active_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.starts_at, new.ends_at) is distinct from (old.starts_at, old.ends_at)
     and exists (
       select 1 from public.swap_requests r
       where (r.shift_id = old.id and r.status in ('open', 'accepted'))
          or (r.offered_shift_id = old.id and r.status = 'accepted')
     ) then
    raise exception 'Este turno tem um pedido de troca em curso. Cancela o pedido antes de mudar as horas.'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger shifts_lock_with_active_request
  before update of starts_at, ends_at on public.shifts
  for each row execute function private.lock_shift_with_active_request();

-- -----------------------------------------------------------------------------
-- Máquina de estados (substitui a versão da fase 1)
--
--   open     -> accepted   worker da loja, que não seja quem pediu; o turno
--                          ainda não começou; para 'swap' indica o turno que
--                          oferece (seu, futuro, sem outro pedido em curso)
--   open     -> cancelled  quem pediu
--   accepted -> cancelled  quem pediu
--   accepted -> approved   manager da loja (não pode ser quem pediu); reatribui
--                          o turno a quem aceitou e, se for 'swap', o turno
--                          oferecido a quem pediu
--   open     -> rejected   manager da loja (não pode ser quem pediu)
--   accepted -> rejected   idem
-- -----------------------------------------------------------------------------
drop function public.transition_swap_request(uuid, public.swap_status);

create function public.transition_swap_request(
  p_request_id uuid,
  p_status public.swap_status,
  p_offered_shift_id uuid default null,
  p_note text default null
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
  v_shift public.shifts;
  v_offered public.shifts;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
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

  select * into v_shift from public.shifts where id = v_req.shift_id for update;

  -- ------------------------------------------------------------- aceitar
  if v_req.status = 'open' and p_status = 'accepted' then
    if v_me.role <> 'worker' then
      raise exception 'Só trabalhadores podem aceitar pedidos.' using errcode = '42501';
    end if;
    if v_req.requester_id = v_uid then
      raise exception 'Não podes aceitar o teu próprio pedido.' using errcode = '42501';
    end if;
    if v_shift.starts_at <= now() then
      raise exception 'Este turno já começou.' using errcode = '22023';
    end if;

    if v_req.type = 'swap' then
      if p_offered_shift_id is null then
        raise exception 'Para uma troca, escolhe um dos teus turnos para dar em troca.' using errcode = '22023';
      end if;
      select * into v_offered from public.shifts where id = p_offered_shift_id for update;
      if not found or v_offered.user_id <> v_uid or v_offered.store_id <> v_req.store_id then
        raise exception 'O turno oferecido tem de ser teu.' using errcode = '42501';
      end if;
      if v_offered.starts_at <= now() then
        raise exception 'O turno oferecido já começou.' using errcode = '22023';
      end if;
      if exists (
        select 1 from public.swap_requests r
        where r.id <> v_req.id
          and ((r.shift_id = v_offered.id and r.status in ('open', 'accepted'))
            or (r.offered_shift_id = v_offered.id and r.status = 'accepted'))
      ) then
        raise exception 'O turno oferecido já tem uma troca em curso.' using errcode = '22023';
      end if;
    elsif p_offered_shift_id is not null then
      raise exception 'Só se oferece um turno em pedidos de troca.' using errcode = '22023';
    end if;

    update public.swap_requests
      set status = 'accepted',
          accepted_by = v_uid,
          accepted_at = now(),
          offered_shift_id = p_offered_shift_id
      where id = p_request_id
      returning * into v_req;

  -- ------------------------------------------------------------- cancelar
  elsif v_req.status in ('open', 'accepted') and p_status = 'cancelled' then
    if v_req.requester_id <> v_uid then
      raise exception 'Só quem fez o pedido o pode cancelar.' using errcode = '42501';
    end if;
    update public.swap_requests
      set status = 'cancelled', decision_note = v_note
      where id = p_request_id
      returning * into v_req;

  -- ----------------------------------------------------- aprovar / recusar
  elsif (v_req.status = 'accepted' and p_status = 'approved')
     or (v_req.status in ('open', 'accepted') and p_status = 'rejected') then
    if v_me.role <> 'manager' then
      raise exception 'Só a gerência pode aprovar ou recusar pedidos.' using errcode = '42501';
    end if;
    if v_req.requester_id = v_uid then
      raise exception 'Não podes decidir um pedido teu.' using errcode = '42501';
    end if;

    if p_status = 'approved' then
      if v_shift.user_id <> v_req.requester_id then
        raise exception 'O turno já não pertence a quem fez o pedido.' using errcode = '22023';
      end if;
      if v_req.type = 'swap' then
        select * into v_offered from public.shifts where id = v_req.offered_shift_id for update;
        if not found or v_offered.user_id <> v_req.accepted_by then
          raise exception 'O turno oferecido já não pertence a quem aceitou.' using errcode = '22023';
        end if;
        update public.shifts set user_id = v_req.requester_id where id = v_offered.id;
      end if;
      update public.shifts set user_id = v_req.accepted_by where id = v_shift.id;
    end if;

    update public.swap_requests
      set status = p_status,
          decided_by = v_uid,
          decided_at = now(),
          decision_note = v_note
      where id = p_request_id
      returning * into v_req;

  else
    raise exception 'Transição inválida: % -> %.', v_req.status, p_status using errcode = '22023';
  end if;

  return v_req;
end;
$$;

revoke all on function public.transition_swap_request(uuid, public.swap_status, uuid, text) from public, anon;
grant execute on function public.transition_swap_request(uuid, public.swap_status, uuid, text) to authenticated;

-- A gerente regista que já atualizou o MPI à mão.
create function public.mark_swap_mpi_updated(p_request_id uuid)
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
  select * into v_me from public.profiles where id = v_uid;
  if not found or v_me.role <> 'manager' then
    raise exception 'Só a gerência regista atualizações do MPI.' using errcode = '42501';
  end if;
  select * into v_req from public.swap_requests where id = p_request_id for update;
  if not found or v_req.store_id <> v_me.store_id then
    raise exception 'Pedido não encontrado.' using errcode = 'P0002';
  end if;
  if v_req.status <> 'approved' then
    raise exception 'Só pedidos aprovados passam para o MPI.' using errcode = '22023';
  end if;
  if v_req.mpi_updated_at is not null then
    return v_req;
  end if;
  update public.swap_requests
    set mpi_updated_at = now(), mpi_updated_by = v_uid
    where id = p_request_id
    returning * into v_req;
  return v_req;
end;
$$;

revoke all on function public.mark_swap_mpi_updated(uuid) from public, anon;
grant execute on function public.mark_swap_mpi_updated(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Histórico de pedidos (só de leitura para os clientes)
-- -----------------------------------------------------------------------------
create type public.swap_event_kind as enum (
  'created', 'accepted', 'approved', 'rejected', 'cancelled', 'mpi_updated'
);

create table public.swap_request_events (
  id bigint generated always as identity primary key,
  store_id uuid not null references public.stores (id) on delete cascade,
  swap_request_id uuid not null references public.swap_requests (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete restrict,
  kind public.swap_event_kind not null,
  note text,
  created_at timestamptz not null default now()
);

create index swap_request_events_request_idx
  on public.swap_request_events (swap_request_id, created_at);

-- -----------------------------------------------------------------------------
-- Notificações na app (e push, via Database Webhook → Edge Function)
-- -----------------------------------------------------------------------------
create type public.notification_kind as enum (
  'swap_open', 'swap_accepted', 'swap_to_decide', 'swap_approved', 'swap_rejected', 'swap_cancelled'
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  swap_request_id uuid references public.swap_requests (id) on delete cascade,
  kind public.notification_kind not null,
  title text not null,
  body text not null,
  urgent boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index notifications_user_unread_idx on public.notifications (user_id) where read_at is null;

-- -----------------------------------------------------------------------------
-- Trigger: cada mudança num pedido gera um evento e as notificações certas.
-- -----------------------------------------------------------------------------
create or replace function private.on_swap_request_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Sem sessão (ex.: seed ou SQL do painel), deduz o autor pelo estado.
  v_actor uuid := coalesce(
    (select auth.uid()),
    case new.status
      when 'accepted' then new.accepted_by
      when 'approved' then new.decided_by
      when 'rejected' then new.decided_by
      else new.requester_id
    end
  );
  v_shift public.shifts;
  v_when text;
  v_requester text;
  v_acceptor text;
  v_decider text;
  v_kind public.swap_event_kind;
  v_type_label text;
begin
  select * into v_shift from public.shifts where id = new.shift_id;
  v_when := private.format_shift(v_shift.starts_at, v_shift.ends_at);
  select name into v_requester from public.profiles where id = new.requester_id;
  select name into v_acceptor from public.profiles where id = new.accepted_by;
  select name into v_decider from public.profiles where id = new.decided_by;
  v_type_label := case new.type
    when 'swap' then 'Pedido de troca'
    when 'give' then 'Turno disponível'
    when 'cover' then 'Cobrir falta'
  end;

  if tg_op = 'INSERT' then
    insert into public.swap_request_events (store_id, swap_request_id, actor_id, kind, note)
    values (new.store_id, new.id, new.requester_id, 'created', new.note);

    -- Todos os trabalhadores da loja, exceto quem pediu.
    insert into public.notifications (store_id, user_id, swap_request_id, kind, title, body, urgent)
    select new.store_id, p.id, new.id, 'swap_open',
           v_type_label || ': ' || v_when,
           v_requester || coalesce(' — ' || new.note, '') ,
           new.type = 'cover'
    from public.profiles p
    where p.store_id = new.store_id and p.role = 'worker' and p.id <> new.requester_id;
    return new;
  end if;

  -- UPDATE: registo de "MPI atualizado"
  if new.mpi_updated_at is not null and old.mpi_updated_at is null then
    insert into public.swap_request_events (store_id, swap_request_id, actor_id, kind)
    values (new.store_id, new.id, new.mpi_updated_by, 'mpi_updated');
  end if;

  if new.status is not distinct from old.status then
    return new;
  end if;

  v_kind := new.status::text::public.swap_event_kind;
  insert into public.swap_request_events (store_id, swap_request_id, actor_id, kind, note)
  values (
    new.store_id, new.id, v_actor, v_kind,
    case when new.status in ('approved', 'rejected', 'cancelled') then new.decision_note end
  );

  if new.status = 'accepted' then
    insert into public.notifications (store_id, user_id, swap_request_id, kind, title, body)
    values (new.store_id, new.requester_id, new.id, 'swap_accepted',
            'O teu pedido foi aceite',
            v_acceptor || ' aceitou o turno de ' || v_when || '. Falta a aprovação da gerência.');

    insert into public.notifications (store_id, user_id, swap_request_id, kind, title, body, urgent)
    select new.store_id, p.id, new.id, 'swap_to_decide',
           'Pedido para aprovar: ' || v_when,
           v_acceptor || ' aceitou o pedido de ' || v_requester || ' (' || lower(v_type_label) || ').',
           new.type = 'cover'
    from public.profiles p
    where p.store_id = new.store_id and p.role = 'manager';

  elsif new.status in ('approved', 'rejected') then
    insert into public.notifications (store_id, user_id, swap_request_id, kind, title, body)
    select new.store_id, u.id, new.id,
           case new.status when 'approved' then 'swap_approved'::public.notification_kind
                           else 'swap_rejected'::public.notification_kind end,
           case new.status when 'approved' then 'Pedido aprovado' else 'Pedido recusado' end,
           v_when || ' — ' ||
             case new.status when 'approved' then 'aprovado' else 'recusado' end
             || ' por ' || coalesce(v_decider, 'gerência') || '.'
             || coalesce(' ' || new.decision_note, '')
    from (select new.requester_id as id union select new.accepted_by) u
    where u.id is not null;

  elsif new.status = 'cancelled' and new.accepted_by is not null then
    insert into public.notifications (store_id, user_id, swap_request_id, kind, title, body)
    values (new.store_id, new.accepted_by, new.id, 'swap_cancelled',
            'Pedido cancelado',
            v_requester || ' cancelou o pedido de ' || v_when || '.');
  end if;

  return new;
end;
$$;

create trigger swap_requests_after_insert
  after insert on public.swap_requests
  for each row execute function private.on_swap_request_change();

create trigger swap_requests_after_update
  after update on public.swap_requests
  for each row execute function private.on_swap_request_change();

-- -----------------------------------------------------------------------------
-- Tokens de push: registar/remover via RPC (um token passa para a última
-- pessoa que entrou nesse dispositivo).
-- -----------------------------------------------------------------------------
create function public.register_push_token(p_token text, p_platform public.push_platform)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null or not exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'Perfil não encontrado.' using errcode = '42501';
  end if;
  if p_token is null or char_length(p_token) not between 1 and 4096 then
    raise exception 'Token inválido.' using errcode = '22023';
  end if;
  delete from public.push_tokens where token = p_token and user_id <> v_uid;
  insert into public.push_tokens (user_id, platform, token)
  values (v_uid, p_platform, p_token)
  on conflict (token) do nothing;
end;
$$;

create function public.unregister_push_token(p_token text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.push_tokens where token = p_token and user_id = (select auth.uid());
$$;

revoke all on function public.register_push_token(text, public.push_platform) from public, anon;
revoke all on function public.unregister_push_token(text) from public, anon;
grant execute on function public.register_push_token(text, public.push_platform) to authenticated;
grant execute on function public.unregister_push_token(text) to authenticated;

-- -----------------------------------------------------------------------------
-- Privilégios e RLS das tabelas novas
-- -----------------------------------------------------------------------------
revoke all on public.swap_request_events, public.notifications from anon, authenticated;
grant select on public.swap_request_events to authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

alter table public.swap_request_events enable row level security;
alter table public.notifications enable row level security;

create policy "swap_request_events: ler os da mesma loja"
  on public.swap_request_events for select to authenticated
  using (store_id = (select private.current_store_id()));

create policy "notifications: ler as próprias"
  on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));

create policy "notifications: marcar as próprias como lidas"
  on public.notifications for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- Realtime
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.notifications, public.swap_request_events;
  end if;
end;
$$;
