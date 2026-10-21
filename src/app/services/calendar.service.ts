import { Injectable, inject } from '@angular/core';
import { CalendarEvent } from 'angular-calendar';
import { EventColor } from 'calendar-utils';
import { Database } from '../models/database.types';
import { Person, PersonInput } from '../models/person.model';
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

export interface PeoplePage {
  people: Person[];
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

export interface CalendarEventInput {
  title: string;
  starts_at: string;
  ends_at: string | null;
}

const DEFAULT_PAGE_SIZE = 200;
const MAX_PAGE_SIZE = 500;
const DEFAULT_EVENT_COLOR: EventColor = {
  primary: '#477b5e',
  secondary: '#eaf1e9',
};

type EventRow = Pick<
  Database['public']['Tables']['events']['Row'],
  'id' | 'title' | 'starts_at' | 'ends_at'
>;

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

  async getEvents(options: CalendarPageOptions = {}): Promise<EventPage> {
    const { offset, limit } = this.validatePageOptions(options);
    const { data, error } = await (await this.getClient())
      .from('events')
      .select('id,title,starts_at,ends_at')
      .order('starts_at')
      .order('id')
      .range(offset, offset + limit)
      .abortSignal(options.signal ?? new AbortController().signal);

    if (error) {
      throw new Error(`Could not load events: ${error.message}`, { cause: error });
    }
    return this.toPage(data ?? [], limit, offset);
  }

  async getEventsForPerson(
    personId: Person['id'],
    options: CalendarPageOptions = {},
  ): Promise<EventPage> {
    const { offset, limit } = this.validatePageOptions(options);
    if (!personId.trim()) {
      throw new TypeError('personId must not be empty.');
    }

    const { data, error } = await (await this.getClient())
      .from('events')
      .select('id,title,starts_at,ends_at,event_people!inner(person_id)')
      .eq('event_people.person_id', personId)
      .order('starts_at')
      .order('id')
      .range(offset, offset + limit)
      .abortSignal(options.signal ?? new AbortController().signal);

    if (error) {
      throw new Error(`Could not load this person's events: ${error.message}`, {
        cause: error,
      });
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

  async getPeople(options: CalendarPageOptions = {}): Promise<PeoplePage> {
    const { offset, limit } = this.validatePageOptions(options);
    const { data, error } = await (await this.getClient())
      .from('people')
      .select('id,name,grade,books,notes,small_notes')
      .order('name')
      .order('id')
      .range(offset, offset + limit)
      .abortSignal(options.signal ?? new AbortController().signal);

    if (error) {
      throw new Error(`Could not load people: ${error.message}`, { cause: error });
    }

    const rows = data ?? [];
    const hasMore = rows.length > limit;
    const people = rows.slice(0, limit);
    return {
      people,
      hasMore,
      nextOffset: hasMore ? offset + people.length : null,
    };
  }

  async getPerson(personId: Person['id'], signal?: AbortSignal): Promise<Person> {
    if (!personId.trim()) {
      throw new TypeError('Person ID must not be empty.');
    }

    const { data, error } = await (await this.getClient())
      .from('people')
      .select('id,name,grade,books,notes,small_notes')
      .eq('id', personId)
      .abortSignal(signal ?? new AbortController().signal)
      .maybeSingle();

    if (error) {
      throw new Error(`Could not load person: ${error.message}`, { cause: error });
    }
    if (!data) {
      throw new Error('Could not find this person.');
    }
    return data;
  }

  async createPerson(person: PersonInput): Promise<Person> {
    const normalizedPerson = this.normalizePersonInput(person);

    const client = await this.getClient();
    const ownerId = await this.getAuthenticatedOwnerId(client);
    const { data, error } = await client
      .from('people')
      .insert({ ...normalizedPerson, owner_id: ownerId })
      .select('id,name,grade,books,notes,small_notes')
      .single();

    if (error) {
      throw new Error(`Could not create person: ${error.message}`, { cause: error });
    }
    return data;
  }

  async updatePerson(personId: Person['id'], person: PersonInput): Promise<void> {
    if (!personId.trim()) {
      throw new TypeError('Person ID must not be empty.');
    }
    const normalizedPerson = this.normalizePersonInput(person);

    const { data, error } = await (await this.getClient())
      .from('people')
      .update(normalizedPerson)
      .eq('id', personId)
      .select('id')
      .maybeSingle();

    if (error) {
      throw new Error(`Could not update person: ${error.message}`, { cause: error });
    }
    if (!data) {
      throw new Error('Could not update person: no matching person was found.');
    }
  }

  async deletePerson(personId: Person['id']): Promise<void> {
    if (!personId.trim()) {
      throw new TypeError('Person ID must not be empty.');
    }

    const { data, error } = await (await this.getClient())
      .from('people')
      .delete()
      .eq('id', personId)
      .select('id')
      .maybeSingle();

    if (error) {
      throw new Error(`Could not delete person: ${error.message}`, { cause: error });
    }
    if (!data) {
      throw new Error('Could not delete person: no matching person was found.');
    }
  }

  async createEvent(
    event: CalendarEventInput,
    participantIds: readonly Person['id'][] = [],
  ): Promise<string> {
    const normalizedEvent = this.validateEventInput(event);
    const uniqueParticipantIds = [...new Set(participantIds)];
    if (uniqueParticipantIds.some((personId) => !personId.trim())) {
      throw new TypeError('Participant IDs must not be empty.');
    }
    const client = await this.getClient();
    const ownerId = await this.getAuthenticatedOwnerId(client);
    const { data, error } = await client
      .from('events')
      .insert({ ...normalizedEvent, owner_id: ownerId })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Could not create event: ${error.message}`, { cause: error });
    }

    if (uniqueParticipantIds.length > 0) {
      const { error: linkError } = await client.from('event_people').upsert(
        uniqueParticipantIds.map((personId) => ({
          event_id: data.id,
          person_id: personId,
          owner_id: ownerId,
        })),
        { onConflict: 'event_id,person_id', ignoreDuplicates: true },
      );

      if (linkError) {
        try {
          await this.deleteEvent(data.id);
        } catch (rollbackError: unknown) {
          const rollbackMessage =
            rollbackError instanceof Error ? rollbackError.message : 'Unknown cleanup error.';
          throw new Error(
            `Event ${data.id} was created, but participant assignment failed (${linkError.message}) and cleanup failed (${rollbackMessage}).`,
            { cause: linkError },
          );
        }
        throw new Error(
          `Could not assign participants; the new event was removed: ${linkError.message}`,
          { cause: linkError },
        );
      }
    }

    return data.id;
  }

  async updateEvent(eventId: string, event: CalendarEventInput): Promise<void> {
    if (!eventId.trim()) {
      throw new TypeError('Event ID must not be empty.');
    }
    const normalizedEvent = this.validateEventInput(event);
    const { data, error } = await (await this.getClient())
      .from('events')
      .update(normalizedEvent)
      .eq('id', eventId)
      .select('id')
      .maybeSingle();

    if (error) {
      throw new Error(`Could not update event: ${error.message}`, { cause: error });
    }
    if (!data) {
      throw new Error('Could not update event: no matching event was found.');
    }
  }

  async deleteEvent(eventId: string): Promise<void> {
    if (!eventId.trim()) {
      throw new TypeError('Event ID must not be empty.');
    }

    const { data, error } = await (await this.getClient())
      .from('events')
      .delete()
      .eq('id', eventId)
      .select('id')
      .maybeSingle();

    if (error) {
      throw new Error(`Could not delete event: ${error.message}`, { cause: error });
    }
    if (!data) {
      throw new Error('Could not delete event: no matching event was found.');
    }
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

    const { data, error } = await (await this.getClient())
      .from('event_people')
      .delete()
      .eq('event_id', eventId)
      .eq('person_id', personId)
      .select('event_id')
      .maybeSingle();

    if (error) {
      throw new Error(`Could not remove this person from the event: ${error.message}`, {
        cause: error,
      });
    }
    if (!data) {
      throw new Error('Could not remove this person from the event: no matching link was found.');
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

  private async getAuthenticatedOwnerId(
    client: Awaited<ReturnType<typeof this.getClient>>,
  ): Promise<string> {
    const { data, error } = await client.auth.getUser();
    if (error) {
      throw new Error(`Could not verify the signed-in user: ${error.message}`, {
        cause: error,
      });
    }
    if (!data.user) {
      throw new Error('You must be signed in to create people or events.');
    }
    return data.user.id;
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

  private normalizePersonInput(person: PersonInput): PersonInput {
    const name = person.name.trim();
    if (!name) {
      throw new TypeError('Person name must not be empty.');
    }
    if (
      person.grade !== null &&
      (!Number.isInteger(person.grade) || person.grade < 0 || person.grade > 12)
    ) {
      throw new RangeError('Grade must be a whole number between 0 and 12.');
    }

    const normalizeText = (value: string | null): string | null => {
      const normalizedValue = value?.trim() ?? '';
      return normalizedValue || null;
    };

    return {
      name,
      grade: person.grade,
      books: normalizeText(person.books),
      notes: normalizeText(person.notes),
      small_notes: normalizeText(person.small_notes),
    };
  }

  private validateEventInput(event: CalendarEventInput): CalendarEventInput {
    const title = event.title.trim();
    const startsAt = new Date(event.starts_at);
    const endsAt = event.ends_at === null ? null : new Date(event.ends_at);

    if (!title) {
      throw new TypeError('Event title must not be empty.');
    }
    if (Number.isNaN(startsAt.getTime())) {
      throw new TypeError('Event start must be a valid date.');
    }
    if (endsAt && (Number.isNaN(endsAt.getTime()) || endsAt <= startsAt)) {
      throw new RangeError('Event end must be later than its start.');
    }

    return {
      title,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt?.toISOString() ?? null,
    };
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
