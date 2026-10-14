import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-authentication-component',
  imports: [FormsModule],
  templateUrl: './authentication-component.html',
  styleUrl: './authentication-component.scss',
})
export class AuthenticationComponent {
  private readonly auth = inject(AuthService);

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

  async submit(): Promise<void> {
    this.submitting.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    try {
      if (this.isSignUp()) {
        const signedIn = await this.auth.signUp(this.email.trim(), this.password);
        if (!signedIn) {
          this.successMessage.set(
            'If this address can be registered, check your email for a confirmation link. You can also return to sign in.',
          );
        }
      } else {
        await this.auth.signIn(this.email.trim(), this.password);
      }
    } catch (error: unknown) {
      this.errorMessage.set(
        error instanceof Error ? error.message : 'Authentication failed. Please try again.',
      );
    } finally {
      this.submitting.set(false);
    }
  }
}
