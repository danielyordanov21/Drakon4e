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
          data: {
            id: 'person-3',
            name: 'Jordan',
            grade: 8,
            books: 'Novel',
            notes: 'Updated notes',
            small_notes: null,
          },
          error,
        }),
      ),
      maybeSingle: vi.fn(() =>
        Promise.resolve({
          data: { id: 'event-1', event_id: 'event-1' },
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

  it('loads one bounded page of events linked to a person', async () => {
    const query = createQuery(eventRows);
    const { service } = setup(query);

    const page = await service.getEventsForPerson('person-1', { limit: 1 });

    expect(query['select']).toHaveBeenCalledWith(
      'id,title,starts_at,ends_at,event_people!inner(person_id)',
    );
    expect(query['eq']).toHaveBeenCalledWith('event_people.person_id', 'person-1');
    expect(query['range']).toHaveBeenCalledWith(0, 1);
    expect(page.events.map(({ id }) => id)).toEqual(['event-1']);
    expect(page.hasMore).toBe(true);
  });

  it('loads a bounded page of people in name order', async () => {
    const query = createQuery([
      {
        id: 'person-1',
        name: 'Alex',
        grade: 7,
        books: null,
        notes: 'Reading',
        small_notes: null,
      },
      {
        id: 'person-2',
        name: 'Morgan',
        grade: null,
        books: 'History',
        notes: null,
        small_notes: 'Call first',
      },
    ]);
    const { service, client } = setup(query);

    const page = await service.getPeople({ limit: 1 });

    expect(client.from).toHaveBeenCalledWith('people');
    expect(query['select']).toHaveBeenCalledWith('id,name,grade,books,notes,small_notes');
    expect(query['order']).toHaveBeenCalledWith('name');
    expect(query['range']).toHaveBeenCalledWith(0, 1);
    expect(page.people).toEqual([
      {
        id: 'person-1',
        name: 'Alex',
        grade: 7,
        books: null,
        notes: 'Reading',
        small_notes: null,
      },
    ]);
    expect(page.hasMore).toBe(true);
    expect(page.nextOffset).toBe(1);
  });

  it('loads one person by ID and reports missing people', async () => {
    const query = createQuery(null);
    (query['maybeSingle'] as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { id: 'person-1', name: 'Alex', grade: 7, books: null, notes: null, small_notes: null },
      error: null,
    });
    const { service } = setup(query);

    await expect(service.getPerson('person-1')).resolves.toEqual({
      id: 'person-1',
      name: 'Alex',
      grade: 7,
      books: null,
      notes: null,
      small_notes: null,
    });
    expect(query['eq']).toHaveBeenCalledWith('id', 'person-1');

    (query['maybeSingle'] as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: null,
      error: null,
    });
    await expect(service.getPerson('missing-person')).rejects.toThrow(
      'Could not find this person.',
    );
  });

  it('creates a person with a normalized name', async () => {
    const query = createQuery();
    const { service } = setup(query);

    const person = {
      name: '  Jordan  ',
      grade: 8,
      books: ' Novel ',
      notes: ' Notes ',
      small_notes: '',
    };
    await expect(service.createPerson(person)).resolves.toEqual({
      id: 'person-3',
      name: 'Jordan',
      grade: 8,
      books: 'Novel',
      notes: 'Updated notes',
      small_notes: null,
    });
    expect(query['insert']).toHaveBeenCalledWith({
      name: 'Jordan',
      grade: 8,
      books: 'Novel',
      notes: 'Notes',
      small_notes: null,
      owner_id: 'user-1',
    });
    expect(query['select']).toHaveBeenCalledWith('id,name,grade,books,notes,small_notes');
  });

  it('requires a verified signed-in user before creating a person', async () => {
    const query = createQuery();
    const { service, client } = setup(query, null);

    await expect(service.createPerson({
      name: 'Jordan',
      grade: null,
      books: null,
      notes: null,
      small_notes: null,
    })).rejects.toThrow(
      'You must be signed in to create people or events.',
    );
    expect(client.from).not.toHaveBeenCalled();
  });

  it('rejects grades outside the supported whole-number range', async () => {
    const query = createQuery();
    const { service, client } = setup(query);

    await expect(service.createPerson({
      name: 'Jordan',
      grade: 13,
      books: null,
      notes: null,
      small_notes: null,
    })).rejects.toThrow('Grade must be a whole number between 0 and 12.');
    await expect(service.createPerson({
      name: 'Jordan',
      grade: 4.5,
      books: null,
      notes: null,
      small_notes: null,
    })).rejects.toThrow('Grade must be a whole number between 0 and 12.');
    expect(client.from).not.toHaveBeenCalled();
  });

  it('updates and deletes only the requested person', async () => {
    const query = createQuery(null);
    const { service } = setup(query);

    await service.updatePerson('person-1', {
      name: '  Alex Morgan  ',
      grade: null,
      books: ' Book ',
      notes: '',
      small_notes: ' Note ',
    });
    expect(query['update']).toHaveBeenCalledWith({
      name: 'Alex Morgan',
      grade: null,
      books: 'Book',
      notes: null,
      small_notes: 'Note',
    });
    expect(query['eq']).toHaveBeenCalledWith('id', 'person-1');
    expect(query['maybeSingle']).toHaveBeenCalled();

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

  it('creates an event and bulk-links the selected people owned by the current account', async () => {
    const query = createQuery(null);
    const { service, client } = setup(query);

    const id = await service.createEvent(
      {
        title: '  Planning  ',
        starts_at: '2026-10-14T09:00:00.000Z',
        ends_at: null,
      },
      ['person-1', 'person-2', 'person-1'],
    );

    expect(id).toBe('person-3');
    expect(client.from).toHaveBeenNthCalledWith(1, 'events');
    expect(client.from).toHaveBeenNthCalledWith(2, 'event_people');
    expect(query['upsert']).toHaveBeenCalledWith(
      [
        { event_id: 'person-3', person_id: 'person-1', owner_id: 'user-1' },
        { event_id: 'person-3', person_id: 'person-2', owner_id: 'user-1' },
      ],
      { onConflict: 'event_id,person_id', ignoreDuplicates: true },
    );
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
    expect(query['maybeSingle']).toHaveBeenCalled();
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
    expect(query['maybeSingle']).toHaveBeenCalled();
  });

  it('reports updates or deletes that match no visible row', async () => {
    const query = createQuery(null);
    (query['maybeSingle'] as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: null,
      error: null,
    });
    const { service } = setup(query);

    await expect(service.updatePerson('missing-person', {
      name: 'Name',
      grade: null,
      books: null,
      notes: null,
      small_notes: null,
    })).rejects.toThrow(
      'no matching person was found',
    );
    await expect(service.deleteEvent('missing-event')).rejects.toThrow(
      'no matching event was found',
    );
  });
});
