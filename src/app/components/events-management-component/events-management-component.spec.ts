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
  const person: Person = { id: 'person-1', name: 'Alex Morgan' };
  const calendarService = {
    getAllEvents: vi.fn().mockResolvedValue([event]),
    getPeople: vi.fn().mockResolvedValue([person]),
    createEvent: vi.fn().mockResolvedValue('event-2'),
    updateEvent: vi.fn().mockResolvedValue(undefined),
    deleteEvent: vi.fn().mockResolvedValue(undefined),
    getParticipants: vi.fn().mockResolvedValue([person]),
    addPersonToEvent: vi.fn().mockResolvedValue(undefined),
    removePersonFromEvent: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    calendarService.getAllEvents.mockResolvedValue([event]);
    calendarService.getPeople.mockResolvedValue([person]);
    calendarService.getParticipants.mockResolvedValue([person]);

    await TestBed.configureTestingModule({
      imports: [EventsManagementComponent],
      providers: [
        provideRouter([]),
        { provide: CalendarService, useValue: calendarService },
      ],
    }).compileComponents();
  });

  it('creates an event and refreshes the event list', async () => {
    const fixture = TestBed.createComponent(EventsManagementComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();

    component.title = 'New event';
    component.startsAt = '2026-10-15T09:00';
    component.endsAt = '';
    await component.saveEvent();

    expect(calendarService.createEvent).toHaveBeenCalledWith({
      title: 'New event',
      starts_at: new Date('2026-10-15T09:00').toISOString(),
      ends_at: null,
    } satisfies CalendarEventInput);
    expect(calendarService.getAllEvents).toHaveBeenCalledTimes(2);
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
