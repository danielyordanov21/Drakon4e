import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { CalendarComponent } from '../calendar-component/calendar-component';

@Component({
  selector: 'app-person-component',
  imports: [CalendarComponent],
  templateUrl: './person-component.html',
  styleUrl: './person-component.scss',
})
export class PersonComponent {
  private readonly route = inject(ActivatedRoute);
  readonly personId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('personId') ?? '')),
    { initialValue: this.route.snapshot.paramMap.get('personId') ?? '' },
  );
}
