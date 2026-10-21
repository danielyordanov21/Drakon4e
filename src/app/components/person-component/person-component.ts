import { Component, DestroyRef, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Person } from '../../models/person.model';
import { CalendarService } from '../../services/calendar.service';
import { CalendarComponent } from '../calendar-component/calendar-component';
import { I18nService } from '../../services/i18n.service';
import {
  catchError,
  distinctUntilChanged,
  from,
  map,
  of,
  switchMap,
  tap,
} from 'rxjs';

@Component({
  selector: 'app-person-component',
  imports: [CalendarComponent],
  templateUrl: './person-component.html',
  styleUrl: './person-component.scss',
})
export class PersonComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly calendarService = inject(CalendarService);
  readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);

  readonly personId = signal(this.route.snapshot.paramMap.get('personId') ?? '');
  readonly person = signal<Person | null>(null);
  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  constructor() {
    this.route.paramMap
      .pipe(
        map((params) => params.get('personId') ?? ''),
        distinctUntilChanged(),
        tap((personId) => {
          this.personId.set(personId);
          this.person.set(null);
          this.loading.set(true);
          this.errorMessage.set(null);
        }),
        switchMap((personId) =>
          from(this.calendarService.getPerson(personId)).pipe(
            catchError((error: unknown) => {
              this.errorMessage.set(this.i18n.translateError(error, 'person.loadError'));
              return of(null);
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((person) => {
        this.person.set(person);
        this.loading.set(false);
      });
  }
}
