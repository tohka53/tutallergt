import { Component, Inject, inject } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Client, Quotation, Vehicle, WorkshopServiceItem } from '../../models';
import { WorkshopServiceService, computeServiceTotal } from '../../core/services/workshop-service.service';
import { QuotationService, computeItemSubtotal } from '../../core/services/quotation.service';
import { NotificationService } from '../../core/services/notification.service';
import { uuid } from '../../core/services/id.util';

export interface ConvertData { quotation: Quotation; client: Client; vehicle: Vehicle; }

@Component({
  selector: 'app-convert-to-service-dialog',
  standalone: false,
  templateUrl: './convert-to-service-dialog.component.html',
  styleUrls: ['./convert-to-service-dialog.component.scss'],
})
export class ConvertToServiceDialogComponent {
  private fb = inject(FormBuilder);
  private services = inject(WorkshopServiceService);
  private quotations = inject(QuotationService);
  private notify = inject(NotificationService);

  saving = false;
  itemTypes = [
    { value: 'part', label: 'Repuesto' }, { value: 'material', label: 'Material' },
    { value: 'labor', label: 'Mano de obra' }, { value: 'other', label: 'Otro' },
  ];

  form = this.fb.group({
    reason: ['', Validators.required],
    diagnosis: [''],
    estimatedDelivery: [null as Date | null],
    fuelLevel: ['1/2'],
    items: this.fb.array<FormGroup>([]),
  });

  constructor(
    public ref: MatDialogRef<ConvertToServiceDialogComponent, string | null>,
    @Inject(MAT_DIALOG_DATA) public data: ConvertData
  ) {
    this.form.patchValue({ reason: 'Trabajos autorizados de la cotización ' + data.quotation.number });
    data.quotation.items.forEach((it) => this.items.push(this.buildItem(it)));
  }

  get items(): FormArray<FormGroup> { return this.form.get('items') as FormArray<FormGroup>; }

  private buildItem(data?: Partial<WorkshopServiceItem>): FormGroup {
    return this.fb.group({
      id: [data?.id ?? uuid()],
      type: [data?.type ?? 'part', Validators.required],
      code: [data?.code ?? ''],
      name: [data?.name ?? '', Validators.required],
      quantity: [data?.quantity ?? 1, [Validators.required, Validators.min(0.01)]],
      unitPrice: [data?.unitPrice ?? 0, [Validators.required, Validators.min(0)]],
      discount: [data?.discount ?? 0, [Validators.min(0)]],
    });
  }

  addItem(): void { this.items.push(this.buildItem()); }
  removeItem(i: number): void { this.items.removeAt(i); }

  lineSubtotal(g: FormGroup): number {
    return computeItemSubtotal({
      quantity: g.get('quantity')?.value ?? 0, unitPrice: g.get('unitPrice')?.value ?? 0, discount: g.get('discount')?.value ?? 0,
    });
  }

  get total(): number {
    return computeServiceTotal(this.buildPayload());
  }

  private buildPayload(): WorkshopServiceItem[] {
    return this.items.controls.map((g) => {
      const v = g.getRawValue() as WorkshopServiceItem;
      return { ...v, subtotal: computeItemSubtotal(v) };
    });
  }

  confirm(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    if (this.items.length === 0) { this.notify.error('El servicio debe tener al menos un artículo.'); return; }
    if (this.data.quotation.status === 'converted' || this.data.quotation.convertedServiceId) {
      this.notify.error('Esta cotización ya fue convertida.');
      this.ref.close(null);
      return;
    }
    this.saving = true;
    const v = this.form.getRawValue();

    this.services.createFromQuotation(this.data.quotation, this.buildPayload(), {
      reason: v.reason!, diagnosis: v.diagnosis ?? '',
      estimatedDelivery: v.estimatedDelivery ? (v.estimatedDelivery as Date).toISOString() : undefined,
      fuelLevel: v.fuelLevel ?? '',
    }).subscribe({
      next: (service) => {
        // Marca la cotización como convertida, conservando el documento original para auditoría.
        this.quotations.setStatus(this.data.quotation.id, 'converted', service.id).subscribe(() => {
          this.saving = false;
          this.notify.success('Cotización convertida en servicio ' + service.number + '.');
          this.ref.close(service.id);
        });
      },
      error: (e: Error) => { this.saving = false; this.notify.error(e.message); },
    });
  }
}
