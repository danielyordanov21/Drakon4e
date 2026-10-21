import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { I18nService } from '../../services/i18n.service';
import { Person } from '../../models/person.model';
import {
  CalendarEventInput,
  CalendarEventRecord,
  CalendarService,
} from '../../services/calendar.service';

const MANAGEMENT_PAGE_SIZE = 200;

@Component({
  selector: 'app-events-management-component',
  imports: [DatePipe, FormsModule, RouterLink],
  templateUrl: './events-management-component.html',
  styleUrl: './events-management-component.scss',
})
export class EventsManagementComponent {
  private readonly calendarService = inject(CalendarService);
  readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly controller = new AbortController();
  private participantsController: AbortController | null = null;

  readonly events = signal<CalendarEventRecord[]>([]);
  readonly people = signal<Person[]>([]);
  readonly selectedParticipantIds = signal<string[]>([]);
  readonly participants = signal<Person[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly loadingMoreEvents = signal(false);
  readonly loadingMorePeople = signal(false);
  readonly loadingParticipants = signal(false);
  readonly changingParticipantId = signal<string | null>(null);
  readonly deletingEventId = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly hasMoreEvents = signal(false);
  readonly hasMorePeople = signal(false);
  readonly editingEventId = signal<string | null>(null);
  readonly managingEventId = signal<string | null>(null);
  readonly peopleToAdd = computed(() =>
    this.people().filter(
      (person) => !this.participants().some(({ id }) => id === person.id),
    ),
  );

  title = '';
  startsAt = '';
  endsAt = '';
  selectedPersonId = '';

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.controller.abort();
      this.participantsController?.abort();
    });
    void this.loadData();
  }

  startEditing(event: CalendarEventRecord): void {
    this.editingEventId.set(event.id);
    this.title = event.title;
    this.startsAt = this.toDateTimeLocalInput(event.start);
    this.endsAt = event.end ? this.toDateTimeLocalInput(event.end) : '';
    this.errorMessage.set(null);
  }

  cancelEditing(): void {
    this.editingEventId.set(null);
    this.title = '';
    this.startsAt = '';
    this.endsAt = '';
    this.selectedParticipantIds.set([]);
    this.errorMessage.set(null);
  }

  toggleCreationParticipant(personId: string, selected: boolean): void {
    this.selectedParticipantIds.update((ids) =>
      selected
        ? ids.includes(personId)
          ? ids
          : [...ids, personId]
        : ids.filter((id) => id !== personId),
    );
  }

  async saveEvent(): Promise<void> {
    this.saving.set(true);
    this.errorMessage.set(null);
    try {
      const input = this.createEventInput();
      const eventId = this.editingEventId();
      if (eventId) {
        await this.calendarService.updateEvent(eventId, input);
        const updated = this.toRecord(eventId, input);
        this.mergeEvent(updated);
      } else {
        const createdId = await this.calendarService.createEvent(
          input,
          this.selectedParticipantIds(),
        );
        this.mergeEvent(this.toRecord(createdId, input));
      }
      this.cancelEditing();
    } catch (error: unknown) {
      this.errorMessage.set(
        this.i18n.translateError(error, 'errors.unexpectedEvent'),
      );
    } finally {
      this.saving.set(false);
    }
  }

  async deleteEvent(event: CalendarEventRecord): Promise<void> {
    if (
      this.deletingEventId() !== null ||
      !window.confirm(`Delete “${event.title}” and its participant links?`)
    ) {
      return;
    }

    this.errorMessage.set(null);
    this.deletingEventId.set(event.id);
    try {
      await this.calendarService.deleteEvent(event.id);
      this.events.update((events) => events.filter(({ id }) => id !== event.id));
      if (this.editingEventId() === event.id) {
        this.cancelEditing();
      }
      if (this.managingEventId() === event.id) {
        this.managingEventId.set(null);
        this.participants.set([]);
      }
    } catch (error: unknown) {
      this.errorMessage.set(
        this.i18n.translateError(error, 'errors.unexpectedEvent'),
      );
    } finally {
      this.deletingEventId.set(null);
    }
  }

  async toggleParticipants(event: CalendarEventRecord): Promise<void> {
    if (this.managingEventId() === event.id) {
      this.participantsController?.abort();
      this.participantsController = null;
      this.managingEventId.set(null);
      this.participants.set([]);
      this.loadingParticipants.set(false);
      this.selectedPersonId = '';
      return;
    }

    this.participantsController?.abort();
    const controller = new AbortController();
    this.participantsController = controller;
    this.managingEventId.set(event.id);
    this.participants.set([]);
    this.selectedPersonId = '';
    this.errorMessage.set(null);
    this.loadingParticipants.set(true);
    try {
      const participants = await this.calendarService.getParticipants(
        event.id,
        controller.signal,
      );
      if (!controller.signal.aborted && this.managingEventId() === event.id) {
        this.participants.set(participants);
      }
    } catch (error: unknown) {
      if (!controller.signal.aborted) {
        this.errorMessage.set(
          this.i18n.translateError(error, 'errors.unexpectedParticipant'),
        );
      }
    } finally {
      if (!controller.signal.aborted && this.managingEventId() === event.id) {
        this.loadingParticipants.set(false);
        this.participantsController = null;
      }
    }
  }

  async addPersonToEvent(): Promise<void> {
    const eventId = this.managingEventId();
    const person = this.peopleToAdd().find(({ id }) => id === this.selectedPersonId);
    if (!eventId || !person) {
      return;
    }

    this.errorMessage.set(null);
    this.changingParticipantId.set(person.id);
    try {
      await this.calendarService.addPersonToEvent(eventId, person.id);
      this.participants.update((people) =>
        people.some(({ id }) => id === person.id)
          ? people
          : [...people, person].sort((first, second) => first.name.localeCompare(second.name)),
      );
      this.selectedPersonId = '';
    } catch (error: unknown) {
      this.errorMessage.set(
        this.i18n.translateError(error, 'errors.unexpectedParticipant'),
      );
    } finally {
      this.changingParticipantId.set(null);
    }
  }

  async removePersonFromEvent(person: Person): Promise<void> {
    const eventId = this.managingEventId();
    if (!eventId) {
      return;
    }

    this.errorMessage.set(null);
    this.changingParticipantId.set(person.id);
    try {
      await this.calendarService.removePersonFromEvent(eventId, person.id);
      this.participants.update((people) => people.filter(({ id }) => id !== person.id));
    } catch (error: unknown) {
      this.errorMessage.set(
        this.i18n.translateError(error, 'errors.unexpectedParticipant'),
      );
    } finally {
      this.changingParticipantId.set(null);
    }
  }

  async loadMoreEvents(): Promise<void> {
    if (this.loadingMoreEvents() || !this.hasMoreEvents()) {
      return;
    }
    this.loadingMoreEvents.set(true);
    try {
      const page = await this.calendarService.getEvents({
        offset: this.events().length,
        limit: MANAGEMENT_PAGE_SIZE,
        signal: this.controller.signal,
      });
      this.events.update((events) => [...events, ...page.events]);
      this.hasMoreEvents.set(page.hasMore);
    } catch (error: unknown) {
      if (!this.controller.signal.aborted) {
        this.errorMessage.set(this.i18n.translateError(error, 'errors.unexpectedEvent'));
      }
    } finally {
      if (!this.controller.signal.aborted) {
        this.loadingMoreEvents.set(false);
      }
    }
  }

  async loadMorePeople(): Promise<void> {
    if (this.loadingMorePeople() || !this.hasMorePeople()) {
      return;
    }
    this.loadingMorePeople.set(true);
    try {
      const page = await this.calendarService.getPeople({
        offset: this.people().length,
        limit: MANAGEMENT_PAGE_SIZE,
        signal: this.controller.signal,
      });
      this.people.update((people) => [...people, ...page.people]);
      this.hasMorePeople.set(page.hasMore);
    } catch (error: unknown) {
      if (!this.controller.signal.aborted) {
        this.errorMessage.set(this.i18n.translateError(error, 'picker.error'));
      }
    } finally {
      if (!this.controller.signal.aborted) {
        this.loadingMorePeople.set(false);
      }
    }
  }

  private async loadData(): Promise<void> {
    try {
      const [events, people] = await Promise.all([
        this.calendarService.getEvents({
          limit: MANAGEMENT_PAGE_SIZE,
          signal: this.controller.signal,
        }),
        this.calendarService.getPeople({
          limit: MANAGEMENT_PAGE_SIZE,
          signal: this.controller.signal,
        }),
      ]);
      if (!this.controller.signal.aborted) {
        this.events.set(events.events);
        this.people.set(people.people);
        this.hasMoreEvents.set(events.hasMore);
        this.hasMorePeople.set(people.hasMore);
        if (!people.hasMore) {
          this.selectedParticipantIds.update((ids) =>
            ids.filter((id) => people.people.some((person) => person.id === id)),
          );
        }
      }
    } catch (error: unknown) {
      if (!this.controller.signal.aborted) {
        this.errorMessage.set(
          this.i18n.translateError(error, 'errors.unexpectedEvent'),
        );
      }
    } finally {
      if (!this.controller.signal.aborted) {
        this.loading.set(false);
      }
    }
  }

  private createEventInput(): CalendarEventInput {
    const start = new Date(this.startsAt);
    const end = this.endsAt ? new Date(this.endsAt) : null;
    if (Number.isNaN(start.getTime())) {
      throw new TypeError('Event start must be a valid date.');
    }
    if (end && Number.isNaN(end.getTime())) {
      throw new TypeError('Event end must be a valid date.');
    }
    if (end && end <= start) {
      throw new RangeError('Event end must be later than its start.');
    }
    return {
      title: this.title,
      starts_at: start.toISOString(),
      ends_at: end?.toISOString() ?? null,
    };
  }

  private mergeEvent(event: CalendarEventRecord): void {
    this.events.update((events) => {
      const merged = events.filter(({ id }) => id !== event.id);
      merged.push(event);
      merged.sort((first, second) => first.start.getTime() - second.start.getTime());
      return merged.length > MANAGEMENT_PAGE_SIZE
        ? merged.slice(0, MANAGEMENT_PAGE_SIZE)
        : merged;
    });
  }

  private toRecord(id: string, event: CalendarEventInput): CalendarEventRecord {
    return {
      id,
      title: event.title.trim(),
      start: new Date(event.starts_at),
      ...(event.ends_at ? { end: new Date(event.ends_at) } : {}),
      color: { primary: '#477b5e', secondary: '#eaf1e9' },
      draggable: false,
      resizable: { beforeStart: false, afterEnd: false },
    };
  }

  private toDateTimeLocalInput(date: Date): string {
    const pad = (value: number): string => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
}
