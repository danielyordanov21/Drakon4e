import { Injectable } from '@angular/core';
import { CalendarEvent } from 'angular-calendar';
import { EventColor } from 'calendar-utils';
import { CalendarDateRange, CalendarEventRecord, CalendarPageOptions, EventPage } from './calendar.service';
import { Person } from '../models/person.model';

interface DemoEvent {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date | null;
}

const DEMO_PEOPLE: Person[] = [
  { id: 'demo-alex', name: 'Alex Morgan' },
  { id: 'demo-jamie', name: 'Jamie Lee' },
  { id: 'demo-riley', name: 'Riley Chen' },
];

const DEFAULT_EVENT_COLOR: EventColor = {
  primary: '#477b5e',
  secondary: '#eaf1e9',
};

@Injectable()
export class DemoCalendarService {
  private readonly events = this.createEvents();
  private readonly participants = new Map<string, Set<string>>([
    ['demo-event-1', new Set(['demo-alex', 'demo-jamie'])],
    ['demo-event-2', new Set(['demo-riley'])],
    ['demo-event-3', new Set(['demo-alex'])],
    ['demo-event-4', new Set(['demo-jamie', 'demo-riley'])],
    ['demo-event-5', new Set(['demo-alex', 'demo-riley'])],
    ['demo-event-6', new Set(['demo-jamie'])],
  ]);

  async getEventsInRange(
    range: CalendarDateRange,
    options: CalendarPageOptions = {},
  ): Promise<EventPage> {
    return this.getPage(this.events.filter((event) => this.overlaps(event, range)), options);
  }

  async getEventsForPersonInRange(
    personId: Person['id'],
    range: CalendarDateRange,
    options: CalendarPageOptions = {},
  ): Promise<EventPage> {
    return this.getPage(
      this.events.filter(
        (event) =>
          this.overlaps(event, range) && this.participants.get(event.id)?.has(personId),
      ),
      options,
    );
  }

  async getParticipants(eventId: string): Promise<Person[]> {
    const participantIds = this.participants.get(eventId);
    return DEMO_PEOPLE.filter((person) => participantIds?.has(person.id));
  }

  async getPeople(): Promise<Person[]> {
    return [...DEMO_PEOPLE].sort((first, second) => first.name.localeCompare(second.name));
  }

  async addPersonToEvent(eventId: string, personId: Person['id']): Promise<void> {
    this.participants.get(eventId)?.add(personId);
  }

  async removePersonFromEvent(eventId: string, personId: Person['id']): Promise<void> {
    this.participants.get(eventId)?.delete(personId);
  }

  private getPage(
    events: readonly DemoEvent[],
    options: CalendarPageOptions,
  ): EventPage {
    const offset = options.offset ?? 0;
    const limit = options.limit ?? 200;
    const page = events
      .slice()
      .sort((first, second) => first.startsAt.getTime() - second.startsAt.getTime())
      .slice(offset, offset + limit + 1);
    const hasMore = page.length > limit;
    const visibleEvents = page.slice(0, limit).map((event) => this.toCalendarEvent(event));

    return {
      events: visibleEvents,
      hasMore,
      nextOffset: hasMore ? offset + visibleEvents.length : null,
    };
  }

  private overlaps(event: DemoEvent, range: CalendarDateRange): boolean {
    return (
      event.startsAt < range.endExclusive &&
      (event.endsAt
        ? event.endsAt > range.start
        : event.startsAt >= range.start)
    );
  }

  private toCalendarEvent(event: DemoEvent): CalendarEventRecord {
    return {
      id: event.id,
      title: event.title,
      start: event.startsAt,
      ...(event.endsAt ? { end: event.endsAt } : {}),
      color: DEFAULT_EVENT_COLOR,
      draggable: false,
      resizable: { beforeStart: false, afterEnd: false },
    };
  }

  private createEvents(): DemoEvent[] {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const entries = [
      ['Planning session', 2, 9, 30, 60],
      ['Design review', 4, 13, 0, 45],
      ['Project check-in', 7, 10, 0, 30],
      ['Team workshop', 9, 14, 0, 120],
      ['Product demo', 12, 11, 0, 60],
      ['Weekly sync', 14, 9, 0, 30],
      ['Roadmap review', 16, 15, 0, 60],
      ['Coffee catch-up', 19, 10, 30, 30],
      ['Sprint planning', 22, 13, 0, 90],
      ['Retrospective', 25, 16, 0, 60],
    ] as const;

    return entries.map(([title, day, hour, minute, duration], index) => {
      const startsAt = new Date(year, month, day, hour, minute);
      const endsAt = index === 5 ? null : new Date(startsAt.getTime() + duration * 60_000);
      return { id: `demo-event-${index + 1}`, title, startsAt, endsAt };
    });
  }
}
