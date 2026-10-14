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

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PersonButtonComponent],
      providers: [
        provideRouter([]),
        {
          provide: CalendarService,
          useValue: { getPeople: vi.fn().mockResolvedValue(people) },
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
});
