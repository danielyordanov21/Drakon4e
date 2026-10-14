import { Routes } from '@angular/router';

import { CalendarComponent } from './components/calendar-component/calendar-component';
import { PersonComponent } from './components/person-component/person-component';

export const routes: Routes = [
  {
    path: '',
    component: CalendarComponent,
  },
  {
    path: 'calendar',
    component: CalendarComponent,
  },
  {
    path: 'people/:personId',
    component: PersonComponent,
  },
  {
    path: '**',
    redirectTo: '',
  },
];
