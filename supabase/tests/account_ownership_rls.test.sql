begin;
select plan(9);

insert into auth.users (id, email)
values
  ('11111111-1111-4111-8111-111111111111', 'owner-a@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'owner-b@example.test');

insert into public.people (id, name, owner_id)
values
  ('11111111-1111-4111-8111-000000000001', 'Owner A person', '11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-000000000001', 'Owner B person', '22222222-2222-4222-8222-222222222222');

insert into public.events (id, title, starts_at, owner_id)
values
  (
    '11111111-1111-4111-8111-000000000002',
    'Owner A event',
    '2026-10-14T09:00:00Z',
    '11111111-1111-4111-8111-111111111111'
  ),
  (
    '22222222-2222-4222-8222-000000000002',
    'Owner B event',
    '2026-10-14T10:00:00Z',
    '22222222-2222-4222-8222-222222222222'
  );

insert into public.event_people (event_id, person_id, owner_id)
values
  (
    '11111111-1111-4111-8111-000000000002',
    '11111111-1111-4111-8111-000000000001',
    '11111111-1111-4111-8111-111111111111'
  ),
  (
    '22222222-2222-4222-8222-000000000002',
    '22222222-2222-4222-8222-000000000001',
    '22222222-2222-4222-8222-222222222222'
  );

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select is((select count(*) from public.people), 1::bigint, 'an account reads only its people');
select is((select count(*) from public.events), 1::bigint, 'an account reads only its events');
select is((select count(*) from public.event_people), 1::bigint, 'an account reads only its links');

select throws_ok(
  $$insert into public.people (name, owner_id)
    values ('Impersonated person', '22222222-2222-4222-8222-222222222222')$$,
  '42501',
  null,
  'an account cannot create a person for another owner'
);
select throws_ok(
  $$update public.people
    set owner_id = '22222222-2222-4222-8222-222222222222'
    where id = '11111111-1111-4111-8111-000000000001'$$,
  '42501',
  null,
  'an account cannot transfer its person to another owner'
);

select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select is((select count(*) from public.people), 1::bigint, 'the second account reads only its people');
select is((select count(*) from public.events), 1::bigint, 'the second account reads only its events');
select is((select count(*) from public.event_people), 1::bigint, 'the second account reads only its links');
select throws_ok(
  $$insert into public.event_people (event_id, person_id, owner_id)
    values (
      '11111111-1111-4111-8111-000000000002',
      '22222222-2222-4222-8222-000000000001',
      '22222222-2222-4222-8222-222222222222'
    )$$,
  '23503',
  null,
  'composite foreign keys reject a cross-account event-person link'
);

select * from finish();
rollback;
