import { NgModule } from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSortModule } from '@angular/material/sort';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatMenuModule } from '@angular/material/menu';
import { MatTabsModule } from '@angular/material/tabs';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDividerModule } from '@angular/material/divider';
import { MatBadgeModule } from '@angular/material/badge';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { DragDropModule } from '@angular/cdk/drag-drop';

const MODULES = [
  MatToolbarModule, MatSidenavModule, MatListModule, MatButtonModule, MatIconModule,
  MatCardModule, MatInputModule, MatFormFieldModule, MatSelectModule, MatTableModule,
  MatPaginatorModule, MatSortModule, MatDialogModule, MatSnackBarModule, MatMenuModule,
  MatTabsModule, MatChipsModule, MatTooltipModule, MatProgressSpinnerModule, MatProgressBarModule,
  MatSlideToggleModule, MatCheckboxModule, MatAutocompleteModule, MatDatepickerModule,
  MatNativeDateModule, MatDividerModule, MatBadgeModule, MatExpansionModule, MatButtonToggleModule, DragDropModule,
];

@NgModule({ imports: MODULES, exports: MODULES })
export class MaterialModule {}
