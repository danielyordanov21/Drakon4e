import { DemoCalendarService } from './demo-calendar.service';

describe('DemoCalendarService', () => {
  let service: DemoCalendarService;

  beforeEach(() => {
    service = new DemoCalendarService();
  });

  it('returns sample events that overlap the requested month and supports pagination', async () => {
    const now = new Date();
    const range = {
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      endExclusive: new Date(now.getFullYear(), now.getMonth() + 1, 1),
    };

    const firstPage = await service.getEventsInRange(range, { limit: 4 });
    const secondPage = await service.getEventsInRange(range, {
      limit: 4,
      offset: firstPage.nextOffset ?? 0,
    });

    expect(firstPage.events).toHaveLength(4);
    expect(firstPage.hasMore).toBe(true);
    expect(secondPage.events.length).toBeGreaterThan(0);
    expect(firstPage.events[0]?.title).toBe('Planning session');
  });

  it('filters events and participants by person and allows demo-only removals', async () => {
    const now = new Date();
    const range = {
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      endExclusive: new Date(now.getFullYear(), now.getMonth() + 1, 1),
    };

    const alexEvents = await service.getEventsForPersonInRange('demo-alex', range);
    expect(alexEvents.events.map(({ title }) => title)).toContain('Planning session');

    const initialParticipants = await service.getParticipants('demo-event-1');
    expect(initialParticipants.map(({ id }) => id)).toEqual(['demo-alex', 'demo-jamie']);

    await service.removePersonFromEvent('demo-event-1', 'demo-alex');
    const updatedParticipants = await service.getParticipants('demo-event-1');
    expect(updatedParticipants.map(({ id }) => id)).toEqual(['demo-jamie']);
  });

  it('returns people in name order', async () => {
    const peoplePage = await service.getPeople({ limit: 2 });
    expect(peoplePage.people.map(({ name }) => name)).toEqual(['Alex Morgan', 'Jamie Lee']);
    expect(peoplePage.hasMore).toBe(true);
    const secondPage = await service.getPeople({
      limit: 2,
      offset: peoplePage.nextOffset ?? 0,
    });
    expect(secondPage.people.map(({ name }) => name)).toEqual(['Riley Chen']);
  });

  it('gets a person by ID and reports when it does not exist', async () => {
    await expect(service.getPerson('demo-alex')).resolves.toMatchObject({
      id: 'demo-alex',
      name: 'Alex Morgan',
    });
    await expect(service.getPerson('missing-person')).rejects.toThrow(
      'Could not find this person.',
    );
  });

  it('creates and deletes temporary demo events', async () => {
    const now = new Date();
    const range = {
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      endExclusive: new Date(now.getFullYear(), now.getMonth() + 1, 1),
    };
    const createdId = await service.createEvent({
      title: 'Demo-only event',
      starts_at: new Date(now.getFullYear(), now.getMonth(), 20, 9).toISOString(),
      ends_at: null,
    });

    const createdEvents = await service.getEventsInRange(range);
    expect(createdEvents.events.some(({ id }) => id === createdId)).toBe(true);

    await service.deleteEvent(createdId);
    const remainingEvents = await service.getEventsInRange(range);
    expect(remainingEvents.events.some(({ id }) => id === createdId)).toBe(false);
  });

  it('creates a demo event with selected participants', async () => {
    const eventId = await service.createEvent(
      {
        title: 'Planning with people',
        starts_at: new Date().toISOString(),
        ends_at: null,
      },
      ['demo-alex', 'demo-riley'],
    );

    expect((await service.getParticipants(eventId)).map(({ id }) => id)).toEqual([
      'demo-alex',
      'demo-riley',
    ]);
  });

  it('supports demo person CRUD and event updates', async () => {
    const person = await service.createPerson({
      name: ' Taylor Kim ',
      grade: 6,
      books: ' Book ',
      notes: ' Notes ',
      small_notes: '',
    });
    expect(person.name).toBe('Taylor Kim');
    expect(person).toMatchObject({
      grade: 6,
      books: 'Book',
      notes: 'Notes',
      small_notes: null,
    });

    await service.updatePerson(person.id, {
      name: 'Taylor Updated',
      grade: null,
      books: null,
      notes: null,
      small_notes: 'Updated',
    });
    expect((await service.getPeople()).people).toContainEqual({
      ...person,
      name: 'Taylor Updated',
      grade: null,
      books: null,
      notes: null,
      small_notes: 'Updated',
    });

    await service.deletePerson(person.id);
    expect((await service.getPeople()).people.some(({ id }) => id === person.id)).toBe(false);

    await service.updateEvent('demo-event-1', {
      title: 'Updated planning',
      starts_at: '2026-10-14T09:00:00.000Z',
      ends_at: null,
    });
    expect(
      (await service.getEvents({ limit: 500 })).events.find(({ id }) => id === 'demo-event-1')?.title,
    ).toBe('Updated planning');
  });

  it('rejects invalid demo person grades', async () => {
    await expect(service.createPerson({
      name: 'Invalid Grade',
      grade: -1,
      books: null,
      notes: null,
      small_notes: null,
    })).rejects.toThrow('Grade must be a whole number between 0 and 12.');
  });
});
