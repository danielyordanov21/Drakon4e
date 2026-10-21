import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
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
import {
  CalendarDateRange,
  CalendarEventRecord,
  CalendarService,
} from '../../services/calendar.service';
import { I18nService } from '../../services/i18n.service';
import { CalendarEventFormComponent } from '../calendar-event-form/calendar-event-form';
import { CalendarEventParticipantsComponent } from '../calendar-event-participants/calendar-event-participants';

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
    CalendarEventFormComponent,
  ],
  styleUrl: './calendar-component.scss',
  providers: [provideCalendar({ provide: DateAdapter, useFactory: adapterFactory })],
})
export class CalendarComponent {
  private readonly calendarService = inject(CalendarService);
  readonly i18n = inject(I18nService);
  private readonly modal = inject(NgbModal);
  private readonly destroyRef = inject(DestroyRef);
  private readonly rangeChanges = new Subject<void>();
  private readonly loadMoreRequests = new Subject<void>();

  readonly personId = input<Person['id']>();
  readonly events = signal<CalendarEventRecord[]>([]);
  readonly loading = signal(false);
  readonly hasMore = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly creatingEvent = signal(false);

  view: CalendarView = CalendarView.Month;
  CalendarView = CalendarView;
  viewDate = new Date();
  readonly refresh = new Subject<void>();
  activeDayIsOpen = false;

  constructor() {
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
    }
    this.viewDate = date;
    this.rangeChanges.next();
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

  handleEvent(event: CalendarEventRecord): void {
    const modalRef = this.modal.open(CalendarEventParticipantsComponent, { size: 'lg' });
    modalRef.componentInstance.event = event;
    modalRef.componentInstance.personId = this.personId();
    const changedPersonIds = modalRef.componentInstance.changedPersonIds;
    modalRef.result.then(
      (result: unknown) => {
        if (typeof result !== 'object' || result === null) {
          return;
        }
        if ('deletedEventId' in result && result.deletedEventId === event.id) {
          this.events.update((events) => events.filter(({ id }) => id !== event.id));
          this.refresh.next();
        } else if (
          this.personId() &&
          changedPersonIds.has(this.personId())
        ) {
          this.rangeChanges.next();
        }
      },
      () => {
        if (this.personId() && changedPersonIds.has(this.personId())) {
          this.rangeChanges.next();
        }
      },
    );
  }

  loadMore(): void {
    if (!this.loading() && this.hasMore()) {
      this.loadMoreRequests.next();
    }
  }

  eventCreated(): void {
    this.creatingEvent.set(false);
    this.rangeChanges.next();
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
    return this.i18n.translateError(error, 'errors.unexpectedCalendar');
  }
}
