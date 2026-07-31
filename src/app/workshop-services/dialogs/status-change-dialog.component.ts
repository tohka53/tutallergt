import { Component, Inject, inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ServiceStatus } from '../../models';
import { SERVICE_STATUS_LABELS } from '../../shared/status.util';

@Component({
  selector: 'app-status-change-dialog',
  standalone: false,
  template: `
    <h2 mat-dialog-title>Cambiar estado del servicio</h2>
    <mat-dialog-content>
      <form [formGroup]="form">
        <mat-form-field class="tc-full">
          <mat-label>Nuevo estado</mat-label>
          <mat-select formControlName="status">
            <mat-option *ngFor="let s of statuses" [value]="s">{{ labels[s] }}</mat-option>
          </mat-select>
        </mat-form-field>
        <mat-form-field class="tc-full">
          <mat-label>Comentario</mat-label>
          <textarea matInput formControlName="comment" rows="3" placeholder="Detalle del cambio (visible en la bitácora)"></textarea>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancelar</button>
      <button mat-raised-button class="tc-btn-primary" (click)="save()">Guardar</button>
    </mat-dialog-actions>
  `,
})
export class StatusChangeDialogComponent {
  private fb = inject(FormBuilder);
  labels = SERVICE_STATUS_LABELS;
  statuses: ServiceStatus[] = [
    'received', 'diagnosis', 'pending-auth', 'waiting-part', 'repairing', 'testing', 'done', 'delivered', 'cancelled',
  ];
  form = this.fb.nonNullable.group({
    status: ['received' as ServiceStatus, Validators.required],
    comment: [''],
  });
  constructor(
    public ref: MatDialogRef<StatusChangeDialogComponent, { status: ServiceStatus; comment: string } | null>,
    @Inject(MAT_DIALOG_DATA) public data: { current: ServiceStatus }
  ) {
    this.form.patchValue({ status: data.current });
  }
  save(): void {
    if (this.form.invalid) { return; }
    this.ref.close(this.form.getRawValue());
  }
}
