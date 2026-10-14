-- Run calendar.sql first so public.event_people and its access policies exist.
-- These stable, clearly labeled sample rows can be re-seeded safely.

insert into public.people (id, name)
values
  ('00000000-0000-4000-8000-000000000001', 'Demo - Alex Morgan'),
  ('00000000-0000-4000-8000-000000000002', 'Demo - Jamie Lee'),
  ('00000000-0000-4000-8000-000000000003', 'Demo - Riley Chen')
on conflict (id) do update
set name = excluded.name;

insert into public.events (id, title, starts_at, ends_at)
values
  (
    '00000000-0000-4000-8000-000000001001',
    'Demo - Planning session',
    (current_date + time '09:30')::timestamptz,
    (current_date + time '10:30')::timestamptz
  ),
  (
    '00000000-0000-4000-8000-000000001002',
    'Demo - Design review',
    (current_date + 1 + time '13:00')::timestamptz,
    (current_date + 1 + time '13:45')::timestamptz
  ),
  (
    '00000000-0000-4000-8000-000000001003',
    'Demo - Project check-in',
    (current_date + 3 + time '10:00')::timestamptz,
    (current_date + 3 + time '10:30')::timestamptz
  ),
  (
    '00000000-0000-4000-8000-000000001004',
    'Demo - Team workshop',
    (current_date + 5 + time '14:00')::timestamptz,
    (current_date + 5 + time '16:00')::timestamptz
  ),
  (
    '00000000-0000-4000-8000-000000001005',
    'Demo - Product demo',
    (current_date + 7 + time '11:00')::timestamptz,
    (current_date + 7 + time '12:00')::timestamptz
  ),
  (
    '00000000-0000-4000-8000-000000001006',
    'Demo - Sprint planning',
    (current_date + 10 + time '13:00')::timestamptz,
    (current_date + 10 + time '14:30')::timestamptz
  )
on conflict (id) do update
set
  title = excluded.title,
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at;

insert into public.event_people (event_id, person_id)
values
  ('00000000-0000-4000-8000-000000001001', '00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000001001', '00000000-0000-4000-8000-000000000002'),
  ('00000000-0000-4000-8000-000000001002', '00000000-0000-4000-8000-000000000002'),
  ('00000000-0000-4000-8000-000000001003', '00000000-0000-4000-8000-000000000003'),
  ('00000000-0000-4000-8000-000000001004', '00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000001004', '00000000-0000-4000-8000-000000000003'),
  ('00000000-0000-4000-8000-000000001005', '00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000001005', '00000000-0000-4000-8000-000000000002'),
  ('00000000-0000-4000-8000-000000001006', '00000000-0000-4000-8000-000000000002'),
  ('00000000-0000-4000-8000-000000001006', '00000000-0000-4000-8000-000000000003')
on conflict (event_id, person_id) do nothing;
