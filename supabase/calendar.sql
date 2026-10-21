-- Account-owned calendar schema.
--
-- For an existing deployment, set initial_owner_email below to the email of
-- the account that should own any legacy rows with a NULL owner_id. Assign
-- legacy rows before enabling sign-up for other accounts.
-- This script replaces every existing RLS policy on these three tables with
-- the policies below to prevent permissive policies from bypassing ownership.

begin;

create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  grade smallint,
  books text,
  notes text,
  small_notes text,
  owner_id uuid
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  owner_id uuid
);

alter table public.people
  add column if not exists owner_id uuid,
  add column if not exists grade smallint,
  add column if not exists books text,
  add column if not exists notes text,
  add column if not exists small_notes text;
alter table public.events
  add column if not exists owner_id uuid;

alter table public.people
  alter column id set default gen_random_uuid();
alter table public.events
  alter column id set default gen_random_uuid();

create table if not exists public.event_people (
  event_id uuid not null,
  person_id uuid not null,
  owner_id uuid,
  constraint event_people_event_person_pkey primary key (event_id, person_id)
);

alter table public.event_people
  add column if not exists owner_id uuid;

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

do $$
declare
  initial_owner_email text := 'REPLACE_WITH_INITIAL_OWNER_EMAIL';
  initial_owner_id uuid;
begin
  if exists (select 1 from public.people where owner_id is null)
    or exists (select 1 from public.events where owner_id is null)
    or exists (select 1 from public.event_people where owner_id is null)
  then
    if initial_owner_email = 'REPLACE_WITH_INITIAL_OWNER_EMAIL' then
      raise exception
        'Set initial_owner_email in supabase/calendar.sql to the first account email before migrating legacy rows.';
    end if;

    select id
      into initial_owner_id
      from auth.users
      where lower(email) = lower(initial_owner_email);

    if initial_owner_id is null then
      raise exception 'No Supabase Auth account found for %.', initial_owner_email;
    end if;

    update public.people
      set owner_id = initial_owner_id
      where owner_id is null;

    update public.events
      set owner_id = initial_owner_id
      where owner_id is null;

    update public.event_people as ep
      set owner_id = e.owner_id
      from public.events as e
      where ep.event_id = e.id
        and ep.owner_id is null;
  end if;

  if exists (
    select 1
    from public.event_people as ep
    join public.events as e on e.id = ep.event_id
    join public.people as p on p.id = ep.person_id
    where e.owner_id is distinct from p.owner_id
      or ep.owner_id is distinct from e.owner_id
  ) then
    raise exception
      'Existing event-person links cross account ownership. Reassign or remove those links before continuing.';
  end if;
end
$$;

alter table public.people
  alter column owner_id set default auth.uid(),
  alter column owner_id set not null;
alter table public.events
  alter column owner_id set default auth.uid(),
  alter column owner_id set not null;
alter table public.event_people
  alter column owner_id set default auth.uid(),
  alter column owner_id set not null;

alter table public.people
  drop constraint if exists people_owner_id_fkey,
  add constraint people_owner_id_fkey
    foreign key (owner_id) references auth.users (id) on delete cascade;
alter table public.events
  drop constraint if exists events_owner_id_fkey,
  add constraint events_owner_id_fkey
    foreign key (owner_id) references auth.users (id) on delete cascade;

create unique index if not exists people_id_owner_id_uidx
  on public.people (id, owner_id);
create unique index if not exists events_id_owner_id_uidx
  on public.events (id, owner_id);

alter table public.event_people
  drop constraint if exists event_people_event_id_fkey,
  drop constraint if exists event_people_person_id_fkey,
  drop constraint if exists event_people_event_owner_fkey,
  drop constraint if exists event_people_person_owner_fkey;

alter table public.event_people
  add constraint event_people_event_owner_fkey
    foreign key (event_id, owner_id)
    references public.events (id, owner_id) on delete cascade,
  add constraint event_people_person_owner_fkey
    foreign key (person_id, owner_id)
    references public.people (id, owner_id) on delete cascade;

create index if not exists people_owner_name_idx
  on public.people (owner_id, name);
create index if not exists events_owner_starts_at_id_idx
  on public.events (owner_id, starts_at, id);
create index if not exists events_owner_ends_at_idx
  on public.events (owner_id, ends_at);
create index if not exists event_people_owner_event_person_idx
  on public.event_people (owner_id, event_id, person_id);
create index if not exists event_people_owner_person_event_idx
  on public.event_people (owner_id, person_id, event_id);

alter table public.people enable row level security;
alter table public.events enable row level security;
alter table public.event_people enable row level security;

do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('people', 'events', 'event_people')
  loop
    execute format(
      'drop policy %I on %I.%I',
      existing_policy.policyname,
      existing_policy.schemaname,
      existing_policy.tablename
    );
  end loop;
end
$$;

revoke all on table public.people, public.events, public.event_people
  from anon, public, authenticated;
grant select, insert, update, delete on table public.people, public.events
  to authenticated;
grant select, insert, delete on table public.event_people
  to authenticated;

create policy "Owners can read their people"
  on public.people for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy "Owners can create their people"
  on public.people for insert to authenticated
  with check ((select auth.uid()) = owner_id);
create policy "Owners can update their people"
  on public.people for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy "Owners can delete their people"
  on public.people for delete to authenticated
  using ((select auth.uid()) = owner_id);

create policy "Owners can read their events"
  on public.events for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy "Owners can create their events"
  on public.events for insert to authenticated
  with check ((select auth.uid()) = owner_id);
create policy "Owners can update their events"
  on public.events for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy "Owners can delete their events"
  on public.events for delete to authenticated
  using ((select auth.uid()) = owner_id);

create policy "Owners can read their event people"
  on public.event_people for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy "Owners can add their event people"
  on public.event_people for insert to authenticated
  with check ((select auth.uid()) = owner_id);
create policy "Owners can remove their event people"
  on public.event_people for delete to authenticated
  using ((select auth.uid()) = owner_id);

commit;

notify pgrst, 'reload schema';
