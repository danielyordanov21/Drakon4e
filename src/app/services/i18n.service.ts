import { registerLocaleData } from '@angular/common';
import { Injectable, computed, signal } from '@angular/core';

export const TRANSLATIONS = {
  app: {
    demoNotice: 'Demo mode — sample data only; changes are temporary and aren’t saved to Supabase.',
    connecting: 'Connecting to Supabase…',
    connectionErrorTitle: 'Could not connect to Supabase',
    connectionHelp: 'Check the project URL, publishable key, and network connection.',
  },
  nav: {
    label: 'Main navigation',
    choosePerson: 'Choose person',
    managePeople: 'Manage people',
    manageEvents: 'Manage events',
    account: 'Account',
    signedInAs: 'Signed in as {email}',
    signedIn: 'Signed in',
    signOut: 'Sign out',
    signingOut: 'Signing out…',
    language: 'Language',
  },
  picker: {
    people: 'People',
    loading: 'Loading people…',
    noPeople: 'No people found.',
    loadMore: 'Load more people',
    loadingMore: 'Loading…',
    allPeople: 'All people',
    error: 'Could not load people.',
  },
  auth: {
    brand: 'Drakon4e calendar',
    createAccountHeading: 'Create your account',
    welcome: 'Welcome back',
    createIntro: 'Create an account to access the shared calendar.',
    signInIntro: 'Sign in to access the shared calendar.',
    email: 'Email',
    password: 'Password',
    pleaseWait: 'Please wait…',
    createAccount: 'Create account',
    signIn: 'Sign in',
    alreadyAccount: 'Already have an account?',
    newToCalendar: 'New to the calendar?',
    createAnAccount: 'Create an account',
    confirmation:
      'If this address can be registered, check your email for a confirmation link. You can also return to sign in.',
    failed: 'Authentication failed. Please try again.',
  },
  calendar: {
    label: 'Calendar',
    navigation: 'Calendar navigation',
    previous: 'Previous period',
    next: 'Next period',
    today: 'Today',
    newEvent: 'New event',
    view: 'Calendar view',
    month: 'Month',
    week: 'Week',
    day: 'Day',
    loading: 'Loading events…',
    yourSchedule: 'Your schedule',
    events: 'Events',
    loadMore: 'Load more',
    event: 'Event',
    starts: 'Starts',
    ends: 'Ends',
    showParticipants: 'Show participants for {event}',
    noEvents: 'No events in this date range.',
  },
  person: {
    loading: 'Loading person…',
    notFound: 'Person not found',
    loadError: 'Could not load this person.',
  },
  people: {
    eyebrow: 'Your account',
    heading: 'Manage people',
    intro: 'Add and maintain the people on your calendar. Only you can see these records.',
    formLabel: 'Add or edit a person',
    name: 'Name',
    grade: 'Grade',
    gradeHint: 'Enter a whole number from 0 to 12, or leave blank.',
    books: 'Books',
    notes: 'Notes',
    smallNotes: 'Small notes',
    saving: 'Saving…',
    saveChanges: 'Save changes',
    addPerson: 'Add person',
    cancel: 'Cancel',
    listHeading: 'Your people',
    manageEvents: 'Manage events',
    hideEvents: 'Hide events',
    edit: 'Edit',
    deleting: 'Deleting…',
    delete: 'Delete',
    gradeLabel: 'Grade {grade}',
    booksLabel: 'Books: {books}',
    eventsFor: 'Events for {name}',
    loadingEvents: 'Loading events…',
    noEvents: 'No events linked to this person.',
    addExistingEvent: 'Add an existing event',
    selectEvent: 'Select an event',
    addEventToPerson: 'Add event to person',
    createEventHint: 'Create an event to link it to this person.',
    loadMoreAssigned: 'Load more assigned events',
    loadMoreEvents: 'Load more events to assign',
    loadingPeople: 'Loading people…',
    noPeople: 'No people yet. Add someone above to get started.',
    loadMorePeople: 'Load more people',
    deletingConfirm: 'Delete {name}? Events will remain, but this person’s links will be removed.',
  },
  events: {
    eyebrow: 'Your account',
    heading: 'Manage events',
    intro: 'Create, update, and remove events, then assign people to each event.',
    navigation: 'Management navigation',
    managePeople: 'Manage people',
    backToCalendar: 'Back to calendar',
    editEvent: 'Edit event',
    addEvent: 'Add an event',
    title: 'Title',
    starts: 'Starts',
    endsOptional: 'Ends (optional)',
    participantsOptional: 'Participants (optional)',
    loadingPeople: 'Loading your people…',
    noPeopleToAssign: 'No people yet. Add people before assigning participants.',
    loadingMorePeople: 'Loading people…',
    loadMorePeople: 'Load more people',
    saving: 'Saving…',
    saveChanges: 'Save changes',
    addEventButton: 'Add event',
    cancel: 'Cancel',
    yourEvents: 'Your events',
    loadingEvents: 'Loading events…',
    deleting: 'Deleting…',
    delete: 'Delete',
    hidePeople: 'Hide people',
    managePeopleButton: 'Manage people',
    edit: 'Edit',
    peopleFor: 'People for {event}',
    peopleAttending: 'People attending',
    removing: 'Removing…',
    remove: 'Remove',
    noPeopleAssigned: 'No people assigned.',
    addPerson: 'Add a person',
    selectPerson: 'Select a person',
    addPersonToEvent: 'Add person to event',
    noEvents: 'No events yet. Add one above to get started.',
    loadMoreEvents: 'Load more events',
  },
  eventForm: {
    title: 'Event title',
    starts: 'Starts',
    endsOptional: 'Ends (optional)',
    participantsOptional: 'Participants (optional)',
    loadingPeople: 'Loading your people…',
    noPeople: 'No people yet. Add people before assigning participants.',
    loadingMore: 'Loading people…',
    loadMore: 'Load more people',
    saving: 'Saving…',
    save: 'Save event',
    cancel: 'Cancel',
  },
  participants: {
    closeDialog: 'Close dialog',
    close: 'Close',
    heading: 'Participants',
    loading: 'Loading participants…',
    removing: 'Removing…',
    removeFromEvent: 'Remove from event',
    none: 'No participants.',
    addOne: 'Add one of your people',
    select: 'Select a person',
    adding: 'Adding…',
    add: 'Add participant',
    loadingPeople: 'Loading people…',
    loadMore: 'Load more people',
    deleteConfirm: 'Delete “{event}” and its participant links?',
    deleting: 'Deleting…',
    deleteEvent: 'Delete event',
    done: 'Done',
  },
  errors: {
    signOut: 'Could not sign out. Please try again.',
    unexpected: 'An unexpected error occurred.',
    unexpectedCalendar: 'An unexpected calendar error occurred.',
    unexpectedEvent: 'An unexpected event error occurred.',
    unexpectedParticipant: 'An unexpected participant error occurred.',
  },
} as const;

export type Language = 'en' | 'bg';
export type TranslationKey = {
  [Section in keyof typeof TRANSLATIONS]: `${Section & string}.${keyof (typeof TRANSLATIONS)[Section] & string}`;
}[keyof typeof TRANSLATIONS];

const BULGARIAN_ERRORS: Record<string, string> = {
  'Could not find this person.': 'Човекът не е намерен.',
  'Could not load this person.': 'Информацията за човека не можа да бъде заредена.',
  'Could not load people.': 'Хората не можаха да бъдат заредени.',
  'Could not load events.': 'Събитията не можаха да бъдат заредени.',
  'Could not load your events.': 'Вашите събития не можаха да бъдат заредени.',
  'Could not save this person.': 'Информацията за човека не можа да бъде запазена.',
  'Could not save this event.': 'Събитието не можа да бъде запазено.',
  'Could not delete this event.': 'Събитието не можа да бъде изтрито.',
  'Could not delete this person.': 'Човекът не можа да бъде изтрит.',
  'Could not load event participants.': 'Участниците в събитието не можаха да бъдат заредени.',
  'Could not add this person to the event.': 'Човекът не можа да бъде добавен към събитието.',
  'Could not remove this person from the event.': 'Човекът не можа да бъде премахнат от събитието.',
  'An unexpected calendar error occurred.': 'Възникна неочаквана грешка в календара.',
  'An unexpected event error occurred.': 'Възникна неочаквана грешка при събитието.',
  'An unexpected participant error occurred.': 'Възникна неочаквана грешка при участниците.',
};

const BULGARIAN_ERROR_PREFIXES: Array<[string, string]> = [
  ['Could not load calendar events:', 'Събитията в календара не можаха да бъдат заредени:'],
  ['Could not load events:', 'Събитията не можаха да бъдат заредени:'],
  ["Could not load this person's events:", 'Събитията за този човек не можаха да бъдат заредени:'],
  ["Could not load this person's calendar:", 'Календарът на този човек не можа да бъде зареден:'],
  ['Could not load people:', 'Хората не можаха да бъдат заредени:'],
  ['Could not load person:', 'Информацията за човека не можа да бъде заредена:'],
  ['Could not create person:', 'Човекът не можа да бъде създаден:'],
  ['Could not update person:', 'Информацията за човека не можа да бъде актуализирана:'],
  ['Could not delete person:', 'Човекът не можа да бъде изтрит:'],
  ['Could not create event:', 'Събитието не можа да бъде създадено:'],
  ['Could not update event:', 'Събитието не можа да бъде актуализирано:'],
  ['Could not delete event:', 'Събитието не можа да бъде изтрито:'],
  ['Could not load event participants:', 'Участниците в събитието не можаха да бъдат заредени:'],
  ['Could not add this person to the event:', 'Човекът не можа да бъде добавен към събитието:'],
  ['Could not remove this person from the event:', 'Човекът не можа да бъде премахнат от събитието:'],
];

@Injectable({ providedIn: 'root' })
export class I18nService {
  readonly defaultLanguage: Language = 'bg';
  readonly language = signal<Language>(this.defaultLanguage);
  readonly locale = computed(() =>
    this.language() === 'bg' && this.translationsReady() ? 'bg-BG' : 'en-US',
  );
  readonly calendarLocale = computed(() =>
    this.language() === 'bg' && this.translationsReady() ? 'bg' : 'en',
  );
  private languageChange = 0;
  private bulgarianTranslations: Record<TranslationKey, string> | null = null;
  private readonly translationsReady = signal(false);

  constructor() {
    document.documentElement.lang = this.defaultLanguage;
    void this.setLanguage(this.defaultLanguage);
  }

  async setLanguage(language: Language): Promise<void> {
    const request = ++this.languageChange;
    if (language === 'bg') {
      const [{ BULGARIAN }, locale] = await Promise.all([
        import('./i18n-bg'),
        import('@angular/common/locales/bg'),
      ]);
      if (request !== this.languageChange) {
        return;
      }
      this.bulgarianTranslations = BULGARIAN;
      registerLocaleData(locale.default);
      this.translationsReady.set(true);
    }
    this.language.set(language);
    document.documentElement.lang = language;
  }

  translateError(
    error: unknown,
    fallback: TranslationKey = 'errors.unexpected',
  ): string {
    if (!(error instanceof Error)) {
      return this.t(fallback);
    }
    if (this.language() !== 'bg') {
      return error.message;
    }

    const exactTranslation = BULGARIAN_ERRORS[error.message];
    if (exactTranslation) {
      return exactTranslation;
    }
    const prefix = BULGARIAN_ERROR_PREFIXES.find(([english]) =>
      error.message.startsWith(english),
    );
    return prefix
      ? `${prefix[1]}${error.message.slice(prefix[0].length)}`
      : error.message;
  }

  t(key: TranslationKey, params: Record<string, string | number> = {}): string {
    this.translationsReady();
    const template =
      this.language() === 'bg'
        ? this.bulgarianTranslations?.[key] ?? this.getEnglishTranslation(key)
        : this.getEnglishTranslation(key);
    return template.replace(/\{(\w+)\}/g, (_, name: string) =>
      String(params[name] ?? `{${name}}`),
    );
  }

  private getEnglishTranslation(key: TranslationKey): string {
    const [section, name] = key.split('.') as [keyof typeof TRANSLATIONS, string];
    return TRANSLATIONS[section][name as keyof (typeof TRANSLATIONS)[typeof section]] as string;
  }
}
