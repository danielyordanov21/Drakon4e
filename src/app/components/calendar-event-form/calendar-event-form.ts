import { Component, DestroyRef, OnInit, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Person } from '../../models/person.model';
import { CalendarService } from '../../services/calendar.service';
import { I18nService } from '../../services/i18n.service';

const PEOPLE_PAGE_SIZE = 200;

@Component({
  selector: 'app-calendar-event-form',
  imports: [FormsModule],
  templateUrl: './calendar-event-form.html',
  styleUrl: './calendar-event-form.scss',
})
export class CalendarEventFormComponent implements OnInit {
  private readonly calendarService = inject(CalendarService);
  readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly controller = new AbortController();

  readonly personId = input<Person['id']>();
  readonly startDate = input.required<Date>();
  readonly saved = output<void>();
  readonly cancelled = output<void>();

  readonly people = signal<Person[]>([]);
  readonly selectedPersonIds = signal<string[]>([]);
  readonly loadingPeople = signal(true);
  readonly loadingMorePeople = signal(false);
  readonly hasMorePeople = signal(false);
  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);

  title = '';
  startsAt = '';
  endsAt = '';

  constructor() {
    this.destroyRef.onDestroy(() => this.controller.abort());
  }

  ngOnInit(): void {
    const start = new Date(this.startDate());
    start.setHours(9, 0, 0, 0);
    const end = new Date(start.getTime() + 60 * 60_000);
    this.startsAt = this.toDateTimeLocalInput(start);
    this.endsAt = this.toDateTimeLocalInput(end);
    const personId = this.personId();
    this.selectedPersonIds.set(personId ? [personId] : []);
    void this.loadPeople(0);
  }

  togglePerson(personId: string, selected: boolean): void {
    this.selectedPersonIds.update((ids) =>
      selected
        ? ids.includes(personId)
          ? ids
          : [...ids, personId]
        : ids.filter((id) => id !== personId),
    );
  }

  async loadMorePeople(): Promise<void> {
    if (this.loadingMorePeople() || !this.hasMorePeople()) {
      return;
    }
    this.loadingMorePeople.set(true);
    await this.loadPeople(this.people().length);
    if (!this.controller.signal.aborted) {
      this.loadingMorePeople.set(false);
    }
  }

  async save(): Promise<void> {
    if (this.saving()) {
      return;
    }
    this.saving.set(true);
    this.errorMessage.set(null);
    try {
      const startsAt = new Date(this.startsAt);
      const endsAt = this.endsAt ? new Date(this.endsAt) : null;
      const participantIds = new Set(this.selectedPersonIds());
      const personId = this.personId();
      if (personId) {
        participantIds.add(personId);
      }
      await this.calendarService.createEvent(
        {
          title: this.title,
          starts_at: startsAt.toISOString(),
          ends_at: endsAt?.toISOString() ?? null,
        },
        [...participantIds],
      );
      this.saved.emit();
    } catch (error: unknown) {
      this.errorMessage.set(this.toErrorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }

  private async loadPeople(offset: number): Promise<void> {
    this.errorMessage.set(null);
    try {
      const page = await this.calendarService.getPeople({
        offset,
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
      if (offset === 0 && !this.controller.signal.aborted) {
        this.loadingPeople.set(false);
      }
    }
  }

  private toErrorMessage(error: unknown): string {
    return this.i18n.translateError(error, 'errors.unexpectedEvent');
  }

  private toDateTimeLocalInput(date: Date): string {
    const pad = (value: number): string => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
}
