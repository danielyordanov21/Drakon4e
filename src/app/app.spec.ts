import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { vi } from 'vitest';
import { CalendarService } from './services/calendar.service';
import { Database } from './models/database.types';
import { SUPABASE_CLIENT } from './services/supabase-client';
import { AuthService } from './services/auth.service';
import { App } from './app';
import { routes } from './app.routes';

describe('App', () => {
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

  beforeEach(async () => {
    const client = {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session }, error: null }),
        onAuthStateChange: vi.fn(() => ({
          data: { subscription: { unsubscribe: vi.fn() } },
        })),
        signOut: vi.fn().mockResolvedValue({ error: null }),
      },
    } as unknown as SupabaseClient<Database>;

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter(routes),
        { provide: SUPABASE_CLIENT, useValue: vi.fn().mockResolvedValue(client) },
        {
          provide: CalendarService,
          useValue: {
            getEventsInRange: vi.fn().mockResolvedValue({
              events: [],
              hasMore: false,
              nextOffset: null,
            }),
            getEventsForPersonInRange: vi.fn().mockResolvedValue({
              events: [],
              hasMore: false,
              nextOffset: null,
            }),
            getPeople: vi.fn().mockResolvedValue([]),
            getParticipants: vi.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the calendar on the home route', async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);

    fixture.detectChanges();
    await router.navigateByUrl('/');
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Your schedule');
    expect(compiled.textContent).toContain('Events');
  });

  it('should render the calendar route', async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);

    fixture.detectChanges();
    await router.navigateByUrl('/calendar');
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Events');
  });

  it('shows the signed-in user when a Supabase session is available', async () => {
    const fixture = TestBed.createComponent(App);
    await TestBed.inject(AuthService).initialize();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Signed in as user@example.com');
  });

  it("should render a person page with that person's calendar", async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);

    fixture.detectChanges();
    await router.navigateByUrl('/people/person-1');
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Person person-1');
    expect(compiled.textContent).toContain('Events');
  });
});
