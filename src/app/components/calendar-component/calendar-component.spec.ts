import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { vi } from 'vitest';
import { CalendarComponent } from './calendar-component';
import { CalendarService } from '../../services/calendar.service';

describe('CalendarComponent', () => {
  let component: CalendarComponent;
  let fixture: ComponentFixture<CalendarComponent>;
  const calendarService = {
    getEventsInRange: vi.fn().mockResolvedValue({ events: [], hasMore: false, nextOffset: null }),
    getEventsForPersonInRange: vi
      .fn()
      .mockResolvedValue({ events: [], hasMore: false, nextOffset: null }),
    getPeople: vi.fn().mockResolvedValue({
      people: [{ id: 'person-1', name: 'Alex' }],
      hasMore: false,
      nextOffset: null,
    }),
    createEvent: vi.fn().mockResolvedValue('event-1'),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [CalendarComponent],
      providers: [
        { provide: CalendarService, useValue: calendarService },
        { provide: NgbModal, useValue: { open: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CalendarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('loads the current visible calendar range', () => {
    expect(component).toBeTruthy();
    expect(calendarService.getEventsInRange).toHaveBeenCalled();
  });

  it('requests a fresh range after changing calendar views', async () => {
    const initialCalls = calendarService.getEventsInRange.mock.calls.length;

    component.setView(component.CalendarView.Week);
    await fixture.whenStable();

    expect(calendarService.getEventsInRange.mock.calls.length).toBeGreaterThan(initialCalls);
  });
});
