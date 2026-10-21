import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { Person } from '../../models/person.model';
import { CalendarEventRecord, CalendarService } from '../../services/calendar.service';
import { PeopleManagementComponent } from './people-management-component';

describe('PeopleManagementComponent', () => {
  const existingPerson: Person = {
    id: 'person-1',
    name: 'Alex Morgan',
    grade: 7,
    books: 'Math',
    notes: 'Needs review',
    small_notes: 'Call home',
  };
  const event: CalendarEventRecord = {
    id: 'event-1',
    title: 'Planning',
    start: new Date('2026-10-14T09:00:00.000Z'),
    color: { primary: '#477b5e', secondary: '#eaf1e9' },
  };
  const nextEvent: CalendarEventRecord = {
    ...event,
    id: 'event-2',
    title: 'Review',
    start: new Date('2026-10-15T09:00:00.000Z'),
  };
  const calendarService = {
    getPeople: vi.fn().mockResolvedValue({
      people: [existingPerson],
      hasMore: false,
      nextOffset: null,
    }),
    getEvents: vi.fn().mockResolvedValue({ events: [event], hasMore: false, nextOffset: null }),
    getEventsForPerson: vi.fn().mockResolvedValue({
      events: [],
      hasMore: false,
      nextOffset: null,
    }),
    createPerson: vi.fn().mockResolvedValue({
      id: 'person-2',
      name: 'Jamie Lee',
      grade: null,
      books: null,
      notes: null,
      small_notes: null,
    }),
    updatePerson: vi.fn().mockResolvedValue(undefined),
    deletePerson: vi.fn().mockResolvedValue(undefined),
    addPersonToEvent: vi.fn().mockResolvedValue(undefined),
    removePersonFromEvent: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    calendarService.getPeople.mockResolvedValue({
      people: [existingPerson],
      hasMore: false,
      nextOffset: null,
    });
    calendarService.getEvents.mockResolvedValue({
      events: [event],
      hasMore: false,
      nextOffset: null,
    });
    calendarService.getEventsForPerson.mockResolvedValue({
      events: [],
      hasMore: false,
      nextOffset: null,
    });
    calendarService.createPerson.mockResolvedValue({
      id: 'person-2',
      name: 'Jamie Lee',
      grade: null,
      books: null,
      notes: null,
      small_notes: null,
    });

    await TestBed.configureTestingModule({
      imports: [PeopleManagementComponent],
      providers: [
        provideRouter([]),
        { provide: CalendarService, useValue: calendarService },
      ],
    }).compileComponents();
  });

  it('adds a person through the account-scoped calendar service', async () => {
    const fixture = TestBed.createComponent(PeopleManagementComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();

    component.name = 'Jamie Lee';
    component.grade = 6;
    component.books = 'Science';
    component.notes = 'Bring materials';
    component.smallNotes = 'Check in';
    await component.savePerson();

    expect(calendarService.createPerson).toHaveBeenCalledWith({
      name: 'Jamie Lee',
      grade: 6,
      books: 'Science',
      notes: 'Bring materials',
      small_notes: 'Check in',
    });
    expect(component.people().map(({ id }) => id)).toEqual(['person-1', 'person-2']);
  });

  it('edits an existing person', async () => {
    const fixture = TestBed.createComponent(PeopleManagementComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();

    component.startEditing(existingPerson);
    component.name = 'Alex Updated';
    component.grade = 8;
    component.books = 'Updated books';
    component.notes = 'Updated notes';
    component.smallNotes = 'Updated small note';
    await component.savePerson();

    expect(calendarService.updatePerson).toHaveBeenCalledWith('person-1', {
      name: 'Alex Updated',
      grade: 8,
      books: 'Updated books',
      notes: 'Updated notes',
      small_notes: 'Updated small note',
    });
    expect(component.people()[0]?.name).toBe('Alex Updated');
    expect(component.people()[0]?.grade).toBe(8);
  });

  it('uses a multiline auto-growing books field and validates the grade range in the form', async () => {
    const fixture = TestBed.createComponent(PeopleManagementComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const booksField = fixture.nativeElement.querySelector(
      '#person-books',
    ) as HTMLTextAreaElement;
    const gradeField = fixture.nativeElement.querySelector(
      '#person-grade',
    ) as HTMLInputElement;
    Object.defineProperty(booksField, 'scrollHeight', { configurable: true, value: 96 });
    booksField.dispatchEvent(new Event('input'));

    expect(booksField.tagName).toBe('TEXTAREA');
    expect(booksField.style.height).toBe('96px');
    expect(gradeField.min).toBe('0');
    expect(gradeField.max).toBe('12');
    expect(gradeField.step).toBe('1');
  });

  it('adds an existing event to a specific person and can remove it', async () => {
    const fixture = TestBed.createComponent(PeopleManagementComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();

    await component.togglePersonEvents(existingPerson);
    component.selectedEventId = event.id;
    await component.addEventToPerson(existingPerson);

    expect(calendarService.addPersonToEvent).toHaveBeenCalledWith('event-1', 'person-1');
    expect(component.personEvents()).toEqual([event]);

    await component.removeEventFromPerson(existingPerson, event);
    expect(calendarService.removePersonFromEvent).toHaveBeenCalledWith('event-1', 'person-1');
    expect(component.personEvents()).toEqual([]);
  });

  it('loads event and people records in bounded management pages', async () => {
    const nextPerson = { id: 'person-2', name: 'Jamie Lee' };
    calendarService.getPeople
      .mockResolvedValueOnce({ people: [existingPerson], hasMore: true, nextOffset: 1 })
      .mockResolvedValueOnce({ people: [nextPerson], hasMore: false, nextOffset: null });
    const fixture = TestBed.createComponent(PeopleManagementComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();

    await component.loadMorePeople();
    expect(component.people().map(({ id }) => id)).toEqual(['person-1', 'person-2']);

    calendarService.getEvents.mockResolvedValueOnce({
      events: [event],
      hasMore: true,
      nextOffset: 1,
    });
    calendarService.getEventsForPerson.mockResolvedValueOnce({
      events: [],
      hasMore: false,
      nextOffset: null,
    });
    await component.togglePersonEvents(existingPerson);
    calendarService.getEvents.mockResolvedValueOnce({
      events: [nextEvent],
      hasMore: false,
      nextOffset: null,
    });
    await component.loadMoreEvents();

    expect(component.allEvents().map(({ id }) => id)).toEqual(['event-1', 'event-2']);
    expect(component.hasMoreEvents()).toBe(false);
  });
});
