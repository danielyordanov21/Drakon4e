-- Replace the email below with the account that should own these examples.
-- Run calendar.sql first. This seed is repeatable and only updates rows
-- belonging to the selected account.

do $$
declare
  seed_owner_email text := 'REPLACE_WITH_ACCOUNT_EMAIL';
  seed_owner_id uuid;
begin
  select id
    into seed_owner_id
    from auth.users
    where lower(email) = lower(seed_owner_email);

  if seed_owner_email = 'REPLACE_WITH_ACCOUNT_EMAIL' or seed_owner_id is null then
    raise exception 'Set seed_owner_email to an existing Supabase Auth account email.';
  end if;

  if exists (
    select 1 from public.people
    where id in (
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000002',
      '00000000-0000-4000-8000-000000000003'
    )
      and owner_id <> seed_owner_id
  ) or exists (
    select 1 from public.events
    where id between
      '00000000-0000-4000-8000-000000001001'::uuid
      and '00000000-0000-4000-8000-000000001006'::uuid
      and owner_id <> seed_owner_id
  ) then
    raise exception 'A demo seed ID is already owned by a different account.';
  end if;

  insert into public.people (id, name, owner_id)
  values
    ('00000000-0000-4000-8000-000000000001', 'Demo - Alex Morgan', seed_owner_id),
    ('00000000-0000-4000-8000-000000000002', 'Demo - Jamie Lee', seed_owner_id),
    ('00000000-0000-4000-8000-000000000003', 'Demo - Riley Chen', seed_owner_id)
  on conflict (id) do update
    set name = excluded.name
    where public.people.owner_id = excluded.owner_id;

  insert into public.events (id, title, starts_at, ends_at, owner_id)
  values
    (
      '00000000-0000-4000-8000-000000001001',
      'Demo - Planning session',
      (current_date + time '09:30')::timestamptz,
      (current_date + time '10:30')::timestamptz,
      seed_owner_id
    ),
    (
      '00000000-0000-4000-8000-000000001002',
      'Demo - Design review',
      (current_date + 1 + time '13:00')::timestamptz,
      (current_date + 1 + time '13:45')::timestamptz,
      seed_owner_id
    ),
    (
      '00000000-0000-4000-8000-000000001003',
      'Demo - Project check-in',
      (current_date + 3 + time '10:00')::timestamptz,
      (current_date + 3 + time '10:30')::timestamptz,
      seed_owner_id
    ),
    (
      '00000000-0000-4000-8000-000000001004',
      'Demo - Team workshop',
      (current_date + 5 + time '14:00')::timestamptz,
      (current_date + 5 + time '16:00')::timestamptz,
      seed_owner_id
    ),
    (
      '00000000-0000-4000-8000-000000001005',
      'Demo - Product demo',
      (current_date + 7 + time '11:00')::timestamptz,
      (current_date + 7 + time '12:00')::timestamptz,
      seed_owner_id
    ),
    (
      '00000000-0000-4000-8000-000000001006',
      'Demo - Sprint planning',
      (current_date + 10 + time '13:00')::timestamptz,
      (current_date + 10 + time '14:30')::timestamptz,
      seed_owner_id
    )
  on conflict (id) do update
    set
      title = excluded.title,
      starts_at = excluded.starts_at,
      ends_at = excluded.ends_at
    where public.events.owner_id = excluded.owner_id;

  insert into public.event_people (event_id, person_id, owner_id)
  values
    ('00000000-0000-4000-8000-000000001001', '00000000-0000-4000-8000-000000000001', seed_owner_id),
    ('00000000-0000-4000-8000-000000001001', '00000000-0000-4000-8000-000000000002', seed_owner_id),
    ('00000000-0000-4000-8000-000000001002', '00000000-0000-4000-8000-000000000002', seed_owner_id),
    ('00000000-0000-4000-8000-000000001003', '00000000-0000-4000-8000-000000000003', seed_owner_id),
    ('00000000-0000-4000-8000-000000001004', '00000000-0000-4000-8000-000000000001', seed_owner_id),
    ('00000000-0000-4000-8000-000000001004', '00000000-0000-4000-8000-000000000003', seed_owner_id),
    ('00000000-0000-4000-8000-000000001005', '00000000-0000-4000-8000-000000000001', seed_owner_id),
    ('00000000-0000-4000-8000-000000001005', '00000000-0000-4000-8000-000000000002', seed_owner_id),
    ('00000000-0000-4000-8000-000000001006', '00000000-0000-4000-8000-000000000002', seed_owner_id),
    ('00000000-0000-4000-8000-000000001006', '00000000-0000-4000-8000-000000000003', seed_owner_id)
  on conflict (event_id, person_id) do nothing;
end
$$;
