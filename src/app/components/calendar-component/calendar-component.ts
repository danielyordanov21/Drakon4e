import {
  Component,
  ChangeDetectionStrategy,
  ViewChild,
  TemplateRef,
  inject,
  input,
} from '@angular/core';
import { isSameDay, isSameMonth } from 'date-fns';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import {
  provideCalendar,
  CalendarEvent,
  CalendarEventAction,
  CalendarEventTimesChangedEvent,
  CalendarView,
  CalendarPreviousViewDirective,
  CalendarTodayDirective,
  CalendarNextViewDirective,
  CalendarMonthViewComponent,
  CalendarWeekViewComponent,
  CalendarDayViewComponent,
  CalendarDatePipe,
  DateAdapter,
} from 'angular-calendar';
import { FormsModule } from '@angular/forms';
import {
  FlatpickrDirective,
  provideFlatpickrDefaults,
} from 'angularx-flatpickr';
import { JsonPipe } from '@angular/common';
import { adapterFactory } from 'angular-calendar/date-adapters/date-fns';
import { CalendarService } from '../../services/calendar.service';
import { Person } from '../../models/person.model';

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
    FormsModule,
    JsonPipe,
    CalendarDatePipe,
    FlatpickrDirective,
  ],
  styleUrl: './calendar-component.scss',
  providers: [
    provideFlatpickrDefaults(),
    provideCalendar({ provide: DateAdapter, useFactory: adapterFactory }),
  ],
})
export class CalendarComponent {
  @ViewChild('modalContent', { static: true }) modalContent!: TemplateRef<any>;

  private readonly calendarService = inject(CalendarService);
  readonly personId = input<Person['id']>();
  view: CalendarView = CalendarView.Month;

  CalendarView = CalendarView;

  viewDate: Date = new Date();

  readonly refresh = this.calendarService.refresh;

  get events(): CalendarEvent[] {
    return this.calendarService.getEvents(this.personId());
  }

  modalData: {
    action: string;
    event: CalendarEvent;
  } | null = null;

  actions: CalendarEventAction[] = [
    {
      label: '<i class="fas fa-fw fa-pencil-alt"></i>',
      a11yLabel: 'Edit',
      onClick: ({ event }: { event: CalendarEvent }): void => {
        this.handleEvent('Edited', event);
      },
    },
    {
      label: '<i class="fas fa-fw fa-trash-alt"></i>',
      a11yLabel: 'Delete',
      onClick: ({ event }: { event: CalendarEvent }): void => {
        this.calendarService.deleteEvent(event);
        this.handleEvent('Deleted', event);
      },
    },
  ];

  activeDayIsOpen = false;

  private modal = inject(NgbModal);

  constructor() {
    this.calendarService.initialize(this.actions);
  }

  dayClicked({ date, events }: { date: Date; events: CalendarEvent[] }): void {
    if (isSameMonth(date, this.viewDate)) {
      if (
        (isSameDay(this.viewDate, date) && this.activeDayIsOpen === true) ||
        events.length === 0
      ) {
        this.activeDayIsOpen = false;
      } else {
        this.activeDayIsOpen = true;
      }
      this.viewDate = date;
    }
  }

  eventTimesChanged(event: CalendarEventTimesChangedEvent): void {
    this.calendarService.updateEventTimes(event);
    this.handleEvent('Dropped or resized', event.event);
  }

  handleEvent(action: string, event: CalendarEvent): void {
    this.modalData = { event, action };
    this.modal.open(this.modalContent, { size: 'lg' });
  }

  addEvent(): void {
    this.calendarService.addEvent(this.personId());
  }

  deleteEvent(eventToDelete: CalendarEvent): void {
    this.calendarService.deleteEvent(eventToDelete);
  }

  setView(view: CalendarView) {
    this.view = view;
  }

  closeOpenMonthViewDay() {
    this.activeDayIsOpen = false;
  }
}