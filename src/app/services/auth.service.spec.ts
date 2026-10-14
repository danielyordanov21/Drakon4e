import { TestBed } from '@angular/core/testing';
import type { AuthChangeEvent, Session, SupabaseClient } from '@supabase/supabase-js';
import { vi } from 'vitest';
import { Database } from '../models/database.types';
import { SUPABASE_CLIENT } from './supabase-client';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const session: Session = {
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    expires_in: 3600,
    token_type: 'bearer',
    user: {
      id: 'user-1',
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: {},
      aud: 'authenticated',
      created_at: '2026-01-01T00:00:00.000Z',
      email: 'user@example.com',
    },
  };

  let authChange: ((event: AuthChangeEvent, session: Session | null) => void) | undefined;
  let getSession: ReturnType<typeof vi.fn>;
  let signInWithPassword: ReturnType<typeof vi.fn>;
  let signUp: ReturnType<typeof vi.fn>;
  let signOut: ReturnType<typeof vi.fn>;
  let unsubscribe: ReturnType<typeof vi.fn>;
  let service: AuthService;

  beforeEach(() => {
    authChange = undefined;
    getSession = vi.fn().mockResolvedValue({ data: { session }, error: null });
    signInWithPassword = vi.fn().mockResolvedValue({ error: null });
    signUp = vi.fn().mockResolvedValue({ data: { session }, error: null });
    signOut = vi.fn().mockResolvedValue({ error: null });
    unsubscribe = vi.fn();

    const client = {
      auth: {
        getSession,
        onAuthStateChange: vi.fn(
          (callback: (event: AuthChangeEvent, session: Session | null) => void) => {
            authChange = callback;
            return { data: { subscription: { unsubscribe } } };
          },
        ),
        signInWithPassword,
        signUp,
        signOut,
      },
    } as unknown as SupabaseClient<Database>;

    TestBed.configureTestingModule({
      providers: [{ provide: SUPABASE_CLIENT, useValue: vi.fn().mockResolvedValue(client) }],
    });
    service = TestBed.inject(AuthService);
  });

  it('restores the existing session and follows future auth changes', async () => {
    await service.initialize();

    expect(getSession).toHaveBeenCalledOnce();
    expect(service.session()).toBe(session);
    expect(service.ready()).toBe(true);

    authChange?.('SIGNED_OUT', null);
    expect(service.session()).toBeNull();
  });

  it('uses email and password to sign in', async () => {
    await service.signIn('user@example.com', 'password');

    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'password',
    });
  });

  it('reports whether sign-up returned a session', async () => {
    await expect(service.signUp('user@example.com', 'password')).resolves.toBe(true);

    signUp.mockResolvedValueOnce({ data: { session: null }, error: null });
    await expect(service.signUp('user@example.com', 'password')).resolves.toBe(false);
  });

  it('surfaces sign-in errors', async () => {
    signInWithPassword.mockResolvedValueOnce({ error: { message: 'Invalid login credentials' } });

    await expect(service.signIn('user@example.com', 'wrong')).rejects.toThrow(
      'Invalid login credentials',
    );
  });

  it('unsubscribes from auth changes when destroyed', async () => {
    await service.initialize();
    TestBed.resetTestingModule();

    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
