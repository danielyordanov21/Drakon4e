# Drakon4e

Angular 21 calendar backed directly by Supabase. Query code is centralized in
`CalendarService`; the browser only loads the current visible calendar range and
does not keep an application-wide copy of people, events, or associations.

## Supabase schema assumptions

The data-access layer and [`supabase/calendar.sql`](./supabase/calendar.sql)
assume these existing columns:

```text
people(id uuid, name text)
events(id uuid, title text, starts_at timestamptz, ends_at timestamptz null)
```

The SQL creates only the `event_people` junction table; it does not recreate or
delete existing people or events. If the deployed schema uses different names
or types, adapt the migration and [`database.types.ts`](./src/app/models/database.types.ts)
to match it. Existing rows in an already-created `event_people` table are left
in place. It adds the composite primary key to an existing junction table if
missing; if duplicate links exist, the migration fails instead of deleting
data. The composite primary key prevents duplicate links, and foreign keys
preserve referential integrity with cascading cleanup when a person or event is
deleted.

Run the SQL in the Supabase SQL editor after reconciling its assumptions with
the live schema. Its RLS policies assume a shared calendar: signed-in users can
read people, events, and links, and can add/remove any link. Restrict these
policies to the actual user/organization ownership model before using the
application for private calendars. The client-side foreign keys are not
authorization checks. Review and remove obsolete permissive policies already
defined on these tables: PostgreSQL combines permissive policies using OR.
The app includes email/password sign-in and account creation. It restores the
stored Supabase session on startup and subscribes to auth changes. Configure
email/password sign-in in Supabase Auth; if email confirmation is enabled,
new users must confirm their address before signing in. The root view keeps
calendar routes hidden unless a session is available.

The date query treats event ranges as half-open (`starts_at < range end` and
`ends_at > range start`), so events spanning into the visible period are
included, while an event ending exactly at its start boundary is excluded.
An event with a null `ends_at` is treated as a point event at `starts_at`.

## Configure the browser client

Set the project URL and publishable key in
[`environment.ts`](./src/environments/environment.ts):

```ts
export const environment = {
  supabaseUrl: 'https://YOUR_PROJECT.supabase.co',
  supabasePublishableKey: 'YOUR_SUPABASE_PUBLISHABLE_KEY',
};
```

The publishable key (or legacy anon key) is intended for browser use and must
be protected by RLS. Never put a service-role key or other secret in Angular
code or build configuration. The application reports an explicit configuration
error until both values are set.

Enable the Email provider in Supabase Auth. The sign-up flow uses the project's
email-confirmation setting and displays a confirmation prompt if sign-up does
not return a session. Configure the project's allowed redirect URLs if you
later enable email links or password recovery. Add the local development
origin (typically `http://localhost:4200`) and the deployed app origin to the
Auth URL Configuration's redirect allow list so confirmation links return to
the app.

To initialize a fresh live project, create the `people` and `events` base
tables using the schema documented above, run `supabase/calendar.sql` in the
Supabase SQL Editor, then run `supabase/seed.sql` to add clearly labeled sample
people, events, and links. The seed script is idempotent for its fixed sample
IDs and only updates those sample rows.

## Data access

`CalendarService` provides:

- `getEventsInRange(range, options)` for the all-events calendar, querying
  `events` directly.
- `getEventsForPersonInRange(personId, range, options)` for one person's
  calendar, querying `events` through `event_people!inner(person_id)`.
- `getParticipants(eventId)` for the event's associated people.
- `addPersonToEvent(eventId, personId)` using an idempotent upsert against the
  composite primary key.
- `removePersonFromEvent(eventId, personId)` to remove only that association.

Each calendar page is bounded (200 rows by default; maximum 500); the calendar
offers “Load more” when another page exists. The `switchMap` subscription
aborts the previous Supabase HTTP request when the person or visible date range
changes, preventing an old response from replacing the newest view. Event
queries use the indexes created by the SQL migration. No extra cache or global
database store is maintained.

## Development

```bash
npm install
npm start
npm test
npm run build
```

`npm start` uses the configured Supabase project by default. To browse without
sign-in or database access, set `demoMode` to `true` in
`src/environments/environment.ts`; sample data changes then exist only in
memory and are discarded on refresh. Demo mode is ignored by production builds.
