import { Routes } from '@angular/router';

import { CalendarComponent } from './components/calendar-component/calendar-component';
import { PeopleManagementComponent } from './components/people-management-component/people-management-component';
import { PersonComponent } from './components/person-component/person-component';

export const routes: Routes = [
  {
    path: 'manage/people',
    component: PeopleManagementComponent,
  },
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
