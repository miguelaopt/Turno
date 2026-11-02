-- =============================================================================
-- Verificações de RLS e da RPC transition_swap_request.
--
-- Corre contra uma base com a migração e o seed aplicados (Supabase local):
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/checks/rls_checks.sql
-- Tudo corre numa transação que é revertida no fim: não deixa dados.
-- Termina com erro na primeira verificação que falhar.
-- =============================================================================
\set ON_ERROR_STOP on
\set QUIET on
\pset tuples_only on
\pset format unaligned
begin;

-- Segunda loja + pessoa de outra loja, para testar isolamento.
insert into public.stores (id, name) values ('00000000-0000-4000-8000-000000000002', 'Outra loja');
insert into auth.users (id, aud, role, email) values
  ('00000000-0000-4000-8000-0000000000c1', 'authenticated', 'authenticated', 'outra@turno.test');
insert into public.profiles (id, store_id, name, role) values
  ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-000000000002', 'Pessoa de Fora', 'worker');
insert into public.shifts (store_id, user_id, starts_at, ends_at) values
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-0000000000c1', now(), now() + interval '4 hours');

create function pg_temp.as_user(p_id uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_id::text, true);
  execute 'set local role authenticated';
end; $$;

create function pg_temp.expect_error(p_sql text, p_label text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    raise notice 'ok  % (%)', p_label, sqlerrm;
    return;
  end;
  raise exception 'FALHOU (devia dar erro): %', p_label;
end; $$;

create function pg_temp.expect(p_cond boolean, p_label text) returns void language plpgsql as $$
begin
  if p_cond is distinct from true then
    raise exception 'FALHOU: %', p_label;
  end if;
  raise notice 'ok  %', p_label;
end; $$;

-- ---------------------------------------------------------------- Ana (worker)
select pg_temp.as_user('00000000-0000-4000-8000-0000000000b1');

select pg_temp.expect((select count(*) from public.stores) = 1, 'Ana só vê a sua loja');
select pg_temp.expect((select count(*) from public.profiles) = 4, 'Ana vê os 4 perfis da loja');
select pg_temp.expect(
  not exists (select 1 from public.shifts where store_id = '00000000-0000-4000-8000-000000000002'),
  'Ana não vê turnos de outra loja');
select pg_temp.expect((select count(*) from public.shifts) = 9, 'Ana vê os turnos da loja');

-- Criar turno próprio
insert into public.shifts (store_id, user_id, starts_at, ends_at)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000b1',
        '2030-01-07 09:00+00', '2030-01-07 17:00+00');
select pg_temp.expect(true, 'Ana cria um turno próprio');

select pg_temp.expect_error($q$
  insert into public.shifts (store_id, user_id, starts_at, ends_at)
  values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000b2',
          '2030-01-07 09:00+00', '2030-01-07 17:00+00') $q$, 'Ana não cria turnos para o Bruno');

select pg_temp.expect_error($q$
  insert into public.shifts (store_id, user_id, starts_at, ends_at)
  values ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-0000000000b1',
          '2030-01-07 09:00+00', '2030-01-07 17:00+00') $q$, 'Ana não cria turnos noutra loja');

select pg_temp.expect_error($q$
  insert into public.shifts (store_id, user_id, starts_at, ends_at)
  values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000b1',
          '2030-01-07 17:00+00', '2030-01-07 09:00+00') $q$, 'Turno que acaba antes de começar é recusado');

-- Editar/apagar turnos alheios não tem efeito (RLS filtra as linhas)
with u as (
  update public.shifts set starts_at = starts_at + interval '1 hour'
  where user_id = '00000000-0000-4000-8000-0000000000b2' returning 1)
select pg_temp.expect((select count(*) from u) = 0, 'Ana não edita turnos do Bruno');

with d as (
  delete from public.shifts where user_id = '00000000-0000-4000-8000-0000000000b2' returning 1)
select pg_temp.expect((select count(*) from d) = 0, 'Ana não apaga turnos do Bruno');

select pg_temp.expect_error($q$
  update public.shifts set user_id = '00000000-0000-4000-8000-0000000000b2'
  where user_id = '00000000-0000-4000-8000-0000000000b1' $q$, 'Ana não muda o dono de um turno');

select pg_temp.expect_error($q$
  update public.profiles set role = 'manager' where id = '00000000-0000-4000-8000-0000000000b1' $q$,
  'Ana não se promove a manager');

with u as (
  update public.profiles set name = 'Ana M.' where id = '00000000-0000-4000-8000-0000000000b1' returning 1)
select pg_temp.expect((select count(*) from u) = 1, 'Ana muda o próprio nome');

-- Pedidos de troca
select pg_temp.expect_error($q$
  insert into public.swap_requests (store_id, shift_id, requester_id, type)
  select store_id, id, '00000000-0000-4000-8000-0000000000b1', 'give'
  from public.shifts where user_id = '00000000-0000-4000-8000-0000000000b2' limit 1 $q$,
  'Ana não cria pedido sobre turno do Bruno');

insert into public.swap_requests (store_id, shift_id, requester_id, type, note)
select store_id, id, '00000000-0000-4000-8000-0000000000b1', 'give', 'Consulta médica'
from public.shifts where user_id = '00000000-0000-4000-8000-0000000000b1'
order by starts_at limit 1;
select pg_temp.expect(true, 'Ana cria pedido sobre turno próprio');

select pg_temp.expect_error($q$
  insert into public.swap_requests (store_id, shift_id, requester_id, type, status)
  select store_id, id, '00000000-0000-4000-8000-0000000000b1', 'give', 'approved'
  from public.shifts where user_id = '00000000-0000-4000-8000-0000000000b1'
  order by starts_at desc limit 1 $q$, 'Ana não cria pedido já aprovado');

select pg_temp.expect_error($q$
  update public.swap_requests set status = 'approved' $q$, 'UPDATE direto em swap_requests é recusado');

select pg_temp.expect_error($q$
  select public.transition_swap_request((select id from public.swap_requests limit 1), 'accepted') $q$,
  'Ana não aceita o próprio pedido');

select pg_temp.expect_error($q$
  select public.transition_swap_request((select id from public.swap_requests limit 1), 'approved') $q$,
  'Ana não aprova pedidos');

select pg_temp.expect_error($q$
  select public.transition_swap_request((select id from public.swap_requests limit 1), 'rejected') $q$,
  'Ana não recusa pedidos (só a gerência)');

-- ------------------------------------------------------ Pessoa de outra loja
reset role;
select pg_temp.as_user('00000000-0000-4000-8000-0000000000c1');
select pg_temp.expect((select count(*) from public.swap_requests) = 0, 'Outra loja não vê pedidos');
select pg_temp.expect_error($q$
  select public.transition_swap_request(
    (select id from public.swap_requests where requester_id = '00000000-0000-4000-8000-0000000000b1'), 'accepted') $q$,
  'Outra loja não aceita pedidos');

-- ------------------------------------------------------------- Bruno (worker)
reset role;
select pg_temp.as_user('00000000-0000-4000-8000-0000000000b2');
select pg_temp.expect(
  (select status from public.transition_swap_request((select id from public.swap_requests limit 1), 'accepted')) = 'accepted',
  'Bruno aceita o pedido da Ana');
select pg_temp.expect_error($q$
  select public.transition_swap_request((select id from public.swap_requests limit 1), 'approved') $q$,
  'Bruno não aprova');
select pg_temp.expect_error($q$
  select public.transition_swap_request((select id from public.swap_requests limit 1), 'cancelled') $q$,
  'Bruno não cancela o pedido da Ana');

-- ----------------------------------------------------------- Helena (manager)
reset role;
select pg_temp.as_user('00000000-0000-4000-8000-0000000000a1');
select pg_temp.expect_error($q$
  select public.transition_swap_request((select id from public.swap_requests limit 1), 'accepted') $q$,
  'Transição accepted -> accepted é inválida');
select pg_temp.expect(
  (select decided_by from public.transition_swap_request((select id from public.swap_requests limit 1), 'approved'))
    = '00000000-0000-4000-8000-0000000000a1',
  'Helena aprova e fica registada como decisora');
select pg_temp.expect_error($q$
  select public.transition_swap_request((select id from public.swap_requests limit 1), 'rejected') $q$,
  'Pedido aprovado não volta a mudar');

-- ------------------------------------------------------------ anon (sem sessão)
reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role anon;
select pg_temp.expect_error('select 1 from public.shifts', 'anon não lê turnos');
select pg_temp.expect_error($q$
  select public.transition_swap_request(gen_random_uuid(), 'accepted') $q$, 'anon não chama a RPC');

reset role;
rollback;
\echo 'Todas as verificações de RLS passaram.'
