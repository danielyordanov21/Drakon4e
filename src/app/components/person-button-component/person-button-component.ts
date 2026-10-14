import { Component, DestroyRef, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Person } from '../../models/person.model';
import { CalendarService } from '../../services/calendar.service';

@Component({
  selector: 'app-person-button-component',
  imports: [RouterLink],
  templateUrl: './person-button-component.html',
  styleUrl: './person-button-component.scss',
})
export class PersonButtonComponent {
  private readonly calendarService = inject(CalendarService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly peopleController = new AbortController();

  readonly people = signal<Person[]>([]);
  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly isOpen = signal(false);

  constructor() {
    this.destroyRef.onDestroy(() => this.peopleController.abort());
    void this.loadPeople();
  }

  closeMenu(): void {
    this.isOpen.set(false);
  }

  toggleMenu(): void {
    this.isOpen.update((open) => !open);
  }

  private async loadPeople(): Promise<void> {
    try {
      this.people.set(await this.calendarService.getPeople(this.peopleController.signal));
    } catch (error: unknown) {
      if (!this.peopleController.signal.aborted) {
        this.errorMessage.set(
          error instanceof Error ? error.message : 'Could not load people.',
        );
      }
    } finally {
      if (!this.peopleController.signal.aborted) {
        this.loading.set(false);
      }
    }
  }
}
