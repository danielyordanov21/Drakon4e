import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Person } from '../../models/person.model';
import {
  CalendarEventInput,
  CalendarEventRecord,
  CalendarService,
} from '../../services/calendar.service';

@Component({
  selector: 'app-events-management-component',
  imports: [DatePipe, FormsModule, RouterLink],
  templateUrl: './events-management-component.html',
  styleUrl: './events-management-component.scss',
})
export class EventsManagementComponent {
  private readonly calendarService = inject(CalendarService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly controller = new AbortController();

  readonly events = signal<CalendarEventRecord[]>([]);
  readonly people = signal<Person[]>([]);
  readonly participants = signal<Person[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);
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
    this.destroyRef.onDestroy(() => this.controller.abort());
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
    this.errorMessage.set(null);
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
        this.events.update((events) =>
          events
            .map((event) => (event.id === eventId ? updated : event))
            .sort((first, second) => first.start.getTime() - second.start.getTime()),
        );
      } else {
        await this.calendarService.createEvent(input);
        this.events.set(await this.calendarService.getAllEvents(this.controller.signal));
      }
      this.cancelEditing();
    } catch (error: unknown) {
      this.errorMessage.set(
        error instanceof Error ? error.message : 'Could not save this event.',
      );
    } finally {
      this.saving.set(false);
    }
  }

  async deleteEvent(event: CalendarEventRecord): Promise<void> {
    if (!window.confirm(`Delete “${event.title}” and its participant links?`)) {
      return;
    }

    this.errorMessage.set(null);
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
        error instanceof Error ? error.message : 'Could not delete this event.',
      );
    }
  }

  async toggleParticipants(event: CalendarEventRecord): Promise<void> {
    if (this.managingEventId() === event.id) {
      this.managingEventId.set(null);
      this.participants.set([]);
      this.selectedPersonId = '';
      return;
    }

    this.managingEventId.set(event.id);
    this.participants.set([]);
    this.selectedPersonId = '';
    this.errorMessage.set(null);
    try {
      const participants = await this.calendarService.getParticipants(
        event.id,
        this.controller.signal,
      );
      if (this.managingEventId() === event.id) {
        this.participants.set(participants);
      }
    } catch (error: unknown) {
      if (!this.controller.signal.aborted) {
        this.errorMessage.set(
          error instanceof Error ? error.message : 'Could not load event participants.',
        );
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
    try {
      await this.calendarService.addPersonToEvent(eventId, person.id);
      this.participants.update((people) =>
        [...people, person].sort((first, second) => first.name.localeCompare(second.name)),
      );
      this.selectedPersonId = '';
    } catch (error: unknown) {
      this.errorMessage.set(
        error instanceof Error ? error.message : 'Could not add this person to the event.',
      );
    }
  }

  async removePersonFromEvent(person: Person): Promise<void> {
    const eventId = this.managingEventId();
    if (!eventId) {
      return;
    }

    this.errorMessage.set(null);
    try {
      await this.calendarService.removePersonFromEvent(eventId, person.id);
      this.participants.update((people) => people.filter(({ id }) => id !== person.id));
    } catch (error: unknown) {
      this.errorMessage.set(
        error instanceof Error ? error.message : 'Could not remove this person from the event.',
      );
    }
  }

  private async loadData(): Promise<void> {
    try {
      const [events, people] = await Promise.all([
        this.calendarService.getAllEvents(this.controller.signal),
        this.calendarService.getPeople(this.controller.signal),
      ]);
      if (!this.controller.signal.aborted) {
        this.events.set(events);
        this.people.set(people);
      }
    } catch (error: unknown) {
      if (!this.controller.signal.aborted) {
        this.errorMessage.set(
          error instanceof Error ? error.message : 'Could not load your events.',
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
    return {
      title: this.title,
      starts_at: start.toISOString(),
      ends_at: end?.toISOString() ?? null,
    };
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
