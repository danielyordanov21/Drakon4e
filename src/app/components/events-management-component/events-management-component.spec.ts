import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { Person } from '../../models/person.model';
import { CalendarEventInput, CalendarEventRecord, CalendarService } from '../../services/calendar.service';
import { EventsManagementComponent } from './events-management-component';

describe('EventsManagementComponent', () => {
  const event: CalendarEventRecord = {
    id: 'event-1',
    title: 'Planning',
    start: new Date('2026-10-14T09:00:00.000Z'),
    end: new Date('2026-10-14T10:00:00.000Z'),
    color: { primary: '#477b5e', secondary: '#eaf1e9' },
  };
  const nextEvent: CalendarEventRecord = {
    ...event,
    id: 'event-2',
    title: 'Review',
    start: new Date('2026-10-15T09:00:00.000Z'),
  };
  const person: Person = { id: 'person-1', name: 'Alex Morgan' };
  const calendarService = {
    getEvents: vi.fn().mockResolvedValue({ events: [event], hasMore: false, nextOffset: null }),
    getPeople: vi.fn().mockResolvedValue({ people: [person], hasMore: false, nextOffset: null }),
    createEvent: vi.fn().mockResolvedValue('event-2'),
    updateEvent: vi.fn().mockResolvedValue(undefined),
    deleteEvent: vi.fn().mockResolvedValue(undefined),
    getParticipants: vi.fn().mockResolvedValue([person]),
    addPersonToEvent: vi.fn().mockResolvedValue(undefined),
    removePersonFromEvent: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    calendarService.getEvents.mockResolvedValue({
      events: [event],
      hasMore: false,
      nextOffset: null,
    });
    calendarService.getPeople.mockResolvedValue({
      people: [person],
      hasMore: false,
      nextOffset: null,
    });
    calendarService.getParticipants.mockResolvedValue([person]);

    await TestBed.configureTestingModule({
      imports: [EventsManagementComponent],
      providers: [
        provideRouter([]),
        { provide: CalendarService, useValue: calendarService },
      ],
    }).compileComponents();
  });

  it('creates an event without reloading the complete event list', async () => {
    const fixture = TestBed.createComponent(EventsManagementComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();

    component.title = 'New event';
    component.startsAt = '2026-10-15T09:00';
    component.endsAt = '';
    await component.saveEvent();

    expect(calendarService.createEvent).toHaveBeenCalledWith(
      {
        title: 'New event',
        starts_at: new Date('2026-10-15T09:00').toISOString(),
        ends_at: null,
      } satisfies CalendarEventInput,
      [],
    );
    expect(component.events().map(({ id }) => id)).toContain('event-2');
    expect(calendarService.getEvents).toHaveBeenCalledTimes(1);
  });

  it('passes selected account people when creating an event', async () => {
    const fixture = TestBed.createComponent(EventsManagementComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();

    component.title = 'Team meeting';
    component.startsAt = '2026-10-15T09:00';
    component.toggleCreationParticipant(person.id, true);
    await component.saveEvent();

    expect(calendarService.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Team meeting' }),
      ['person-1'],
    );
  });

  it('loads another bounded page of events when requested', async () => {
    calendarService.getEvents
      .mockResolvedValueOnce({ events: [event], hasMore: true, nextOffset: 1 })
      .mockResolvedValueOnce({ events: [nextEvent], hasMore: false, nextOffset: null });
    const fixture = TestBed.createComponent(EventsManagementComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitFor(() => expect(component.hasMoreEvents()).toBe(true));

    await component.loadMoreEvents();

    expect(component.events().map(({ id }) => id)).toEqual(['event-1', 'event-2']);
    expect(component.hasMoreEvents()).toBe(false);
    expect(calendarService.getEvents).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ offset: 1, limit: 200 }),
    );
  });

  it('edits an event and assigns a person to it', async () => {
    const fixture = TestBed.createComponent(EventsManagementComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();

    component.startEditing(event);
    component.title = 'Updated planning';
    await component.saveEvent();

    expect(calendarService.updateEvent).toHaveBeenCalledWith(
      'event-1',
      expect.objectContaining({ title: 'Updated planning' }),
    );
    expect(component.events()[0]?.title).toBe('Updated planning');

    await component.toggleParticipants(event);
    expect(component.participants()).toEqual([person]);
    await component.removePersonFromEvent(person);
    expect(calendarService.removePersonFromEvent).toHaveBeenCalledWith('event-1', 'person-1');
  });
});
