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
    const people = await service.getPeople();
    expect(people.map(({ name }) => name)).toEqual(['Alex Morgan', 'Jamie Lee', 'Riley Chen']);
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

  it('supports demo person CRUD and event updates', async () => {
    const person = await service.createPerson(' Taylor Kim ');
    expect(person.name).toBe('Taylor Kim');

    await service.updatePerson(person.id, 'Taylor Updated');
    expect((await service.getPeople()).some(({ name }) => name === 'Taylor Updated')).toBe(true);

    await service.deletePerson(person.id);
    expect((await service.getPeople()).some(({ id }) => id === person.id)).toBe(false);

    await service.updateEvent('demo-event-1', {
      title: 'Updated planning',
      starts_at: '2026-10-14T09:00:00.000Z',
      ends_at: null,
    });
    expect(
      (await service.getAllEvents()).find(({ id }) => id === 'demo-event-1')?.title,
    ).toBe('Updated planning');
  });
});
