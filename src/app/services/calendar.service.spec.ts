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
      eq: chain,
      lt: chain,
      or: chain,
      order: chain,
      range: chain,
      abortSignal: chain,
      upsert: chain,
      delete: vi.fn(() => query),
      then: (resolve: (result: unknown) => unknown) =>
        Promise.resolve({ data, error }).then(resolve),
    };
    return query;
  }

  function setup(query: Record<string, unknown>) {
    const client = {
      from: vi.fn(() => query),
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
