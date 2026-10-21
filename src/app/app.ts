import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { AuthenticationComponent } from './components/authentication-component/authentication-component';
import { PersonButtonComponent } from './components/person-button-component/person-button-component';
import { AuthService } from './services/auth.service';
import { isDemoModeEnabled } from './demo-mode';
import { I18nService } from './services/i18n.service';

@Component({
  selector: 'app-root',
  imports: [AuthenticationComponent, PersonButtonComponent, RouterLink, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  readonly demoMode = isDemoModeEnabled;
  readonly auth = inject(AuthService);
  readonly i18n = inject(I18nService);
  readonly signOutError = signal<string | null>(null);
  readonly signingOut = signal(false);

  constructor() {
    if (!this.demoMode) {
      void this.auth.initialize();
    }
  }

  async signOut(): Promise<void> {
    this.signingOut.set(true);
    this.signOutError.set(null);
    try {
      await this.auth.signOut();
    } catch (error: unknown) {
      this.signOutError.set(
        error instanceof Error ? error.message : this.i18n.t('errors.signOut'),
      );
    } finally {
      this.signingOut.set(false);
    }
  }

  setLanguage(event: Event): void {
    const language = (event.target as HTMLSelectElement).value;
    if (language === 'en' || language === 'bg') {
      void this.i18n.setLanguage(language);
    }
  }
}
