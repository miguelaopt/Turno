-- =============================================================================
-- Verificações de RLS, RPCs, histórico e notificações.
--
-- Corre contra uma base com as migrações e o seed aplicados (Supabase local):
--   pnpm db:check
-- Tudo corre numa transação que é revertida no fim: não deixa dados.
-- Termina com erro na primeira verificação que falhar.
-- =============================================================================
\set ON_ERROR_STOP on
\set QUIET on
\pset tuples_only on
\pset format unaligned
\o /dev/null
begin;

-- Pessoas do seed
--   a1 Helena (manager) · b1 Ana · b2 Bruno · b3 Carla (workers)
-- Segunda loja + pessoa de outra loja, para testar isolamento.
insert into public.stores (id, name) values ('00000000-0000-4000-8000-000000000002', 'Outra loja');
insert into auth.users (id, aud, role, email) values
  ('00000000-0000-4000-8000-0000000000c1', 'authenticated', 'authenticated', 'outra@turno.test');
insert into public.profiles (id, store_id, name, role) values
  ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-000000000002', 'Pessoa de Fora', 'worker');
insert into public.shifts (store_id, user_id, starts_at, ends_at) values
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-0000000000c1', now(), now() + interval '4 hours');

-- Turnos fixos no futuro (e um no passado) para os testes de pedidos.
insert into public.shifts (id, store_id, user_id, starts_at, ends_at) values
  ('00000000-0000-4000-8000-00000000f001', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000b1', '2030-01-07 09:00+00', '2030-01-07 17:00+00'),
  ('00000000-0000-4000-8000-00000000f002', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000b1', '2030-01-09 09:00+00', '2030-01-09 17:00+00'),
  ('00000000-0000-4000-8000-00000000f003', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000b2', '2030-01-08 18:00+00', '2030-01-08 23:00+00'),
  ('00000000-0000-4000-8000-00000000f004', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000b3', '2030-01-10 11:00+00', '2030-01-10 16:00+00'),
  ('00000000-0000-4000-8000-00000000f005', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000b3', '2030-01-11 11:00+00', '2030-01-11 16:00+00'),
  ('00000000-0000-4000-8000-00000000f006', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000a1', '2030-01-12 09:00+00', '2030-01-12 17:00+00'),
  ('00000000-0000-4000-8000-00000000f0aa', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000b1', '2020-01-06 09:00+00', '2020-01-06 17:00+00');

create function pg_temp.as_user(p_id uuid) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', coalesce(p_id::text, ''), true);
  if p_id is not null then
    execute 'set local role authenticated';
  end if;
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

-- Atalhos para ids
create function pg_temp.uid(p text) returns uuid language sql immutable as $$
  select ('00000000-0000-4000-8000-0000000000' || p)::uuid $$;
create function pg_temp.sid(p text) returns uuid language sql immutable as $$
  select ('00000000-0000-4000-8000-00000000f0' || p)::uuid $$;

grant execute on all functions in schema pg_temp to authenticated, anon;
-- Só para estes testes (a transação é revertida): permite inserir pedidos com
-- ids fixos. Na app, o id é sempre gerado pela base de dados.
grant insert (id) on public.swap_requests to authenticated;

-- ============================================================ FASE 1: básicos
select pg_temp.as_user(pg_temp.uid('b1'));

select pg_temp.expect((select count(*) from public.stores) = 1, 'Ana só vê a sua loja');
select pg_temp.expect((select count(*) from public.profiles) = 4, 'Ana vê os 4 perfis da loja');
select pg_temp.expect(
  not exists (select 1 from public.shifts where store_id = '00000000-0000-4000-8000-000000000002'),
  'Ana não vê turnos de outra loja');

insert into public.shifts (store_id, user_id, starts_at, ends_at)
values ('00000000-0000-4000-8000-000000000001', pg_temp.uid('b1'), '2030-02-07 09:00+00', '2030-02-07 17:00+00');
select pg_temp.expect(true, 'Ana cria um turno próprio');

select pg_temp.expect_error($q$
  insert into public.shifts (store_id, user_id, starts_at, ends_at)
  values ('00000000-0000-4000-8000-000000000001', pg_temp.uid('b2'), '2030-02-07 09:00+00', '2030-02-07 17:00+00') $q$,
  'Ana não cria turnos para o Bruno');

select pg_temp.expect_error($q$
  insert into public.shifts (store_id, user_id, starts_at, ends_at)
  values ('00000000-0000-4000-8000-000000000002', pg_temp.uid('b1'), '2030-02-07 09:00+00', '2030-02-07 17:00+00') $q$,
  'Ana não cria turnos noutra loja');

select pg_temp.expect_error($q$
  insert into public.shifts (store_id, user_id, starts_at, ends_at)
  values ('00000000-0000-4000-8000-000000000001', pg_temp.uid('b1'), '2030-02-07 17:00+00', '2030-02-07 09:00+00') $q$,
  'Turno que acaba antes de começar é recusado');

with u as (
  update public.shifts set starts_at = starts_at + interval '1 hour'
  where user_id = pg_temp.uid('b2') returning 1)
select pg_temp.expect((select count(*) from u) = 0, 'Ana não edita turnos do Bruno');

with d as (delete from public.shifts where user_id = pg_temp.uid('b2') returning 1)
select pg_temp.expect((select count(*) from d) = 0, 'Ana não apaga turnos do Bruno');

select pg_temp.expect_error($q$
  update public.shifts set user_id = pg_temp.uid('b2') where user_id = pg_temp.uid('b1') $q$,
  'Ana não muda o dono de um turno');

select pg_temp.expect_error($q$
  update public.profiles set role = 'manager' where id = pg_temp.uid('b1') $q$,
  'Ana não se promove a manager');

with u as (update public.profiles set name = 'Ana M.' where id = pg_temp.uid('b1') returning 1)
select pg_temp.expect((select count(*) from u) = 1, 'Ana muda o próprio nome');

-- ================================================== Criar pedidos (Ana)
select pg_temp.expect_error($q$
  insert into public.swap_requests (store_id, shift_id, requester_id, type)
  values ('00000000-0000-4000-8000-000000000001', pg_temp.sid('03'), pg_temp.uid('b1'), 'give') $q$,
  'Ana não cria pedido sobre turno do Bruno');

select pg_temp.expect_error($q$
  insert into public.swap_requests (store_id, shift_id, requester_id, type)
  values ('00000000-0000-4000-8000-000000000001', pg_temp.sid('aa'), pg_temp.uid('b1'), 'give') $q$,
  'Ana não pede troca de um turno que já passou');

select pg_temp.expect_error($q$
  insert into public.swap_requests (store_id, shift_id, requester_id, type, status)
  values ('00000000-0000-4000-8000-000000000001', pg_temp.sid('01'), pg_temp.uid('b1'), 'give', 'approved') $q$,
  'Ana não cria pedido já aprovado');

-- R1: Ana dá o turno de 7 jan
insert into public.swap_requests (id, store_id, shift_id, requester_id, type, note)
values ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-000000000001',
        pg_temp.sid('01'), pg_temp.uid('b1'), 'give', 'Consulta médica');
select pg_temp.expect(true, 'Ana cria pedido (dar turno) sobre turno próprio');

select pg_temp.expect_error($q$
  insert into public.swap_requests (store_id, shift_id, requester_id, type)
  values ('00000000-0000-4000-8000-000000000001', pg_temp.sid('01'), pg_temp.uid('b1'), 'cover') $q$,
  'Só um pedido ativo por turno');

select pg_temp.expect_error($q$
  update public.shifts set ends_at = ends_at + interval '1 hour' where id = pg_temp.sid('01') $q$,
  'Não se mudam as horas de um turno com pedido em curso');

with u as (update public.shifts set ends_at = ends_at + interval '1 hour' where id = pg_temp.sid('02') returning 1)
select pg_temp.expect((select count(*) from u) = 1, 'Turno sem pedido continua editável');
update public.shifts set ends_at = ends_at - interval '1 hour' where id = pg_temp.sid('02');

select pg_temp.expect_error($q$
  update public.swap_requests set status = 'approved' $q$, 'UPDATE direto em swap_requests é recusado');
select pg_temp.expect_error($q$
  delete from public.shifts where id = pg_temp.sid('01') $q$, 'Turno com pedidos não pode ser apagado');

select pg_temp.expect_error($q$
  select public.transition_swap_request('00000000-0000-4000-8000-0000000000e1', 'accepted') $q$,
  'Ana não aceita o próprio pedido');
select pg_temp.expect_error($q$
  select public.transition_swap_request('00000000-0000-4000-8000-0000000000e1', 'rejected') $q$,
  'Ana não recusa pedidos (só a gerência)');

select pg_temp.expect(
  (select count(*) from public.swap_request_events where swap_request_id = '00000000-0000-4000-8000-0000000000e1' and kind = 'created') = 1,
  'Criar pedido fica no histórico');
select pg_temp.expect(
  (select count(*) from public.notifications where swap_request_id = '00000000-0000-4000-8000-0000000000e1') = 0,
  'Quem pede não recebe notificação do próprio pedido');
select pg_temp.expect_error($q$
  insert into public.swap_request_events (store_id, swap_request_id, kind)
  values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000e1', 'approved') $q$,
  'Clientes não escrevem no histórico');

-- ============================================== Notificações (Bruno, Carla)
select pg_temp.as_user(pg_temp.uid('b2'));
select pg_temp.expect(
  (select count(*) from public.notifications where kind = 'swap_open' and not urgent and swap_request_id = '00000000-0000-4000-8000-0000000000e1') = 1,
  'Bruno recebe notificação do pedido da Ana');
select pg_temp.expect(
  (select title from public.notifications where kind = 'swap_open' and swap_request_id = '00000000-0000-4000-8000-0000000000e1') = 'Turno disponível: seg., 7 jan., 09:00–17:00',
  'Texto da notificação em pt-PT e hora de Lisboa');

select pg_temp.as_user(pg_temp.uid('a1'));
select pg_temp.expect((select count(*) from public.notifications where kind = 'swap_open') = 0, 'Gerente não é notificada de pedidos abertos');

select pg_temp.as_user(pg_temp.uid('c1'));
select pg_temp.expect((select count(*) from public.swap_requests) = 0, 'Outra loja não vê pedidos');
select pg_temp.expect((select count(*) from public.swap_request_events) = 0, 'Outra loja não vê o histórico');
select pg_temp.expect_error($q$
  select public.transition_swap_request('00000000-0000-4000-8000-0000000000e1', 'accepted') $q$,
  'Outra loja não aceita pedidos');

-- ========================================================= Aceitar (Bruno)
select pg_temp.as_user(pg_temp.uid('b2'));
select pg_temp.expect_error($q$
  select public.transition_swap_request('00000000-0000-4000-8000-0000000000e1', 'accepted', pg_temp.sid('03')) $q$,
  'Só se oferece turno em trocas');
select pg_temp.expect(
  (select accepted_by from public.transition_swap_request('00000000-0000-4000-8000-0000000000e1', 'accepted')) = pg_temp.uid('b2'),
  'Bruno aceita o pedido da Ana');
select pg_temp.expect_error($q$
  select public.transition_swap_request('00000000-0000-4000-8000-0000000000e1', 'approved') $q$,
  'Bruno não aprova');
select pg_temp.expect_error($q$
  select public.transition_swap_request('00000000-0000-4000-8000-0000000000e1', 'cancelled') $q$,
  'Bruno não cancela o pedido da Ana');

select pg_temp.as_user(pg_temp.uid('b1'));
select pg_temp.expect(
  (select count(*) from public.notifications where kind = 'swap_accepted' and swap_request_id = '00000000-0000-4000-8000-0000000000e1') = 1,
  'Ana é avisada de que o pedido foi aceite');

-- ======================================================== Decidir (Helena)
select pg_temp.as_user(pg_temp.uid('a1'));
select pg_temp.expect(
  (select count(*) from public.notifications where kind = 'swap_to_decide' and swap_request_id = '00000000-0000-4000-8000-0000000000e1') = 1,
  'Gerente é avisada de que há um pedido para aprovar');
select pg_temp.expect_error($q$
  select public.transition_swap_request('00000000-0000-4000-8000-0000000000e1', 'accepted') $q$,
  'Transição accepted -> accepted é inválida');
select pg_temp.expect(
  (select decided_by from public.transition_swap_request('00000000-0000-4000-8000-0000000000e1', 'approved', null, 'Ok, combinado'))
    = pg_temp.uid('a1'),
  'Helena aprova e fica registada como decisora');
select pg_temp.expect(
  (select user_id from public.shifts where id = pg_temp.sid('01')) = pg_temp.uid('b2'),
  'Ao aprovar, o turno passa para quem aceitou');
select pg_temp.expect_error($q$
  select public.transition_swap_request('00000000-0000-4000-8000-0000000000e1', 'rejected') $q$,
  'Pedido aprovado não volta a mudar');
select pg_temp.expect(
  (select string_agg(kind::text, ',' order by id) from public.swap_request_events
   where swap_request_id = '00000000-0000-4000-8000-0000000000e1') = 'created,accepted,approved',
  'Histórico completo: criado, aceite, aprovado');
select pg_temp.expect(
  (select note from public.swap_request_events
   where swap_request_id = '00000000-0000-4000-8000-0000000000e1' and kind = 'approved') = 'Ok, combinado',
  'A nota da decisão fica no histórico');

-- MPI
select pg_temp.as_user(pg_temp.uid('b2'));
select pg_temp.expect_error($q$
  select public.mark_swap_mpi_updated('00000000-0000-4000-8000-0000000000e1') $q$,
  'Só a gerência regista o MPI');
select pg_temp.expect(
  (select count(*) from public.notifications where kind = 'swap_approved' and swap_request_id = '00000000-0000-4000-8000-0000000000e1') = 1,
  'Quem aceitou é avisado da aprovação');

select pg_temp.as_user(pg_temp.uid('a1'));
select pg_temp.expect(
  (select mpi_updated_by from public.mark_swap_mpi_updated('00000000-0000-4000-8000-0000000000e1')) = pg_temp.uid('a1'),
  'Gerente regista que atualizou o MPI');
select public.mark_swap_mpi_updated('00000000-0000-4000-8000-0000000000e1');
select pg_temp.expect(
  (select count(*) from public.swap_request_events
   where swap_request_id = '00000000-0000-4000-8000-0000000000e1' and kind = 'mpi_updated') = 1,
  'Registar o MPI duas vezes não duplica o histórico');

-- ===================================================== Troca (swap): R2
select pg_temp.as_user(pg_temp.uid('b1'));
insert into public.swap_requests (id, store_id, shift_id, requester_id, type)
values ('00000000-0000-4000-8000-0000000000e2', '00000000-0000-4000-8000-000000000001',
        pg_temp.sid('02'), pg_temp.uid('b1'), 'swap');

select pg_temp.as_user(pg_temp.uid('b3'));
select pg_temp.expect_error($q$
  select public.transition_swap_request('00000000-0000-4000-8000-0000000000e2', 'accepted') $q$,
  'Troca exige turno oferecido');
select pg_temp.expect_error($q$
  select public.transition_swap_request('00000000-0000-4000-8000-0000000000e2', 'accepted', pg_temp.sid('03')) $q$,
  'Não se oferece o turno de outra pessoa');
select pg_temp.expect(
  (select offered_shift_id from public.transition_swap_request('00000000-0000-4000-8000-0000000000e2', 'accepted', pg_temp.sid('04')))
    = pg_temp.sid('04'),
  'Carla aceita a troca oferecendo o turno de 10 jan');
select pg_temp.expect_error($q$
  update public.shifts set ends_at = ends_at + interval '1 hour' where id = pg_temp.sid('04') $q$,
  'O turno oferecido fica bloqueado enquanto a troca está em curso');
select pg_temp.expect_error($q$
  insert into public.swap_requests (store_id, shift_id, requester_id, type)
  values ('00000000-0000-4000-8000-000000000001', pg_temp.sid('04'), pg_temp.uid('b3'), 'give') $q$,
  'Não se cria pedido sobre um turno oferecido noutra troca');

select pg_temp.as_user(pg_temp.uid('a1'));
select public.transition_swap_request('00000000-0000-4000-8000-0000000000e2', 'approved');
select pg_temp.expect(
  (select user_id from public.shifts where id = pg_temp.sid('02')) = pg_temp.uid('b3')
  and (select user_id from public.shifts where id = pg_temp.sid('04')) = pg_temp.uid('b1'),
  'Ao aprovar a troca, os dois turnos trocam de dono');

-- ======================================== Cobrir falta (cover) e cancelar: R3
select pg_temp.as_user(pg_temp.uid('b2'));
insert into public.swap_requests (id, store_id, shift_id, requester_id, type, note)
values ('00000000-0000-4000-8000-0000000000e3', '00000000-0000-4000-8000-000000000001',
        pg_temp.sid('03'), pg_temp.uid('b2'), 'cover', 'Estou doente');

select pg_temp.as_user(pg_temp.uid('b3'));
select pg_temp.expect(
  (select urgent from public.notifications where swap_request_id = '00000000-0000-4000-8000-0000000000e3'),
  'Pedido para cobrir falta gera notificação urgente');

select pg_temp.as_user(pg_temp.uid('b2'));
select public.transition_swap_request('00000000-0000-4000-8000-0000000000e3', 'cancelled');
select pg_temp.expect(
  (select status from public.swap_requests where id = '00000000-0000-4000-8000-0000000000e3') = 'cancelled',
  'Bruno cancela o próprio pedido');

-- ===================================== Recusar pedido aberto com nota: R4
select pg_temp.as_user(pg_temp.uid('b3'));
insert into public.swap_requests (id, store_id, shift_id, requester_id, type)
values ('00000000-0000-4000-8000-0000000000e4', '00000000-0000-4000-8000-000000000001',
        pg_temp.sid('05'), pg_temp.uid('b3'), 'give');

select pg_temp.as_user(pg_temp.uid('a1'));
select public.transition_swap_request('00000000-0000-4000-8000-0000000000e4', 'rejected', null, 'Precisamos de ti nesse dia.');

select pg_temp.as_user(pg_temp.uid('b3'));
select pg_temp.expect(
  (select body from public.notifications where kind = 'swap_rejected') like '%Precisamos de ti nesse dia.%',
  'A recusa chega a quem pediu, com a nota');

-- Gerente não decide pedidos próprios
select pg_temp.as_user(pg_temp.uid('a1'));
insert into public.swap_requests (id, store_id, shift_id, requester_id, type)
values ('00000000-0000-4000-8000-0000000000e5', '00000000-0000-4000-8000-000000000001',
        pg_temp.sid('06'), pg_temp.uid('a1'), 'give');
select pg_temp.expect_error($q$
  select public.transition_swap_request('00000000-0000-4000-8000-0000000000e5', 'rejected') $q$,
  'Gerente não decide um pedido seu');

-- ================================================= Notificações: leitura
select pg_temp.as_user(pg_temp.uid('b1'));
with u as (update public.notifications set read_at = now() returning 1)
select pg_temp.expect((select count(*) from u) > 0, 'Ana marca as notificações como lidas');
select pg_temp.expect_error($q$
  update public.notifications set title = 'x' $q$, 'Só se pode mudar read_at');
select pg_temp.expect(
  not exists (select 1 from public.notifications where user_id <> pg_temp.uid('b1')),
  'Ana só vê as próprias notificações');

-- ================================================= Tokens de push
select public.register_push_token('ExponentPushToken[abc]', 'ios');
select pg_temp.expect((select count(*) from public.push_tokens) = 1, 'Ana regista um token');
select pg_temp.as_user(pg_temp.uid('b2'));
select public.register_push_token('ExponentPushToken[abc]', 'ios');
select pg_temp.expect((select count(*) from public.push_tokens) = 1, 'O token passa para quem entrou depois');
select pg_temp.as_user(pg_temp.uid('b1'));
select pg_temp.expect((select count(*) from public.push_tokens) = 0, 'Ana deixa de ter o token');
select pg_temp.as_user(pg_temp.uid('b2'));
select public.unregister_push_token('ExponentPushToken[abc]');
select pg_temp.expect((select count(*) from public.push_tokens) = 0, 'Bruno remove o token ao sair');

-- ============================================================ anon
select pg_temp.as_user(null);
set local role anon;
select pg_temp.expect_error('select 1 from public.shifts', 'anon não lê turnos');
select pg_temp.expect_error('select 1 from public.notifications', 'anon não lê notificações');
select pg_temp.expect_error($q$
  select public.transition_swap_request(gen_random_uuid(), 'accepted') $q$, 'anon não chama a RPC');

reset role;
rollback;
\echo 'Todas as verificações passaram.'
