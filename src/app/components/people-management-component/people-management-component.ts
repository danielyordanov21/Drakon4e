import { Component, DestroyRef, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Person } from '../../models/person.model';
import { CalendarEventRecord, CalendarService } from '../../services/calendar.service';

@Component({
  selector: 'app-people-management-component',
  imports: [DatePipe, FormsModule, RouterLink],
  templateUrl: './people-management-component.html',
  styleUrl: './people-management-component.scss',
})
export class PeopleManagementComponent {
  private readonly calendarService = inject(CalendarService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly controller = new AbortController();

  readonly people = signal<Person[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly editingPersonId = signal<Person['id'] | null>(null);
  readonly managingEventsPersonId = signal<Person['id'] | null>(null);
  readonly personEvents = signal<CalendarEventRecord[]>([]);
  readonly allEvents = signal<CalendarEventRecord[]>([]);
  readonly managingEvents = signal(false);

  name = '';
  selectedEventId = '';

  constructor() {
    this.destroyRef.onDestroy(() => this.controller.abort());
    void this.loadPeople();
  }

  startEditing(person: Person): void {
    this.editingPersonId.set(person.id);
    this.name = person.name;
    this.errorMessage.set(null);
  }

  cancelEditing(): void {
    this.editingPersonId.set(null);
    this.name = '';
    this.errorMessage.set(null);
  }

  async togglePersonEvents(person: Person): Promise<void> {
    if (this.managingEventsPersonId() === person.id) {
      this.managingEventsPersonId.set(null);
      this.personEvents.set([]);
      this.selectedEventId = '';
      return;
    }

    this.errorMessage.set(null);
    this.managingEvents.set(true);
    this.managingEventsPersonId.set(person.id);
    this.selectedEventId = '';
    try {
      const [events, personEvents] = await Promise.all([
        this.calendarService.getAllEvents(this.controller.signal),
        this.calendarService.getAllEventsForPerson(person.id, this.controller.signal),
      ]);
      if (this.managingEventsPersonId() === person.id) {
        this.allEvents.set(events);
        this.personEvents.set(personEvents);
      }
    } catch (error: unknown) {
      if (!this.controller.signal.aborted) {
        this.errorMessage.set(
          error instanceof Error ? error.message : `Could not load ${person.name}'s events.`,
        );
      }
    } finally {
      this.managingEvents.set(false);
    }
  }

  availableEventsFor(person: Person): CalendarEventRecord[] {
    if (this.managingEventsPersonId() !== person.id) {
      return [];
    }
    const assignedIds = new Set(this.personEvents().map(({ id }) => id));
    return this.allEvents().filter(({ id }) => !assignedIds.has(id));
  }

  async addEventToPerson(person: Person): Promise<void> {
    const event = this.availableEventsFor(person).find(
      ({ id }) => id === this.selectedEventId,
    );
    if (!event) {
      return;
    }

    this.errorMessage.set(null);
    try {
      await this.calendarService.addPersonToEvent(event.id, person.id);
      this.personEvents.update((events) =>
        [...events, event].sort((first, second) => first.start.getTime() - second.start.getTime()),
      );
      this.selectedEventId = '';
    } catch (error: unknown) {
      this.errorMessage.set(
        error instanceof Error ? error.message : `Could not add ${person.name} to this event.`,
      );
    }
  }

  async removeEventFromPerson(person: Person, event: CalendarEventRecord): Promise<void> {
    this.errorMessage.set(null);
    try {
      await this.calendarService.removePersonFromEvent(event.id, person.id);
      this.personEvents.update((events) => events.filter(({ id }) => id !== event.id));
    } catch (error: unknown) {
      this.errorMessage.set(
        error instanceof Error
          ? error.message
          : `Could not remove ${person.name} from this event.`,
      );
    }
  }

  async savePerson(): Promise<void> {
    this.saving.set(true);
    this.errorMessage.set(null);

    try {
      const editingId = this.editingPersonId();
      if (editingId) {
        await this.calendarService.updatePerson(editingId, this.name);
        this.people.update((people) =>
          people.map((person) =>
            person.id === editingId ? { ...person, name: this.name.trim() } : person,
          ),
        );
      } else {
        const person = await this.calendarService.createPerson(this.name);
        this.people.update((people) =>
          [...people, person].sort((first, second) => first.name.localeCompare(second.name)),
        );
      }
      this.cancelEditing();
    } catch (error: unknown) {
      this.errorMessage.set(
        error instanceof Error ? error.message : 'Could not save this person.',
      );
    } finally {
      this.saving.set(false);
    }
  }

  async deletePerson(person: Person): Promise<void> {
    if (
      !window.confirm(
        `Delete ${person.name}? Events will remain, but this person’s links will be removed.`,
      )
    ) {
      return;
    }

    this.errorMessage.set(null);
    try {
      await this.calendarService.deletePerson(person.id);
      this.people.update((people) => people.filter(({ id }) => id !== person.id));
      if (this.managingEventsPersonId() === person.id) {
        this.managingEventsPersonId.set(null);
        this.personEvents.set([]);
        this.selectedEventId = '';
      }
      if (this.editingPersonId() === person.id) {
        this.cancelEditing();
      }
    } catch (error: unknown) {
      this.errorMessage.set(
        error instanceof Error ? error.message : 'Could not delete this person.',
      );
    }
  }

  private async loadPeople(): Promise<void> {
    try {
      this.people.set(await this.calendarService.getPeople(this.controller.signal));
    } catch (error: unknown) {
      if (!this.controller.signal.aborted) {
        this.errorMessage.set(
          error instanceof Error ? error.message : 'Could not load your people.',
        );
      }
    } finally {
      if (!this.controller.signal.aborted) {
        this.loading.set(false);
      }
    }
  }
}
