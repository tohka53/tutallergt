import { Component, Inject, inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { PartCatalogItem, PartType } from '../../models';
import { PartsCatalogService } from '../../core/services/parts-catalog.service';

@Component({
  selector: 'app-part-form-dialog',
  standalone: false,
  templateUrl: './part-form-dialog.component.html',
})
export class PartFormDialogComponent {
  private fb = inject(FormBuilder);
  catalog = inject(PartsCatalogService);
  types: { value: PartType; label: string }[] = [
    { value: 'part', label: 'Repuesto' },
    { value: 'material', label: 'Material' },
    { value: 'lubricant', label: 'Lubricante' },
    { value: 'labor', label: 'Mano de obra' },
    { value: 'other', label: 'Otro' },
  ];

  form = this.fb.nonNullable.group({
    code: [''],
    name: ['', Validators.required],
    description: [''],
    category: ['Otros', Validators.required],
    suggestedCost: [0, [Validators.min(0)]],
    suggestedPrice: [0, [Validators.required, Validators.min(0)]],
    type: ['part' as PartType, Validators.required],
    active: [true],
  });

  constructor(
    public ref: MatDialogRef<PartFormDialogComponent, boolean>,
    @Inject(MAT_DIALOG_DATA) public data: PartCatalogItem | null
  ) {
    if (data) {
      this.form.patchValue({
        code: data.code, name: data.name, description: data.description,
        category: data.category, suggestedCost: data.suggestedCost,
        suggestedPrice: data.suggestedPrice, type: data.type, active: data.active,
      });
    }
  }

  save(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue();
    const payload = {
      ...v,
      // La mano de obra no se compra: su costo base siempre es cero.
      suggestedCost: v.type === 'labor' ? 0 : v.suggestedCost,
      compatibleBrands: this.data?.compatibleBrands ?? [],
      compatibleModels: this.data?.compatibleModels ?? [],
    };
    const obs = this.data ? this.catalog.update(this.data.id, payload) : this.catalog.create(payload);
    obs.subscribe(() => this.ref.close(true));
  }
}
