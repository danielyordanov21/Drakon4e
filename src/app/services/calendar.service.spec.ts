import { TestBed } from '@angular/core/testing';
import { SupabaseClient } from '@supabase/supabase-js';
import { vi } from 'vitest';
import { Database } from '../models/database.types';
import { SUPABASE_CLIENT } from './supabase-client';
import { CalendarService } from './calendar.service';

describe('CalendarService', () => {
  const eventRows = [
    {
      id: 'event-1',
      title: 'Range event',
      starts_at: '2026-10-13T09:00:00.000Z',
      ends_at: '2026-10-13T10:00:00.000Z',
    },
    {
      id: 'event-2',
      title: 'Next page',
      starts_at: '2026-10-14T09:00:00.000Z',
      ends_at: '2026-10-14T10:00:00.000Z',
    },
  ];

  function createQuery(data: unknown = eventRows, error: { message: string } | null = null) {
    let query: Record<string, unknown>;
    const chain = vi.fn(() => query);
    query = {
      select: chain,
      insert: chain,
      update: chain,
      eq: chain,
      lt: chain,
      or: chain,
      order: chain,
      range: chain,
      abortSignal: chain,
      upsert: chain,
      delete: vi.fn(() => query),
      single: vi.fn(() =>
        Promise.resolve({
          data: { id: 'person-3', name: 'Jordan' },
          error,
        }),
      ),
      then: (resolve: (result: unknown) => unknown) =>
        Promise.resolve({ data, error }).then(resolve),
    };
    return query;
  }

  function setup(query: Record<string, unknown>, user: { id: string } | null = { id: 'user-1' }) {
    const client = {
      from: vi.fn(() => query),
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
      },
    };
    TestBed.configureTestingModule({
      providers: [
        CalendarService,
        {
          provide: SUPABASE_CLIENT,
          useValue: () => Promise.resolve(client as unknown as SupabaseClient<Database>),
        },
      ],
    });
    return { service: TestBed.inject(CalendarService), client };
  }

  it('loads a bounded all-events page with overlap range predicates', async () => {
    const query = createQuery();
    const { service, client } = setup(query);
    const range = {
      start: new Date('2026-10-01T00:00:00.000Z'),
      endExclusive: new Date('2026-11-01T00:00:00.000Z'),
    };

    const page = await service.getEventsInRange(range, { limit: 1 });

    expect(client.from).toHaveBeenCalledWith('events');
    expect(query['lt']).toHaveBeenCalledWith('starts_at', range.endExclusive.toISOString());
    expect(query['or']).toHaveBeenCalledWith(
      `ends_at.gt.${range.start.toISOString()},and(ends_at.is.null,starts_at.gte.${range.start.toISOString()})`,
    );
    expect(query['range']).toHaveBeenCalledWith(0, 1);
    expect(page.events[0]?.title).toBe('Range event');
    expect(page.hasMore).toBe(true);
    expect(page.nextOffset).toBe(1);
  });

  it('filters a person calendar through the event_people inner relationship', async () => {
    const query = createQuery();
    const { service, client } = setup(query);
    const range = {
      start: new Date('2026-10-01T00:00:00.000Z'),
      endExclusive: new Date('2026-11-01T00:00:00.000Z'),
    };

    await service.getEventsForPersonInRange('person-1', range);

    expect(client.from).toHaveBeenCalledWith('events');
    expect(query['select']).toHaveBeenCalledWith(
      'id,title,starts_at,ends_at,event_people!inner(person_id)',
    );
    expect(query['eq']).toHaveBeenCalledWith('event_people.person_id', 'person-1');
  });

  it('loads participants through the event_people relationship', async () => {
    const query = createQuery([{ id: 'person-1', name: 'Alex', event_people: [] }]);
    const { service, client } = setup(query);

    const participants = await service.getParticipants('event-1');

    expect(client.from).toHaveBeenCalledWith('people');
    expect(query['select']).toHaveBeenCalledWith(
      'id,name,event_people!inner(event_id)',
    );
    expect(query['eq']).toHaveBeenCalledWith('event_people.event_id', 'event-1');
    expect(participants).toEqual([{ id: 'person-1', name: 'Alex' }]);
  });

  it('loads a page of all events in start-time order', async () => {
    const query = createQuery();
    const { service, client } = setup(query);

    const page = await service.getEvents({ offset: 1, limit: 1 });

    expect(client.from).toHaveBeenCalledWith('events');
    expect(query['order']).toHaveBeenCalledWith('starts_at');
    expect(query['order']).toHaveBeenCalledWith('id');
    expect(query['range']).toHaveBeenCalledWith(1, 2);
    expect(page.events).toHaveLength(1);
    expect(page.hasMore).toBe(true);
  });

  it('loads all events linked to one person', async () => {
    const query = createQuery(eventRows);
    const { service } = setup(query);

    const events = await service.getAllEventsForPerson('person-1');

    expect(query['select']).toHaveBeenCalledWith(
      'id,title,starts_at,ends_at,event_people!inner(person_id)',
    );
    expect(query['eq']).toHaveBeenCalledWith('event_people.person_id', 'person-1');
    expect(events.map(({ id }) => id)).toEqual(['event-1', 'event-2']);
  });

  it('loads all people in name order', async () => {
    const query = createQuery([
      { id: 'person-1', name: 'Alex' },
      { id: 'person-2', name: 'Morgan' },
    ]);
    const { service, client } = setup(query);

    const people = await service.getPeople();

    expect(client.from).toHaveBeenCalledWith('people');
    expect(query['select']).toHaveBeenCalledWith('id,name');
    expect(query['order']).toHaveBeenCalledWith('name');
    expect(people).toEqual([
      { id: 'person-1', name: 'Alex' },
      { id: 'person-2', name: 'Morgan' },
    ]);
  });

  it('creates a person with a normalized name', async () => {
    const query = createQuery();
    const { service } = setup(query);

    await expect(service.createPerson('  Jordan  ')).resolves.toEqual({
      id: 'person-3',
      name: 'Jordan',
    });
    expect(query['insert']).toHaveBeenCalledWith({ name: 'Jordan', owner_id: 'user-1' });
    expect(query['select']).toHaveBeenCalledWith('id,name');
  });

  it('requires a verified signed-in user before creating a person', async () => {
    const query = createQuery();
    const { service, client } = setup(query, null);

    await expect(service.createPerson('Jordan')).rejects.toThrow(
      'You must be signed in to create people or events.',
    );
    expect(client.from).not.toHaveBeenCalled();
  });

  it('updates and deletes only the requested person', async () => {
    const query = createQuery(null);
    const { service } = setup(query);

    await service.updatePerson('person-1', '  Alex Morgan  ');
    expect(query['update']).toHaveBeenCalledWith({ name: 'Alex Morgan' });
    expect(query['eq']).toHaveBeenCalledWith('id', 'person-1');

    await service.deletePerson('person-1');
    expect(query['delete']).toHaveBeenCalled();
  });

  it('creates events with normalized titles and valid timestamps', async () => {
    const query = createQuery(null);
    const { service } = setup(query);

    await service.createEvent({
      title: '  Planning  ',
      starts_at: '2026-10-14T09:00:00.000Z',
      ends_at: '2026-10-14T10:00:00.000Z',
    });

    expect(query['insert']).toHaveBeenCalledWith({
      title: 'Planning',
      starts_at: '2026-10-14T09:00:00.000Z',
      ends_at: '2026-10-14T10:00:00.000Z',
      owner_id: 'user-1',
    });
  });

  it('updates an event with normalized fields', async () => {
    const query = createQuery(null);
    const { service } = setup(query);

    await service.updateEvent('event-1', {
      title: '  Updated planning  ',
      starts_at: '2026-10-15T09:00:00.000Z',
      ends_at: null,
    });

    expect(query['update']).toHaveBeenCalledWith({
      title: 'Updated planning',
      starts_at: '2026-10-15T09:00:00.000Z',
      ends_at: null,
    });
    expect(query['eq']).toHaveBeenCalledWith('id', 'event-1');
  });

  it('rejects event ends that are not later than the start', async () => {
    const query = createQuery(null);
    const { service } = setup(query);

    await expect(
      service.createEvent({
        title: 'Invalid',
        starts_at: '2026-10-14T10:00:00.000Z',
        ends_at: '2026-10-14T09:00:00.000Z',
      }),
    ).rejects.toThrow('Event end must be later than its start.');
  });

  it('uses an idempotent insert for a person-event association', async () => {
    const query = createQuery(null);
    const { service } = setup(query);

    await service.addPersonToEvent('event-1', 'person-1');

    expect(query['upsert']).toHaveBeenCalledWith(
      { event_id: 'event-1', person_id: 'person-1' },
      { onConflict: 'event_id,person_id', ignoreDuplicates: true },
    );
  });

  it('removes only the requested person-event association', async () => {
    const query = createQuery(null);
    const { service } = setup(query);

    await service.removePersonFromEvent('event-1', 'person-1');

    expect(query['delete']).toHaveBeenCalled();
    expect(query['eq']).toHaveBeenNthCalledWith(1, 'event_id', 'event-1');
    expect(query['eq']).toHaveBeenNthCalledWith(2, 'person_id', 'person-1');
  });
});
