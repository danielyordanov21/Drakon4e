import { Component } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatListModule } from '@angular/material/list';

@Component({
  selector: 'app-list-component',
  standalone: true,
  imports: [
    MatListModule,
    FormsModule,
    ReactiveFormsModule
  ],
  templateUrl: './list-component.html',
  styleUrl: './list-component.scss',
})
export class ListComponent {

}
