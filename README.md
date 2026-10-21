# Drakon4e

Angular 21 calendar backed directly by Supabase. Query code is centralized in
`CalendarService`; the browser only loads the current visible calendar range and
does not keep an application-wide copy of people, events, or associations.

## Supabase setup

The app uses these tables:

```text
people(id uuid, name text, owner_id uuid, grade smallint, books text, notes text, small_notes text)
events(id uuid, title text, starts_at timestamptz, ends_at timestamptz null, owner_id uuid)
event_people(event_id uuid, person_id uuid, owner_id uuid)
```

Run [`supabase/calendar.sql`](./supabase/calendar.sql) in the Supabase SQL
Editor before using the production app. It creates missing tables, upgrades
existing tables with account ownership, and installs owner-only RLS policies.
Every account can access only its people, events, and links. Composite
foreign keys prevent linking one account's event to another account's person.
The migration replaces all existing RLS policies on these three tables; review
any custom policies first. Legacy unowned rows require setting the initial
owner email in the script. The live project was checked during development:
the `people` and `events` tables exist and were empty, while `event_people` had
not yet been created.

The app includes email/password sign-in and account creation. It restores the
stored Supabase session on startup and subscribes to auth changes. Only signed-in
users can see calendar routes. People can be created, edited, or deleted at
`/manage/people`, including their grade, books, notes, and small notes; expand a
person’s event list there to assign or remove events for that person. Events can
be created, updated, or deleted at `/manage/events`,
where participants can also be assigned or removed. New events can select
multiple people from the current account's RLS-filtered people list, both in
event management and the calendar's new-event form. Creating an event from a
person's calendar includes that person by default. The service creates the
event, then bulk-inserts its selected links; if link creation fails, it attempts
to remove the new event and reports if cleanup also fails. Deleting a person or
event deletes only the account-owned associations through database foreign
keys.

The date query treats event ranges as half-open (`starts_at < range end` and
`ends_at > range start`), so events spanning into the visible period are
included, while an event ending exactly at its start boundary is excluded.
An event with a null `ends_at` is treated as a point event at `starts_at`.

## Language

The interface supports English and Bulgarian. Use the language selector in the
main header or sign-in form to switch immediately; dates and calendar headings
follow the selected language.

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
later enable email links or password recovery. Add both the local development
origin (`http://localhost:4200`) and the deployed app origin to the Auth URL
Configuration's redirect allow list so confirmation links return to the app.

Supabase's default email sender is restricted and rate-limited. Use a team
email for initial smoke tests or configure custom SMTP before public sign-up.
For an existing account's sample records, set `seed_owner_email` in
[`supabase/seed.sql`](./supabase/seed.sql), then run it after `calendar.sql`.
The sample IDs are stable, clearly labeled, scoped to that account, and safe
to re-seed.

After applying the schema, run `supabase test db` to execute the cross-account
RLS assertions in `supabase/tests/account_ownership_rls.test.sql`.

## Data access

`CalendarService` provides:

- `getEventsInRange(range, options)` for the all-events calendar, querying
  `events` directly.
- `getEventsForPersonInRange(personId, range, options)` for one person's
  calendar, querying `events` through `event_people!inner(person_id)`.
- `getParticipants(eventId)` for the event's associated people.
- `getEvents(options)` and `getEventsForPerson(personId, options)` for event
  management and a person's assigned events.
- `createEvent(event)`, `updateEvent(eventId, event)`, and
  `deleteEvent(eventId)` for account-owned events.
- `getPeople()`, `createPerson(name)`, `updatePerson(personId, name)`, and
  `deletePerson(personId)` for account-owned people.
- `addPersonToEvent(eventId, personId)` using an idempotent upsert against the
  composite primary key.
- `removePersonFromEvent(eventId, personId)` to remove only that association.

Each calendar page is bounded (200 rows by default; maximum 500); the calendar
offers “Load more” when another page exists. The `switchMap` subscription
aborts the previous Supabase HTTP request when the person or visible date range
changes, preventing an old response from replacing the newest view. Event
queries use the indexes created by the SQL migration. No extra cache or global
database store is maintained.

Management lists use the same bounded paging: people, events, and a person's
assigned events load 200 rows at a time, with explicit “Load more” controls.
Association pickers only include loaded rows until more are requested; they do
not fetch the full tables behind the scenes. Event/person updates and deletes
request the affected row back from Supabase so an RLS-filtered or missing row
is reported instead of being treated as a successful change.

New people and events include the verified signed-in account's `owner_id`;
the database's owner-only RLS policies still validate it against `auth.uid()`.
This also keeps inserts working if an existing database is missing the
`owner_id` column default from the schema setup.

## Production deployment

The project includes a Vercel configuration for Angular's
`dist/Drakon4e/browser` production output and client-side route fallback.
Connect the GitHub repository to Vercel and deploy with the `production` build
configuration. GitHub Actions runs the tests and production build on pushes and
pull requests.

Before opening registration publicly:

- Complete `supabase/calendar.sql` and verify access with two separate test
  accounts; each should see only its own people/events.
- Configure custom SMTP and confirm the email-confirmation redirect works on
  the deployed origin.
- Review Supabase Security Advisor, database backups/retention, SSL enforcement,
  MFA on the Supabase organization, and operational monitoring.
- Never add a Supabase secret/service-role key to this Angular app or Vercel
  browser environment variables. The publishable key is intended to be public;
  RLS is the authorization boundary.

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
