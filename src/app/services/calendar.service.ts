import { Injectable } from '@angular/core';
import {
  addDays,
  addHours,
  endOfDay,
  endOfMonth,
  startOfDay,
  subDays,
} from 'date-fns';
import { Subject } from 'rxjs';
import {
  CalendarEvent,
  CalendarEventAction,
  CalendarEventTimesChangedEvent,
} from 'angular-calendar';
import { EventColor } from 'calendar-utils';
import { Person } from '../models/person.model';

interface PersonCalendarEvent extends CalendarEvent {
  personId?: Person['id'];
}

const colors: Record<string, EventColor> = {
  red: {
    primary: '#ad2121',
    secondary: '#FAE3E3',
  },
  blue: {
    primary: '#1e90ff',
    secondary: '#D1E8FF',
  },
  yellow: {
    primary: '#e3bc08',
    secondary: '#FDF1BA',
  },
};

@Injectable({
  providedIn: 'root',
})
export class CalendarService {
  private calendarEvents: PersonCalendarEvent[] = [];
  private initialized = false;
  private actions: CalendarEventAction[] = [];

  readonly refresh = new Subject<void>();

  get events(): CalendarEvent[] {
    return this.calendarEvents;
  }

  getEvents(personId?: Person['id']): CalendarEvent[] {
    return personId === undefined
      ? this.calendarEvents
      : this.calendarEvents.filter((event) => event.personId === personId);
  }

  initialize(actions: CalendarEventAction[]): void {
    this.actions = actions;

    if (this.initialized) {
      this.calendarEvents = this.calendarEvents.map((event) =>
        event.actions ? { ...event, actions } : event,
      );
      return;
    }

    const today = new Date();
    this.calendarEvents = [
      {
        start: subDays(startOfDay(today), 1),
        end: addDays(today, 1),
        title: 'A 3 day event',
        personId: 'person-1',
        color: { ...colors['red'] },
        actions,
        allDay: true,
        resizable: {
          beforeStart: true,
          afterEnd: true,
        },
        draggable: true,
      },
      {
        start: startOfDay(today),
        title: 'An event with no end date',
        personId: 'person-2',
        color: { ...colors['yellow'] },
        actions,
      },
      {
        start: subDays(endOfMonth(today), 3),
        end: addDays(endOfMonth(today), 3),
        title: 'A long event that spans 2 months',
        personId: 'person-1',
        color: { ...colors['blue'] },
        allDay: true,
      },
      {
        start: addHours(startOfDay(today), 2),
        end: addHours(today, 2),
        title: 'A draggable and resizable event',
        personId: 'person-2',
        color: { ...colors['yellow'] },
        actions,
        resizable: {
          beforeStart: true,
          afterEnd: true,
        },
        draggable: true,
      },
    ];
    this.initialized = true;
  }

  updateEventTimes({ event, newStart, newEnd }: CalendarEventTimesChangedEvent): void {
    this.calendarEvents = this.calendarEvents.map((calendarEvent) =>
      calendarEvent === event
        ? { ...event, start: newStart, end: newEnd }
        : calendarEvent,
    );
    this.refresh.next();
  }

  addEvent(personId?: Person['id']): void {
    this.calendarEvents = [
      ...this.calendarEvents,
      {
        title: 'New event',
        personId,
        start: startOfDay(new Date()),
        end: endOfDay(new Date()),
        color: colors['red'],
        actions: this.actions,
        draggable: true,
        resizable: {
          beforeStart: true,
          afterEnd: true,
        },
      },
    ];
    this.refresh.next();
  }

  deleteEvent(eventToDelete: CalendarEvent): void {
    this.calendarEvents = this.calendarEvents.filter((event) => event !== eventToDelete);
    this.refresh.next();
  }
}
