-- =============================================================================
-- Turno — dados de exemplo (apenas para desenvolvimento local)
--
-- 1 loja, 1 gerente e 3 trabalhadores, com alguns turnos na semana atual
-- (fuso Europe/Lisbon). Os emails usam o domínio reservado .test: no Supabase
-- local, os magic links aparecem no Mailpit/Inbucket (http://127.0.0.1:54324).
--
-- Em projetos alojados, NÃO corras a parte de auth.users: convida as pessoas
-- pelo painel (Authentication → Users → Invite) e cria só as linhas de profiles.
-- =============================================================================

-- Loja ------------------------------------------------------------------------
insert into public.stores (id, name)
values ('00000000-0000-4000-8000-000000000001', 'Restaurante Exemplo — Baixa');

-- Utilizadores de autenticação (Supabase local) --------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
select
  '00000000-0000-0000-0000-000000000000',
  u.id,
  'authenticated',
  'authenticated',
  u.email,
  extensions.crypt('turno-dev-password', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('name', u.name),
  now(),
  now(),
  '', '', '', ''
from (values
  ('00000000-0000-4000-8000-0000000000a1'::uuid, 'gerente@turno.test', 'Helena Gerente'),
  ('00000000-0000-4000-8000-0000000000b1'::uuid, 'ana@turno.test', 'Ana Martins'),
  ('00000000-0000-4000-8000-0000000000b2'::uuid, 'bruno@turno.test', 'Bruno Costa'),
  ('00000000-0000-4000-8000-0000000000b3'::uuid, 'carla@turno.test', 'Carla Sousa')
) as u (id, email, name);

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
select
  gen_random_uuid(),
  u.id,
  u.id::text,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email',
  now(),
  now(),
  now()
from auth.users u
where u.email like '%@turno.test';

-- Perfis ----------------------------------------------------------------------
insert into public.profiles (id, store_id, name, role, weekly_hours)
values
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000001', 'Helena Gerente', 'manager', 40),
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-000000000001', 'Ana Martins', 'worker', 40),
  ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-000000000001', 'Bruno Costa', 'worker', 30),
  ('00000000-0000-4000-8000-0000000000b3', '00000000-0000-4000-8000-000000000001', 'Carla Sousa', 'worker', 20);

-- Turnos da semana atual (segunda-feira = dia 0, horas locais de Lisboa) -------
with week as (
  select date_trunc('week', now() at time zone 'Europe/Lisbon') as monday
)
insert into public.shifts (store_id, user_id, starts_at, ends_at, source)
select
  '00000000-0000-4000-8000-000000000001',
  s.user_id,
  (week.monday + s.day_offset * interval '1 day' + s.start_time) at time zone 'Europe/Lisbon',
  (week.monday + s.day_offset * interval '1 day' + s.start_time + s.duration) at time zone 'Europe/Lisbon',
  'manual'
from week, (values
  -- Ana: abertura e fecho, com um par com menos de 11h de descanso (qua → qui)
  ('00000000-0000-4000-8000-0000000000b1'::uuid, 0, time '09:00', interval '8 hours'),
  ('00000000-0000-4000-8000-0000000000b1'::uuid, 1, time '09:00', interval '8 hours'),
  ('00000000-0000-4000-8000-0000000000b1'::uuid, 2, time '15:00', interval '8 hours'),
  ('00000000-0000-4000-8000-0000000000b1'::uuid, 3, time '07:00', interval '8 hours'),
  -- Bruno: turnos de jantar
  ('00000000-0000-4000-8000-0000000000b2'::uuid, 1, time '18:00', interval '6 hours'),
  ('00000000-0000-4000-8000-0000000000b2'::uuid, 4, time '18:00', interval '6 hours'),
  ('00000000-0000-4000-8000-0000000000b2'::uuid, 5, time '12:00', interval '8 hours'),
  -- Carla: fim de semana
  ('00000000-0000-4000-8000-0000000000b3'::uuid, 5, time '11:00', interval '5 hours'),
  ('00000000-0000-4000-8000-0000000000b3'::uuid, 6, time '11:00', interval '5 hours')
) as s (user_id, day_offset, start_time, duration);

-- Pedidos de exemplo (semana seguinte, para estarem sempre no futuro) ---------
with week as (
  select date_trunc('week', now() at time zone 'Europe/Lisbon') + interval '7 days' as monday
)
insert into public.shifts (id, store_id, user_id, starts_at, ends_at)
select s.id, '00000000-0000-4000-8000-000000000001', s.user_id,
  (week.monday + s.day_offset * interval '1 day' + s.start_time) at time zone 'Europe/Lisbon',
  (week.monday + s.day_offset * interval '1 day' + s.start_time + s.duration) at time zone 'Europe/Lisbon'
from week, (values
  ('00000000-0000-4000-8000-00000000d001'::uuid, '00000000-0000-4000-8000-0000000000b2'::uuid, 0, time '18:00', interval '6 hours'),
  ('00000000-0000-4000-8000-00000000d002'::uuid, '00000000-0000-4000-8000-0000000000b1'::uuid, 2, time '09:00', interval '8 hours'),
  ('00000000-0000-4000-8000-00000000d003'::uuid, '00000000-0000-4000-8000-0000000000b3'::uuid, 3, time '11:00', interval '5 hours')
) as s (id, user_id, day_offset, start_time, duration);

-- Bruno precisa que alguém cubra a falta de segunda (aberto, urgente).
insert into public.swap_requests (store_id, shift_id, requester_id, type, note)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000d001',
        '00000000-0000-4000-8000-0000000000b2', 'cover', 'Consulta médica');

-- A Ana quer trocar a quarta; a Carla aceitou e oferece a quinta (à espera da gerente).
insert into public.swap_requests (id, store_id, shift_id, requester_id, type, note)
values ('00000000-0000-4000-8000-00000000e001', '00000000-0000-4000-8000-000000000001',
        '00000000-0000-4000-8000-00000000d002', '00000000-0000-4000-8000-0000000000b1', 'swap',
        'Tenho exame na quarta de manhã');
update public.swap_requests
set status = 'accepted',
    accepted_by = '00000000-0000-4000-8000-0000000000b3',
    accepted_at = now(),
    offered_shift_id = '00000000-0000-4000-8000-00000000d003'
where id = '00000000-0000-4000-8000-00000000e001';
