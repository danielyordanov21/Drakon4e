import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Person } from '../../models/person.model';
import { CalendarService } from '../../services/calendar.service';

@Component({
  selector: 'app-people-management-component',
  imports: [FormsModule, RouterLink],
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

  name = '';

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
