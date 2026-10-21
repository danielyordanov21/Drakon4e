import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { I18nService } from '../../services/i18n.service';

@Component({
  selector: 'app-authentication-component',
  imports: [FormsModule],
  templateUrl: './authentication-component.html',
  styleUrl: './authentication-component.scss',
})
export class AuthenticationComponent {
  private readonly auth = inject(AuthService);
  readonly i18n = inject(I18nService);

  readonly isSignUp = signal(false);
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  email = '';
  password = '';

  toggleMode(): void {
    this.isSignUp.update((isSignUp) => !isSignUp);
    this.errorMessage.set(null);
    this.successMessage.set(null);
  }

  setLanguage(event: Event): void {
    const language = (event.target as HTMLSelectElement).value;
    if (language === 'en' || language === 'bg') {
      void this.i18n.setLanguage(language);
    }
  }

  async submit(): Promise<void> {
    this.submitting.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    try {
      if (this.isSignUp()) {
        const signedIn = await this.auth.signUp(this.email.trim(), this.password);
        if (!signedIn) {
          this.successMessage.set(
            this.i18n.t('auth.confirmation'),
          );
        }
      } else {
        await this.auth.signIn(this.email.trim(), this.password);
      }
    } catch (error: unknown) {
      this.errorMessage.set(
        this.i18n.translateError(error, 'auth.failed'),
      );
    } finally {
      this.submitting.set(false);
    }
  }
}
