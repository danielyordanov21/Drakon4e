import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Person } from '../../models/person.model';
import { CalendarService } from '../../services/calendar.service';
import { I18nService } from '../../services/i18n.service';

@Component({
  selector: 'app-person-button-component',
  imports: [RouterLink],
  templateUrl: './person-button-component.html',
  styleUrl: './person-button-component.scss',
})
export class PersonButtonComponent {
  @ViewChild('trigger')
  private trigger!: ElementRef<HTMLButtonElement>;

  private readonly calendarService = inject(CalendarService);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);
  private readonly peopleController = new AbortController();
  readonly i18n = inject(I18nService);

  readonly people = signal<Person[]>([]);
  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly isOpen = signal(false);
  readonly hasMore = signal(false);
  readonly loadingMore = signal(false);
  readonly dropdownPosition = signal({ top: 0, left: 0, maxHeight: 0 });

  constructor() {
    this.destroyRef.onDestroy(() => this.peopleController.abort());
    void this.loadPeople();
  }

  closeMenu(): void {
    this.isOpen.set(false);
  }

  toggleMenu(): void {
    if (this.isOpen()) {
      this.closeMenu();
      return;
    }
    this.updateDropdownPosition();
    this.isOpen.set(true);
  }

  @HostListener('document:click', ['$event'])
  closeMenuOnOutsideClick(event: MouseEvent): void {
    if (event.target instanceof Node && !this.host.nativeElement.contains(event.target)) {
      this.closeMenu();
    }
  }

  @HostListener('document:keydown.escape')
  closeMenuOnEscape(): void {
    this.closeMenu();
  }

  @HostListener('window:resize')
  @HostListener('window:scroll')
  updateOpenDropdownPosition(): void {
    if (this.isOpen()) {
      this.updateDropdownPosition();
    }
  }

  async loadMore(): Promise<void> {
    if (this.loadingMore() || !this.hasMore()) {
      return;
    }
    this.loadingMore.set(true);
    try {
      const page = await this.calendarService.getPeople({
        offset: this.people().length,
        signal: this.peopleController.signal,
      });
      this.people.update((people) => [...people, ...page.people]);
      this.hasMore.set(page.hasMore);
    } catch (error: unknown) {
      if (!this.peopleController.signal.aborted) {
        this.errorMessage.set(this.i18n.translateError(error, 'picker.error'));
      }
    } finally {
      if (!this.peopleController.signal.aborted) {
        this.loadingMore.set(false);
      }
    }
  }

  private async loadPeople(): Promise<void> {
    try {
      const page = await this.calendarService.getPeople({
        signal: this.peopleController.signal,
      });
      this.people.set(page.people);
      this.hasMore.set(page.hasMore);
    } catch (error: unknown) {
      if (!this.peopleController.signal.aborted) {
        this.errorMessage.set(
          this.i18n.translateError(error, 'picker.error'),
        );
      }
    } finally {
      if (!this.peopleController.signal.aborted) {
        this.loading.set(false);
      }
    }
  }

  private updateDropdownPosition(): void {
    const bounds = this.trigger.nativeElement.getBoundingClientRect();
    const viewportPadding = 8;
    const menuWidth = Math.min(352, window.innerWidth - viewportPadding * 2);
    const left = Math.min(
      Math.max(viewportPadding, bounds.left),
      window.innerWidth - menuWidth - viewportPadding,
    );
    const availableBelow = Math.max(
      0,
      window.innerHeight - bounds.bottom - viewportPadding * 2,
    );
    const availableAbove = Math.max(0, bounds.top - viewportPadding * 2);
    const opensBelow = availableBelow >= availableAbove;
    const maxHeight = Math.max(
      0,
      Math.min(384, opensBelow ? availableBelow : availableAbove),
    );
    const top = opensBelow
      ? bounds.bottom + viewportPadding
      : Math.max(viewportPadding, bounds.top - maxHeight - viewportPadding);

    this.dropdownPosition.set({ top, left, maxHeight });
  }
}
