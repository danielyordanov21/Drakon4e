import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CalendarComponent } from '../calendar-component/calendar-component';

@Component({
  selector: 'app-menu-component',
  imports: [RouterLink, CalendarComponent],
  templateUrl: './menu-component.html',
  styleUrl: './menu-component.scss',
})
export class MenuComponent {
  
}
