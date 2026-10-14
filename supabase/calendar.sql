-- Assumptions for this example:
--   * public.events(id, title, starts_at, ends_at) exists.
--   * public.people(id, name) exists.
--   * Both id columns use uuid; starts_at/ends_at use timestamptz.
--   * This is a shared calendar: any authenticated user may read events and
--     people and manage event-person links. Narrow these policies if your
--     application has per-user or per-organization access rules.
--
-- CREATE TABLE IF NOT EXISTS leaves existing event_people rows untouched.
-- Reconcile existing column types/names before running if the table already
-- exists with a different shape.

create table if not exists public.event_people (
  event_id uuid not null
    references public.events (id) on delete cascade,
  person_id uuid not null
    references public.people (id) on delete cascade,
  constraint event_people_event_person_pkey primary key (event_id, person_id)
);

-- Add the key when event_people existed before this migration. If duplicate
-- links exist, PostgreSQL stops here rather than deleting or merging records.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.event_people'::regclass
      and contype = 'p'
      and pg_get_constraintdef(oid) = 'PRIMARY KEY (event_id, person_id)'
  ) then
    alter table public.event_people
      add constraint event_people_event_person_pkey primary key (event_id, person_id);
  end if;
end
$$;

create index if not exists events_starts_at_id_idx
  on public.events (starts_at, id);

create index if not exists events_ends_at_idx
  on public.events (ends_at);

-- The primary key begins with event_id; this reverse index supports
-- person-specific calendar queries and person-side lookups.
create index if not exists event_people_person_id_event_id_idx
  on public.event_people (person_id, event_id);

alter table public.people enable row level security;
alter table public.events enable row level security;
alter table public.event_people enable row level security;

revoke all on table public.people, public.events, public.event_people
  from anon, public, authenticated;
grant select on public.people, public.events to authenticated;
grant select, insert, delete on public.event_people to authenticated;

drop policy if exists "Authenticated users can read people" on public.people;
create policy "Authenticated users can read people"
  on public.people for select to authenticated
  using (true);

drop policy if exists "Authenticated users can read events" on public.events;
create policy "Authenticated users can read events"
  on public.events for select to authenticated
  using (true);

drop policy if exists "Authenticated users can read event people" on public.event_people;
create policy "Authenticated users can read event people"
  on public.event_people for select to authenticated
  using (true);

drop policy if exists "Authenticated users can add event people" on public.event_people;
create policy "Authenticated users can add event people"
  on public.event_people for insert to authenticated
  with check (true);

drop policy if exists "Authenticated users can remove event people" on public.event_people;
create policy "Authenticated users can remove event people"
  on public.event_people for delete to authenticated
  using (true);

-- PostgreSQL combines permissive policies with OR. Review any pre-existing
-- policies on these tables and remove/restrict obsolete policies separately.
