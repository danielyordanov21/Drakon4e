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
import { I18nService } from './services/i18n.service';

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
            getPeople: vi.fn().mockResolvedValue({
              people: [{ id: 'person-1', name: 'Alex' }],
              hasMore: false,
              nextOffset: null,
            }),
            getPerson: vi.fn().mockResolvedValue({ id: 'person-1', name: 'Alex' }),
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
    expect(compiled.querySelector('.person-picker__trigger')).not.toBeNull();
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
    const header = compiled.querySelector('.app-header');
    expect(header?.querySelector('.app-navigation')).not.toBeNull();
    expect(header?.querySelector('.app-session')).not.toBeNull();
  });

  it("should render a person page with that person's calendar", async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);

    fixture.detectChanges();
    await router.navigateByUrl('/people/person-1');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Alex');
    expect(compiled.textContent).toContain('Events');
    expect(compiled.querySelector('.person-picker__trigger')).not.toBeNull();
  });

  it('shows the person dropdown on the people management page', async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);

    fixture.detectChanges();
    await router.navigateByUrl('/manage/people');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.person-picker__trigger'),
    ).not.toBeNull();
  });

  it('defaults the shared application UI to Bulgarian', async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    const i18n = TestBed.inject(I18nService);

    expect(i18n.defaultLanguage).toBe('bg');
    fixture.detectChanges();
    await router.navigateByUrl('/');
    await i18n.setLanguage(i18n.defaultLanguage);
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Управление на хора');
    expect(compiled.textContent).toContain('Вашият график');
    expect(document.documentElement.lang).toBe('bg');
  });

  it('switches the shared application UI to Bulgarian at runtime', async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    const i18n = TestBed.inject(I18nService);

    fixture.detectChanges();
    await router.navigateByUrl('/');
    fixture.detectChanges();
    await fixture.whenStable();

    await i18n.setLanguage('en');
    expect(i18n.t('calendar.yourSchedule')).toBe('Your schedule');
    await i18n.setLanguage('bg');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Управление на хора');
    expect(compiled.textContent).toContain('Вашият график');
    expect(compiled.textContent).toContain('Изберете човек');
    expect(document.documentElement.lang).toBe('bg');
  });
});
