import { ApplicationConfig, Provider, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { isDemoModeEnabled } from './demo-mode';
import { routes } from './app.routes';
import { CalendarService } from './services/calendar.service';
import { DemoCalendarService } from './services/demo-calendar.service';

const demoProviders: Provider[] = isDemoModeEnabled
  ? [{ provide: CalendarService, useClass: DemoCalendarService }]
  : [];

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    ...demoProviders,
  ],
};
