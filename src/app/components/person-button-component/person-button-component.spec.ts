import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { PersonButtonComponent } from './person-button-component';
import { CalendarService } from '../../services/calendar.service';

describe('PersonButtonComponent', () => {
  let component: PersonButtonComponent;
  let fixture: ComponentFixture<PersonButtonComponent>;
  const people = [
    { id: 'person-1', name: 'Alex' },
    { id: 'person-2', name: 'Morgan' },
  ];
  const peoplePage = { people, hasMore: false, nextOffset: null };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PersonButtonComponent],
      providers: [
        provideRouter([]),
        {
          provide: CalendarService,
          useValue: { getPeople: vi.fn().mockResolvedValue(peoplePage) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PersonButtonComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows database people as stacked person links when opened', () => {
    component.toggleMenu();
    fixture.detectChanges();

    const options = fixture.nativeElement.querySelectorAll(
      '.person-picker__option',
    ) as NodeListOf<HTMLAnchorElement>;
    expect(options).toHaveLength(3);
    expect(options[0]?.textContent?.trim()).toBe('All people');
    expect(options[1]?.textContent?.trim()).toBe('Alex');
    expect(options[1]?.getAttribute('href')).toBe('/people/person-1');
    expect(options[2]?.textContent?.trim()).toBe('Morgan');
  });

  it('closes the dropdown when a click happens outside the component', () => {
    component.toggleMenu();
    fixture.detectChanges();
    expect(component.isOpen()).toBe(true);

    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(component.isOpen()).toBe(false);
  });

  it('positions the dropdown within the viewport', () => {
    const trigger = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
      top: 10,
      bottom: 58,
      left: window.innerWidth - 12,
      right: window.innerWidth,
      width: 48,
      height: 48,
      x: window.innerWidth - 12,
      y: 10,
      toJSON: () => ({}),
    });

    component.toggleMenu();

    const position = component.dropdownPosition();
    expect(position.left).toBeGreaterThanOrEqual(8);
    expect(position.left + 352).toBeLessThanOrEqual(window.innerWidth - 8);
    expect(position.top).toBeGreaterThanOrEqual(8);
    expect(position.top + position.maxHeight).toBeLessThanOrEqual(window.innerHeight - 8);
  });
});
