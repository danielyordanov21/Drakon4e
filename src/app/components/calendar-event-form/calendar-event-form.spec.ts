import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { CalendarEventFormComponent } from './calendar-event-form';
import { CalendarService } from '../../services/calendar.service';

describe('CalendarEventFormComponent', () => {
  let component: CalendarEventFormComponent;
  let fixture: ComponentFixture<CalendarEventFormComponent>;
  const calendarService = {
    getPeople: vi.fn().mockResolvedValue({
      people: [{ id: 'person-1', name: 'Alex' }, { id: 'person-2', name: 'Jamie' }],
      hasMore: false,
      nextOffset: null,
    }),
    createEvent: vi.fn().mockResolvedValue('event-1'),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [CalendarEventFormComponent],
      providers: [{ provide: CalendarService, useValue: calendarService }],
    }).compileComponents();

    fixture = TestBed.createComponent(CalendarEventFormComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('startDate', new Date(2026, 4, 15));
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('loads account people and creates an event with selected participants', async () => {
    component.title = 'Team meeting';
    component.togglePerson('person-2', true);

    await component.save();

    expect(calendarService.getPeople).toHaveBeenCalled();
    expect(calendarService.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Team meeting' }),
      ['person-2'],
    );
  });

  it('automatically includes the current person in a person-calendar event', async () => {
    fixture.destroy();
    fixture = TestBed.createComponent(CalendarEventFormComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('startDate', new Date(2026, 4, 15));
    fixture.componentRef.setInput('personId', 'person-1');
    fixture.detectChanges();
    await fixture.whenStable();
    component.title = 'Personal meeting';

    await component.save();

    expect(calendarService.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Personal meeting' }),
      ['person-1'],
    );
  });
});
