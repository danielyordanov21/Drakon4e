import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import type { Session, Subscription } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from './supabase-client';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly getClient = inject(SUPABASE_CLIENT);
  private subscription: Subscription | null = null;
  private initializationPromise: Promise<void> | null = null;

  readonly session = signal<Session | null>(null);
  readonly ready = signal(false);
  readonly initializationError = signal<string | null>(null);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.subscription?.unsubscribe());
  }

  initialize(): Promise<void> {
    this.initializationPromise ??= this.loadSession();
    return this.initializationPromise;
  }

  private async loadSession(): Promise<void> {
    try {
      const client = await this.getClient();
      this.subscription = client.auth.onAuthStateChange((_event, session) => {
        this.session.set(session);
      }).data.subscription;

      const { data, error } = await client.auth.getSession();
      if (error) {
        throw error;
      }
      this.session.set(data.session);
    } catch (error: unknown) {
      this.initializationError.set(
        error instanceof Error ? error.message : 'Could not initialize Supabase authentication.',
      );
    } finally {
      this.ready.set(true);
    }
  }

  async signIn(email: string, password: string): Promise<void> {
    const { error } = await (await this.getClient()).auth.signInWithPassword({ email, password });
    if (error) {
      throw new Error(error.message, { cause: error });
    }
  }

  async signUp(email: string, password: string): Promise<boolean> {
    const { data, error } = await (await this.getClient()).auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) {
      throw new Error(error.message, { cause: error });
    }
    return data.session !== null;
  }

  async signOut(): Promise<void> {
    const { error } = await (await this.getClient()).auth.signOut();
    if (error) {
      throw new Error(error.message, { cause: error });
    }
  }
}
