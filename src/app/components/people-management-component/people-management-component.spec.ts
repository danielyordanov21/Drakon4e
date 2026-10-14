import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { Person } from '../../models/person.model';
import { CalendarService } from '../../services/calendar.service';
import { PeopleManagementComponent } from './people-management-component';

describe('PeopleManagementComponent', () => {
  const existingPerson: Person = { id: 'person-1', name: 'Alex Morgan' };
  const calendarService = {
    getPeople: vi.fn().mockResolvedValue([existingPerson]),
    createPerson: vi.fn().mockResolvedValue({ id: 'person-2', name: 'Jamie Lee' }),
    updatePerson: vi.fn().mockResolvedValue(undefined),
    deletePerson: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    calendarService.getPeople.mockResolvedValue([existingPerson]);
    calendarService.createPerson.mockResolvedValue({ id: 'person-2', name: 'Jamie Lee' });

    await TestBed.configureTestingModule({
      imports: [PeopleManagementComponent],
      providers: [
        provideRouter([]),
        { provide: CalendarService, useValue: calendarService },
      ],
    }).compileComponents();
  });

  it('adds a person through the account-scoped calendar service', async () => {
    const fixture = TestBed.createComponent(PeopleManagementComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();

    component.name = 'Jamie Lee';
    await component.savePerson();

    expect(calendarService.createPerson).toHaveBeenCalledWith('Jamie Lee');
    expect(component.people().map(({ id }) => id)).toEqual(['person-1', 'person-2']);
  });

  it('edits an existing person', async () => {
    const fixture = TestBed.createComponent(PeopleManagementComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();

    component.startEditing(existingPerson);
    component.name = 'Alex Updated';
    await component.savePerson();

    expect(calendarService.updatePerson).toHaveBeenCalledWith('person-1', 'Alex Updated');
    expect(component.people()[0]?.name).toBe('Alex Updated');
  });
});
