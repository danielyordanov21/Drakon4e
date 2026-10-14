import { Injectable, inject } from '@angular/core';
import { CalendarEvent } from 'angular-calendar';
import { EventColor } from 'calendar-utils';
import { Database } from '../models/database.types';
import { Person } from '../models/person.model';
import { SUPABASE_CLIENT } from './supabase-client';

export interface CalendarDateRange {
  start: Date;
  endExclusive: Date;
}

export interface EventPage {
  events: CalendarEventRecord[];
  hasMore: boolean;
  nextOffset: number | null;
}

export interface CalendarEventRecord extends CalendarEvent {
  id: string;
}

export interface CalendarPageOptions {
  offset?: number;
  limit?: number;
  signal?: AbortSignal;
}

const DEFAULT_PAGE_SIZE = 200;
const MAX_PAGE_SIZE = 500;
const DEFAULT_EVENT_COLOR: EventColor = {
  primary: '#477b5e',
  secondary: '#eaf1e9',
};

type EventRow = Database['public']['Tables']['events']['Row'];

@Injectable({
  providedIn: 'root',
})
export class CalendarService {
  private readonly getClient = inject(SUPABASE_CLIENT);

  async getEventsInRange(
    range: CalendarDateRange,
    options: CalendarPageOptions = {},
  ): Promise<EventPage> {
    const { offset, limit } = this.validatePageOptions(options);
    const start = this.toIsoString(range.start, 'range.start');
    const end = this.toIsoString(range.endExclusive, 'range.endExclusive');

    if (range.start >= range.endExclusive) {
      throw new RangeError('The calendar range endExclusive must be later than start.');
    }

    const client = await this.getClient();
    const { data, error } = await client
      .from('events')
      .select('id,title,starts_at,ends_at')
      .lt('starts_at', end)
      .or(`ends_at.gt.${start},and(ends_at.is.null,starts_at.gte.${start})`)
      .order('starts_at')
      .order('id')
      .range(offset, offset + limit)
      .abortSignal(options.signal ?? new AbortController().signal);

    if (error) {
      throw new Error(`Could not load calendar events: ${error.message}`, { cause: error });
    }
    return this.toPage(data ?? [], limit, offset);
  }

  async getEventsForPersonInRange(
    personId: Person['id'],
    range: CalendarDateRange,
    options: CalendarPageOptions = {},
  ): Promise<EventPage> {
    const { offset, limit } = this.validatePageOptions(options);
    const start = this.toIsoString(range.start, 'range.start');
    const end = this.toIsoString(range.endExclusive, 'range.endExclusive');

    if (!personId.trim()) {
      throw new TypeError('personId must not be empty.');
    }
    if (range.start >= range.endExclusive) {
      throw new RangeError('The calendar range endExclusive must be later than start.');
    }

    const client = await this.getClient();
    const { data, error } = await client
      .from('events')
      .select('id,title,starts_at,ends_at,event_people!inner(person_id)')
      .eq('event_people.person_id', personId)
      .lt('starts_at', end)
      .or(`ends_at.gt.${start},and(ends_at.is.null,starts_at.gte.${start})`)
      .order('starts_at')
      .order('id')
      .range(offset, offset + limit)
      .abortSignal(options.signal ?? new AbortController().signal);

    if (error) {
      throw new Error(`Could not load this person's calendar: ${error.message}`, {
        cause: error,
      });
    }
    return this.toPage(data ?? [], limit, offset);
  }

  async getParticipants(eventId: string, signal?: AbortSignal): Promise<Person[]> {
    if (!eventId.trim()) {
      throw new TypeError('eventId must not be empty.');
    }

    const { data, error } = await (await this.getClient())
      .from('people')
      .select('id,name,event_people!inner(event_id)')
      .eq('event_people.event_id', eventId)
      .order('name')
      .abortSignal(signal ?? new AbortController().signal);

    if (error) {
      throw new Error(`Could not load event participants: ${error.message}`, { cause: error });
    }

    return (data ?? []).map(({ id, name }) => ({ id, name }));
  }

  async getPeople(signal?: AbortSignal): Promise<Person[]> {
    const { data, error } = await (await this.getClient())
      .from('people')
      .select('id,name')
      .order('name')
      .abortSignal(signal ?? new AbortController().signal);

    if (error) {
      throw new Error(`Could not load people: ${error.message}`, { cause: error });
    }

    return data ?? [];
  }

  async addPersonToEvent(eventId: string, personId: Person['id']): Promise<void> {
    this.validateRelationshipIds(eventId, personId);

    const { error } = await (await this.getClient())
      .from('event_people')
      .upsert(
        { event_id: eventId, person_id: personId },
        { onConflict: 'event_id,person_id', ignoreDuplicates: true },
      );

    if (error) {
      throw new Error(`Could not add this person to the event: ${error.message}`, {
        cause: error,
      });
    }
  }

  async removePersonFromEvent(eventId: string, personId: Person['id']): Promise<void> {
    this.validateRelationshipIds(eventId, personId);

    const { error } = await (await this.getClient())
      .from('event_people')
      .delete()
      .eq('event_id', eventId)
      .eq('person_id', personId);

    if (error) {
      throw new Error(`Could not remove this person from the event: ${error.message}`, {
        cause: error,
      });
    }
  }

  private validatePageOptions(options: CalendarPageOptions): {
    offset: number;
    limit: number;
  } {
    const offset = options.offset ?? 0;
    const limit = options.limit ?? DEFAULT_PAGE_SIZE;
    if (!Number.isInteger(offset) || offset < 0) {
      throw new RangeError('Calendar page offset must be a non-negative integer.');
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
      throw new RangeError(`Calendar page limit must be between 1 and ${MAX_PAGE_SIZE}.`);
    }
    return { offset, limit };
  }

  private toIsoString(date: Date, fieldName: string): string {
    if (Number.isNaN(date.getTime())) {
      throw new TypeError(`${fieldName} must be a valid date.`);
    }
    return date.toISOString();
  }

  private validateRelationshipIds(eventId: string, personId: Person['id']): void {
    if (!eventId.trim() || !personId.trim()) {
      throw new TypeError('eventId and personId must not be empty.');
    }
  }

  private toPage(
    rows: readonly EventRow[],
    limit: number,
    offset: number,
  ): EventPage {
    const hasMore = rows.length > limit;
    const events = rows.slice(0, limit).map((row) => this.toCalendarEvent(row));
    return {
      events,
      hasMore,
      nextOffset: hasMore ? offset + events.length : null,
    };
  }

  private toCalendarEvent(row: EventRow): CalendarEventRecord {
    return {
      id: row.id,
      title: row.title,
      start: new Date(row.starts_at),
      ...(row.ends_at ? { end: new Date(row.ends_at) } : {}),
      color: DEFAULT_EVENT_COLOR,
      draggable: false,
      resizable: {
        beforeStart: false,
        afterEnd: false,
      },
    };
  }
}
