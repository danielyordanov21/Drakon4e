import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { AuthenticationComponent } from './components/authentication-component/authentication-component';
import { AuthService } from './services/auth.service';
import { isDemoModeEnabled } from './demo-mode';

@Component({
  selector: 'app-root',
  imports: [AuthenticationComponent, RouterLink, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  readonly demoMode = isDemoModeEnabled;
  readonly auth = inject(AuthService);
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
        error instanceof Error ? error.message : 'Could not sign out. Please try again.',
      );
    } finally {
      this.signingOut.set(false);
    }
  }
}
