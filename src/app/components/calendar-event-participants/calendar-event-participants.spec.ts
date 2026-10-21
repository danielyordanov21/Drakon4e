import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { vi } from 'vitest';
import { CalendarEventParticipantsComponent } from './calendar-event-participants';
import { CalendarService } from '../../services/calendar.service';

describe('CalendarEventParticipantsComponent', () => {
  let component: CalendarEventParticipantsComponent;
  let fixture: ComponentFixture<CalendarEventParticipantsComponent>;
  const calendarService = {
    getParticipants: vi.fn().mockResolvedValue([{ id: 'person-1', name: 'Alex' }]),
    getPeople: vi.fn().mockResolvedValue({
      people: [{ id: 'person-1', name: 'Alex' }, { id: 'person-2', name: 'Jamie' }],
      hasMore: false,
      nextOffset: null,
    }),
    addPersonToEvent: vi.fn().mockResolvedValue(undefined),
    removePersonFromEvent: vi.fn().mockResolvedValue(undefined),
    deleteEvent: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [CalendarEventParticipantsComponent],
      providers: [
        { provide: CalendarService, useValue: calendarService },
        { provide: NgbActiveModal, useValue: { close: vi.fn(), dismiss: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CalendarEventParticipantsComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('event', {
      id: 'event-1',
      title: 'Team meeting',
      start: new Date('2026-05-15T09:00:00'),
      end: new Date('2026-05-15T10:00:00'),
    });
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('loads participants and the bounded account people page for the selected event', () => {
    expect(calendarService.getParticipants).toHaveBeenCalledWith(
      'event-1',
      expect.any(AbortSignal),
    );
    expect(calendarService.getPeople).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 200 }),
    );
    expect(component.availablePeople().map(({ id }) => id)).toEqual(['person-2']);
  });

  it('adds and removes participant associations through the service', async () => {
    component.selectedPersonId = 'person-2';
    await component.addParticipant();

    expect(calendarService.addPersonToEvent).toHaveBeenCalledWith('event-1', 'person-2');
    expect(component.participants().map(({ id }) => id)).toEqual(['person-1', 'person-2']);

    await component.removeParticipant({ id: 'person-1', name: 'Alex' });

    expect(calendarService.removePersonFromEvent).toHaveBeenCalledWith('event-1', 'person-1');
    expect(component.participants().map(({ id }) => id)).toEqual(['person-2']);
  });
});
