import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MaterialModule } from './material.module';
import { GtqPipe } from './pipes/gtq.pipe';
import { FileSizePipe } from './pipes/file-size.pipe';
import { ConfirmDialogComponent } from './components/confirm-dialog/confirm-dialog.component';
import { MobileSortComponent } from './components/mobile-sort/mobile-sort.component';

const EXPORTS = [
  CommonModule, ReactiveFormsModule, FormsModule, RouterModule, MaterialModule,
  GtqPipe, FileSizePipe, MobileSortComponent,
];

@NgModule({
  declarations: [GtqPipe, FileSizePipe, ConfirmDialogComponent, MobileSortComponent],
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterModule, MaterialModule],
  exports: EXPORTS,
})
export class SharedModule {}
