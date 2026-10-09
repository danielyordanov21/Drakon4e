import { TestBed } from '@angular/core/testing';
import { CalendarService } from './calendar.service';

describe('CalendarService', () => {
  let service: CalendarService;

  beforeEach(() => {
    service = TestBed.inject(CalendarService);
    service.initialize([]);
  });

  it('returns all events or only events for the requested person', () => {
    expect(service.getEvents()).toHaveLength(4);
    expect(service.getEvents('person-1')).toHaveLength(2);
    expect(service.getEvents('person-2')).toHaveLength(2);
    expect(service.getEvents('unknown-person')).toHaveLength(0);
  });

  it('assigns new events to the requested person', () => {
    service.addEvent('person-1');

    expect(service.getEvents()).toHaveLength(5);
    expect(service.getEvents('person-1')).toHaveLength(3);
    expect(service.getEvents('person-2')).toHaveLength(2);
  });
});
