import { Injectable } from '@angular/core';
import { CalendarEvent } from 'angular-calendar';
import { EventColor } from 'calendar-utils';
import {
  CalendarDateRange,
  CalendarEventInput,
  CalendarEventRecord,
  CalendarPageOptions,
  EventPage,
  PeoplePage,
} from './calendar.service';
import { Person, PersonInput } from '../models/person.model';

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
  private readonly people = DEMO_PEOPLE.map((person) => ({ ...person }));
  private nextEventId = this.events.length + 1;
  private nextPersonId = this.people.length + 1;
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

  async getEvents(options: CalendarPageOptions = {}): Promise<EventPage> {
    return this.getPage(this.events, options);
  }

  async getEventsForPerson(
    personId: Person['id'],
    options: CalendarPageOptions = {},
  ): Promise<EventPage> {
    return this.getPage(
      this.events.filter((event) => this.participants.get(event.id)?.has(personId)),
      options,
    );
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
    return this.people.filter((person) => participantIds?.has(person.id));
  }

  async getPeople(options: CalendarPageOptions = {}): Promise<PeoplePage> {
    const offset = options.offset ?? 0;
    const limit = options.limit ?? 200;
    const page = this.people
      .slice()
      .sort((first, second) => first.name.localeCompare(second.name))
      .slice(offset, offset + limit + 1);
    const hasMore = page.length > limit;
    const people = page.slice(0, limit);
    return {
      people,
      hasMore,
      nextOffset: hasMore ? offset + people.length : null,
    };
  }

  async getPerson(personId: Person['id']): Promise<Person> {
    const person = this.people.find(({ id }) => id === personId);
    if (!person) {
      throw new Error('Could not find this person.');
    }
    return { ...person };
  }

  async createPerson(input: PersonInput): Promise<Person> {
    const normalizedInput = this.normalizePersonInput(input);
    const person = { id: `demo-person-${this.nextPersonId++}`, ...normalizedInput };
    this.people.push(person);
    return person;
  }

  async updatePerson(personId: Person['id'], input: PersonInput): Promise<void> {
    const person = this.people.find(({ id }) => id === personId);
    if (!personId.trim()) {
      throw new TypeError('Person ID must not be empty.');
    }
    if (!person) {
      throw new Error('Could not find this person.');
    }
    Object.assign(person, this.normalizePersonInput(input));
  }

  async deletePerson(personId: Person['id']): Promise<void> {
    const personIndex = this.people.findIndex(({ id }) => id === personId);
    if (personIndex >= 0) {
      this.people.splice(personIndex, 1);
    }
    for (const participantIds of this.participants.values()) {
      participantIds.delete(personId);
    }
  }

  async addPersonToEvent(eventId: string, personId: Person['id']): Promise<void> {
    if (!this.people.some(({ id }) => id === personId)) {
      throw new Error('Could not find this person.');
    }
    const participants = this.participants.get(eventId);
    if (!participants) {
      throw new Error('Could not find this event.');
    }
    participants.add(personId);
  }

  async removePersonFromEvent(eventId: string, personId: Person['id']): Promise<void> {
    this.participants.get(eventId)?.delete(personId);
  }

  async createEvent(
    event: CalendarEventInput,
    participantIds: readonly Person['id'][] = [],
  ): Promise<string> {
    const title = event.title.trim();
    const startsAt = new Date(event.starts_at);
    const endsAt = event.ends_at ? new Date(event.ends_at) : null;
    if (!title) {
      throw new TypeError('Event title must not be empty.');
    }
    if (Number.isNaN(startsAt.getTime())) {
      throw new TypeError('Event start must be a valid date.');
    }
    if (endsAt && (Number.isNaN(endsAt.getTime()) || endsAt <= startsAt)) {
      throw new RangeError('Event end must be later than its start.');
    }

    const id = `demo-event-${this.nextEventId++}`;
    this.events.push({ id, title, startsAt, endsAt });
    this.participants.set(id, new Set());
    try {
      for (const personId of new Set(participantIds)) {
        await this.addPersonToEvent(id, personId);
      }
    } catch (error: unknown) {
      this.events.splice(
        this.events.findIndex(({ id: currentId }) => currentId === id),
        1,
      );
      this.participants.delete(id);
      throw error;
    }
    return id;
  }

  async updateEvent(eventId: string, event: CalendarEventInput): Promise<void> {
    const target = this.events.find(({ id }) => id === eventId);
    const title = event.title.trim();
    const startsAt = new Date(event.starts_at);
    const endsAt = event.ends_at ? new Date(event.ends_at) : null;
    if (!eventId.trim() || !target) {
      throw new Error('Could not find this event.');
    }
    if (!title) {
      throw new TypeError('Event title must not be empty.');
    }
    if (Number.isNaN(startsAt.getTime())) {
      throw new TypeError('Event start must be a valid date.');
    }
    if (endsAt && (Number.isNaN(endsAt.getTime()) || endsAt <= startsAt)) {
      throw new RangeError('Event end must be later than its start.');
    }
    target.title = title;
    target.startsAt = startsAt;
    target.endsAt = endsAt;
  }

  async deleteEvent(eventId: string): Promise<void> {
    const eventIndex = this.events.findIndex(({ id }) => id === eventId);
    if (eventIndex >= 0) {
      this.events.splice(eventIndex, 1);
    }
    this.participants.delete(eventId);
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

  private normalizePersonInput(input: PersonInput): PersonInput {
    const name = input.name.trim();
    if (!name) {
      throw new TypeError('Person name must not be empty.');
    }
    if (
      input.grade !== null &&
      (!Number.isInteger(input.grade) || input.grade < 0 || input.grade > 12)
    ) {
      throw new RangeError('Grade must be a whole number between 0 and 12.');
    }

    const normalizeText = (value: string | null): string | null => {
      const normalizedValue = value?.trim() ?? '';
      return normalizedValue || null;
    };

    return {
      name,
      grade: input.grade,
      books: normalizeText(input.books),
      notes: normalizeText(input.notes),
      small_notes: normalizeText(input.small_notes),
    };
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
