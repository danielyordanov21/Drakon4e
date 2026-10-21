import { Component, DestroyRef, ElementRef, inject, QueryList, signal, ViewChildren } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Person, PersonInput } from '../../models/person.model';
import { CalendarEventRecord, CalendarService } from '../../services/calendar.service';
import { I18nService } from '../../services/i18n.service';

const MANAGEMENT_PAGE_SIZE = 200;

@Component({
  selector: 'app-people-management-component',
  imports: [DatePipe, FormsModule, RouterLink],
  templateUrl: './people-management-component.html',
  styleUrl: './people-management-component.scss',
})
export class PeopleManagementComponent {
  @ViewChildren('personTextField', { read: ElementRef })
  private readonly personTextFields!: QueryList<ElementRef<HTMLTextAreaElement>>;

  private readonly calendarService = inject(CalendarService);
  readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly controller = new AbortController();
  private associationController: AbortController | null = null;

  readonly people = signal<Person[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly deletingPersonId = signal<Person['id'] | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly editingPersonId = signal<Person['id'] | null>(null);
  readonly managingEventsPersonId = signal<Person['id'] | null>(null);
  readonly personEvents = signal<CalendarEventRecord[]>([]);
  readonly allEvents = signal<CalendarEventRecord[]>([]);
  readonly managingEvents = signal(false);
  readonly loadingMorePeople = signal(false);
  readonly loadingMoreEvents = signal(false);
  readonly loadingMorePersonEvents = signal(false);
  readonly changingAssociation = signal(false);
  readonly hasMorePeople = signal(false);
  readonly hasMoreEvents = signal(false);
  readonly hasMorePersonEvents = signal(false);

  name = '';
  grade: number | null = null;
  books = '';
  notes = '';
  smallNotes = '';
  selectedEventId = '';

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.controller.abort();
      this.associationController?.abort();
    });
    void this.loadPeople();
  }

  startEditing(person: Person): void {
    this.editingPersonId.set(person.id);
    this.name = person.name;
    this.grade = person.grade ?? null;
    this.books = person.books ?? '';
    this.notes = person.notes ?? '';
    this.smallNotes = person.small_notes ?? '';
    this.errorMessage.set(null);
    queueMicrotask(() => {
      this.personTextFields.forEach(({ nativeElement }) =>
        this.resizeTextareaHeight(nativeElement),
      );
    });
  }

  cancelEditing(): void {
    this.editingPersonId.set(null);
    this.name = '';
    this.grade = null;
    this.books = '';
    this.notes = '';
    this.smallNotes = '';
    this.errorMessage.set(null);
  }

  async togglePersonEvents(person: Person): Promise<void> {
    if (this.managingEventsPersonId() === person.id) {
      this.associationController?.abort();
      this.associationController = null;
      this.managingEventsPersonId.set(null);
      this.personEvents.set([]);
      this.allEvents.set([]);
      this.hasMoreEvents.set(false);
      this.hasMorePersonEvents.set(false);
      this.managingEvents.set(false);
      this.selectedEventId = '';
      return;
    }

    this.associationController?.abort();
    const controller = new AbortController();
    this.associationController = controller;
    this.errorMessage.set(null);
    this.managingEvents.set(true);
    this.managingEventsPersonId.set(person.id);
    this.personEvents.set([]);
    this.allEvents.set([]);
    this.hasMoreEvents.set(false);
    this.hasMorePersonEvents.set(false);
    this.selectedEventId = '';
    try {
      const [events, personEvents] = await Promise.all([
        this.calendarService.getEvents({
          limit: MANAGEMENT_PAGE_SIZE,
          signal: controller.signal,
        }),
        this.calendarService.getEventsForPerson(person.id, {
          limit: MANAGEMENT_PAGE_SIZE,
          signal: controller.signal,
        }),
      ]);
      if (!controller.signal.aborted && this.managingEventsPersonId() === person.id) {
        this.allEvents.set(events.events);
        this.personEvents.set(personEvents.events);
        this.hasMoreEvents.set(events.hasMore);
        this.hasMorePersonEvents.set(personEvents.hasMore);
      }
    } catch (error: unknown) {
      if (!controller.signal.aborted) {
        this.errorMessage.set(
          this.i18n.translateError(error, 'errors.unexpectedEvent'),
        );
      }
    } finally {
      if (this.managingEventsPersonId() === person.id) {
        this.managingEvents.set(false);
      }
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
    this.changingAssociation.set(true);
    try {
      await this.calendarService.addPersonToEvent(event.id, person.id);
      this.personEvents.update((events) =>
        events.some(({ id }) => id === event.id)
          ? events
          : [...events, event].sort(
              (first, second) => first.start.getTime() - second.start.getTime(),
            ),
      );
      this.selectedEventId = '';
    } catch (error: unknown) {
      this.errorMessage.set(
        this.i18n.translateError(error, 'errors.unexpectedParticipant'),
      );
    } finally {
      this.changingAssociation.set(false);
    }
  }

  async removeEventFromPerson(person: Person, event: CalendarEventRecord): Promise<void> {
    this.errorMessage.set(null);
    this.changingAssociation.set(true);
    try {
      await this.calendarService.removePersonFromEvent(event.id, person.id);
      this.personEvents.update((events) => events.filter(({ id }) => id !== event.id));
    } catch (error: unknown) {
      this.errorMessage.set(
        error instanceof Error
          ? error.message
          : `Could not remove ${person.name} from this event.`,
      );
    } finally {
      this.changingAssociation.set(false);
    }
  }

  async savePerson(): Promise<void> {
    this.saving.set(true);
    this.errorMessage.set(null);

    try {
      const editingId = this.editingPersonId();
      const input = this.personInput();
      if (editingId) {
        await this.calendarService.updatePerson(editingId, input);
        this.people.update((people) =>
          people.map((person) =>
            person.id === editingId ? { ...person, ...input } : person,
          ).sort((first, second) => first.name.localeCompare(second.name)),
        );
      } else {
        const person = await this.calendarService.createPerson(input);
        this.people.update((people) =>
          [...people, person].sort((first, second) => first.name.localeCompare(second.name)),
        );
      }
      this.cancelEditing();
    } catch (error: unknown) {
      this.errorMessage.set(
        this.i18n.translateError(error, 'errors.unexpected'),
      );
    } finally {
      this.saving.set(false);
    }
  }

  resizeTextarea(event: Event): void {
    const textarea = event.currentTarget;
    if (textarea instanceof HTMLTextAreaElement) {
      this.resizeTextareaHeight(textarea);
    }
  }

  async deletePerson(person: Person): Promise<void> {
    if (
      this.deletingPersonId() !== null ||
      !window.confirm(
        this.i18n.t('people.deletingConfirm', { name: person.name }),
      )
    ) {
      return;
    }

    this.errorMessage.set(null);
    this.deletingPersonId.set(person.id);
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
        this.i18n.translateError(error, 'errors.unexpected'),
      );
    } finally {
      this.deletingPersonId.set(null);
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

  async loadMoreEvents(): Promise<void> {
    const personId = this.managingEventsPersonId();
    const controller = this.associationController;
    if (
      this.loadingMoreEvents() ||
      !this.hasMoreEvents() ||
      !personId ||
      !controller
    ) {
      return;
    }
    this.loadingMoreEvents.set(true);
    try {
      const page = await this.calendarService.getEvents({
        offset: this.allEvents().length,
        limit: MANAGEMENT_PAGE_SIZE,
        signal: controller.signal,
      });
      if (controller.signal.aborted || this.managingEventsPersonId() !== personId) {
        return;
      }
      this.allEvents.update((events) => [...events, ...page.events]);
      this.hasMoreEvents.set(page.hasMore);
    } catch (error: unknown) {
      if (!controller.signal.aborted) {
        this.errorMessage.set(this.i18n.translateError(error, 'errors.unexpectedEvent'));
      }
    } finally {
      if (!controller.signal.aborted) {
        this.loadingMoreEvents.set(false);
      }
    }
  }

  async loadMorePersonEvents(person: Person): Promise<void> {
    const controller = this.associationController;
    if (
      this.loadingMorePersonEvents() ||
      !this.hasMorePersonEvents() ||
      !controller ||
      this.managingEventsPersonId() !== person.id
    ) {
      return;
    }
    this.loadingMorePersonEvents.set(true);
    try {
      const page = await this.calendarService.getEventsForPerson(person.id, {
        offset: this.personEvents().length,
        limit: MANAGEMENT_PAGE_SIZE,
        signal: controller.signal,
      });
      if (!controller.signal.aborted && this.managingEventsPersonId() === person.id) {
        this.personEvents.update((events) => [...events, ...page.events]);
        this.hasMorePersonEvents.set(page.hasMore);
      }
    } catch (error: unknown) {
      if (!controller.signal.aborted) {
        this.errorMessage.set(this.i18n.translateError(error, 'errors.unexpectedEvent'));
      }
    } finally {
      if (!controller.signal.aborted) {
        this.loadingMorePersonEvents.set(false);
      }
    }
  }

  private async loadPeople(): Promise<void> {
    try {
      const page = await this.calendarService.getPeople({
        limit: MANAGEMENT_PAGE_SIZE,
        signal: this.controller.signal,
      });
      this.people.set(page.people);
      this.hasMorePeople.set(page.hasMore);
    } catch (error: unknown) {
      if (!this.controller.signal.aborted) {
        this.errorMessage.set(
          this.i18n.translateError(error, 'picker.error'),
        );
      }
    } finally {
      if (!this.controller.signal.aborted) {
        this.loading.set(false);
      }
    }
  }

  private personInput(): PersonInput {
    const normalizeText = (value: string): string | null => value.trim() || null;
    return {
      name: this.name.trim(),
      grade: this.grade,
      books: normalizeText(this.books),
      notes: normalizeText(this.notes),
      small_notes: normalizeText(this.smallNotes),
    };
  }

  private resizeTextareaHeight(textarea: HTMLTextAreaElement): void {
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }
}
