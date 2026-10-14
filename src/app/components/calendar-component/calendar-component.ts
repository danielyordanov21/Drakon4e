import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  TemplateRef,
  ViewChild,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import {
  addDays,
  endOfMonth,
  endOfWeek,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import {
  CalendarDatePipe,
  CalendarDayViewComponent,
  CalendarEvent,
  CalendarMonthViewComponent,
  CalendarNextViewDirective,
  CalendarPreviousViewDirective,
  CalendarTodayDirective,
  CalendarView,
  CalendarWeekViewComponent,
  DateAdapter,
  provideCalendar,
} from 'angular-calendar';
import { adapterFactory } from 'angular-calendar/date-adapters/date-fns';
import {
  Subject,
  catchError,
  defer,
  distinctUntilChanged,
  finalize,
  from,
  map,
  merge,
  of,
  startWith,
  switchMap,
  tap,
} from 'rxjs';
import { Person } from '../../models/person.model';
import { PersonButtonComponent } from '../person-button-component/person-button-component';
import {
  CalendarDateRange,
  CalendarEventRecord,
  CalendarService,
} from '../../services/calendar.service';

interface CalendarRequest {
  range: CalendarDateRange;
  offset: number;
  append: boolean;
}

@Component({
  selector: 'app-calendar-component',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: 'calendar-component.html',
  imports: [
    CalendarPreviousViewDirective,
    CalendarTodayDirective,
    CalendarNextViewDirective,
    CalendarMonthViewComponent,
    CalendarWeekViewComponent,
    CalendarDayViewComponent,
    CalendarDatePipe,
    DatePipe,
    PersonButtonComponent,
  ],
  styleUrl: './calendar-component.scss',
  providers: [provideCalendar({ provide: DateAdapter, useFactory: adapterFactory })],
})
export class CalendarComponent {
  @ViewChild('modalContent', { static: true }) modalContent!: TemplateRef<unknown>;

  private readonly calendarService = inject(CalendarService);
  private readonly modal = inject(NgbModal);
  private readonly destroyRef = inject(DestroyRef);
  private readonly rangeChanges = new Subject<void>();
  private readonly loadMoreRequests = new Subject<void>();
  private participantsController: AbortController | null = null;

  readonly personId = input<Person['id']>();
  readonly events = signal<CalendarEventRecord[]>([]);
  readonly loading = signal(false);
  readonly hasMore = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly participants = signal<Person[]>([]);
  readonly participantsLoading = signal(false);
  readonly participantsError = signal<string | null>(null);

  view: CalendarView = CalendarView.Month;
  CalendarView = CalendarView;
  viewDate = new Date();
  readonly refresh = new Subject<void>();
  activeDayIsOpen = false;
  modalEvent: CalendarEventRecord | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => this.participantsController?.abort());

    toObservable(this.personId)
      .pipe(
        distinctUntilChanged(),
        switchMap(() =>
          merge(
            this.rangeChanges.pipe(
              startWith(undefined),
              map(() => this.createRequest(0, false)),
            ),
            this.loadMoreRequests.pipe(
              map(() => this.createRequest(this.events().length, true)),
            ),
          ),
        ),
        switchMap((request) => {
          const controller = new AbortController();
          if (!request.append) {
            this.events.set([]);
            this.hasMore.set(false);
          }
          this.errorMessage.set(null);
          this.loading.set(true);

          return defer(() => {
            const personId = this.personId();
            const query =
              personId !== undefined
                ? this.calendarService.getEventsForPersonInRange(personId, request.range, {
                    offset: request.offset,
                    signal: controller.signal,
                  })
                : this.calendarService.getEventsInRange(request.range, {
                    offset: request.offset,
                    signal: controller.signal,
                  });
            return from(query);
          }).pipe(
            tap((page) => {
              this.events.update((current) =>
                request.append ? [...current, ...page.events] : page.events,
              );
              this.hasMore.set(page.hasMore);
              this.refresh.next();
            }),
            catchError((error: unknown) => {
              if (!controller.signal.aborted) {
                this.errorMessage.set(this.toErrorMessage(error));
              }
              return of(null);
            }),
            finalize(() => {
              controller.abort();
              this.loading.set(false);
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  dayClicked({ date, events }: { date: Date; events: CalendarEvent[] }): void {
    if (isSameMonth(date, this.viewDate)) {
      this.activeDayIsOpen =
        !(isSameDay(this.viewDate, date) && this.activeDayIsOpen) && events.length > 0;
      this.viewDate = date;
    } else {
      this.viewDate = date;
    }
    this.rangeChanges.next();
  }

  handleEvent(event: CalendarEventRecord): void {
    this.participantsController?.abort();
    const controller = new AbortController();
    this.participantsController = controller;
    this.modalEvent = event;
    this.participants.set([]);
    this.participantsError.set(null);
    this.participantsLoading.set(true);
    this.modal.open(this.modalContent, { size: 'lg' });
    this.calendarService
      .getParticipants(event.id, controller.signal)
      .then((participants) => {
        if (!controller.signal.aborted) {
          this.participants.set(participants);
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          this.participantsError.set(this.toErrorMessage(error));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          this.participantsLoading.set(false);
          this.participantsController = null;
        }
      });
  }

  handleCalendarEvent(event: CalendarEvent): void {
    if (typeof event.id !== 'string') {
      this.errorMessage.set('This event does not have a valid database ID.');
      return;
    }
    const eventRecord = this.events().find(({ id }) => id === event.id);
    if (!eventRecord) {
      this.errorMessage.set('This event is no longer in the current calendar results.');
      return;
    }
    this.handleEvent(eventRecord);
  }

  loadMore(): void {
    if (!this.loading() && this.hasMore()) {
      this.loadMoreRequests.next();
    }
  }

  async removeParticipant(person: Person): Promise<void> {
    const event = this.modalEvent;
    if (!event) {
      return;
    }

    this.participantsError.set(null);
    try {
      await this.calendarService.removePersonFromEvent(event.id, person.id);
      this.participants.update((current) => current.filter(({ id }) => id !== person.id));
      if (this.personId() === person.id) {
        this.rangeChanges.next();
      }
    } catch (error: unknown) {
      this.participantsError.set(this.toErrorMessage(error));
    }
  }

  onViewDateChange(): void {
    this.closeOpenMonthViewDay();
    this.rangeChanges.next();
  }

  setView(view: CalendarView): void {
    this.view = view;
    this.rangeChanges.next();
  }

  closeOpenMonthViewDay(): void {
    this.activeDayIsOpen = false;
  }

  private createRequest(offset: number, append: boolean): CalendarRequest {
    return { range: this.visibleRange(), offset, append };
  }

  private visibleRange(): CalendarDateRange {
    if (this.view === CalendarView.Month) {
      const monthStart = startOfMonth(this.viewDate);
      return {
        start: startOfWeek(monthStart),
        endExclusive: addDays(endOfWeek(endOfMonth(this.viewDate)), 1),
      };
    }
    if (this.view === CalendarView.Week) {
      const weekStart = startOfWeek(this.viewDate);
      return { start: weekStart, endExclusive: addDays(endOfWeek(weekStart), 1) };
    }
    const dayStart = startOfDay(this.viewDate);
    return { start: dayStart, endExclusive: addDays(dayStart, 1) };
  }

  private toErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'An unexpected calendar error occurred.';
  }
}
