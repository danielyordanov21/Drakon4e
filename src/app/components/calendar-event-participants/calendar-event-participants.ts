import {
  Component,
  DestroyRef,
  Input,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { Person } from '../../models/person.model';
import { CalendarEventRecord, CalendarService } from '../../services/calendar.service';
import { I18nService } from '../../services/i18n.service';

const PEOPLE_PAGE_SIZE = 200;

@Component({
  selector: 'app-calendar-event-participants',
  imports: [FormsModule],
  templateUrl: './calendar-event-participants.html',
  styleUrl: './calendar-event-participants.scss',
})
export class CalendarEventParticipantsComponent {
  @Input({ required: true })
  set event(value: CalendarEventRecord) {
    this._event = value;
    void this.load();
  }
  get event(): CalendarEventRecord {
    return this._event;
  }

  @Input() personId: Person['id'] | undefined;

  private _event!: CalendarEventRecord;
  private readonly calendarService = inject(CalendarService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly controller = new AbortController();
  readonly changedPersonIds = new Set<Person['id']>();

  readonly activeModal = inject(NgbActiveModal);
  readonly i18n = inject(I18nService);
  readonly participants = signal<Person[]>([]);
  readonly people = signal<Person[]>([]);
  readonly loading = signal(true);
  readonly loadingMore = signal(false);
  readonly changingPersonId = signal<string | null>(null);
  readonly deleting = signal(false);
  readonly hasMorePeople = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly availablePeople = computed(() =>
    this.people().filter(
      (person) => !this.participants().some(({ id }) => id === person.id),
    ),
  );

  selectedPersonId = '';

  constructor() {
    this.destroyRef.onDestroy(() => this.controller.abort());
  }

  async addParticipant(): Promise<void> {
    const person = this.availablePeople().find(({ id }) => id === this.selectedPersonId);
    if (!person || this.changingPersonId()) {
      return;
    }

    this.changingPersonId.set(person.id);
    this.errorMessage.set(null);
    try {
      await this.calendarService.addPersonToEvent(this.event.id, person.id);
      this.changedPersonIds.add(person.id);
      this.participants.update((participants) =>
        [...participants, person].sort((first, second) =>
          first.name.localeCompare(second.name),
        ),
      );
      this.selectedPersonId = '';
    } catch (error: unknown) {
      this.errorMessage.set(this.toErrorMessage(error));
    } finally {
      this.changingPersonId.set(null);
    }
  }

  async removeParticipant(person: Person): Promise<void> {
    if (this.changingPersonId()) {
      return;
    }

    this.changingPersonId.set(person.id);
    this.errorMessage.set(null);
    try {
      await this.calendarService.removePersonFromEvent(this.event.id, person.id);
      this.changedPersonIds.add(person.id);
      this.participants.update((participants) =>
        participants.filter(({ id }) => id !== person.id),
      );
    } catch (error: unknown) {
      this.errorMessage.set(this.toErrorMessage(error));
    } finally {
      this.changingPersonId.set(null);
    }
  }

  async loadMorePeople(): Promise<void> {
    if (this.loadingMore() || !this.hasMorePeople()) {
      return;
    }
    this.loadingMore.set(true);
    try {
      const page = await this.calendarService.getPeople({
        offset: this.people().length,
        limit: PEOPLE_PAGE_SIZE,
        signal: this.controller.signal,
      });
      if (!this.controller.signal.aborted) {
        this.people.update((people) => [...people, ...page.people]);
        this.hasMorePeople.set(page.hasMore);
      }
    } catch (error: unknown) {
      if (!this.controller.signal.aborted) {
        this.errorMessage.set(this.toErrorMessage(error));
      }
    } finally {
      if (!this.controller.signal.aborted) {
        this.loadingMore.set(false);
      }
    }
  }

  async deleteEvent(): Promise<void> {
    if (
      this.deleting() ||
      !window.confirm(this.i18n.t('participants.deleteConfirm', { event: this.event.title }))
    ) {
      return;
    }

    this.deleting.set(true);
    this.errorMessage.set(null);
    try {
      await this.calendarService.deleteEvent(this.event.id);
      this.activeModal.close({ deletedEventId: this.event.id });
    } catch (error: unknown) {
      this.errorMessage.set(this.toErrorMessage(error));
    } finally {
      this.deleting.set(false);
    }
  }

  private async load(): Promise<void> {
    try {
      const [participants, peoplePage] = await Promise.all([
        this.calendarService.getParticipants(this.event.id, this.controller.signal),
        this.calendarService.getPeople({
          limit: PEOPLE_PAGE_SIZE,
          signal: this.controller.signal,
        }),
      ]);
      if (!this.controller.signal.aborted) {
        this.participants.set(participants);
        this.people.set(peoplePage.people);
        this.hasMorePeople.set(peoplePage.hasMore);
      }
    } catch (error: unknown) {
      if (!this.controller.signal.aborted) {
        this.errorMessage.set(this.toErrorMessage(error));
      }
    } finally {
      if (!this.controller.signal.aborted) {
        this.loading.set(false);
      }
    }
  }

  private toErrorMessage(error: unknown): string {
    return this.i18n.translateError(error, 'errors.unexpectedParticipant');
  }

  close(): void {
    this.activeModal.close({ changedPersonIds: [...this.changedPersonIds] });
  }
}
