import { Component, OnInit, inject } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { ClientService } from '../../core/services/client.service';
import { VehicleService } from '../../core/services/vehicle.service';
import { PartsCatalogService } from '../../core/services/parts-catalog.service';
import {
  QuotationService, computeItemCost, computeItemSubtotal, computeQuotationTotals,
} from '../../core/services/quotation.service';
import { WorkshopSettingsService } from '../../core/services/workshop-settings.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { Client, PartCatalogItem, Quotation, QuotationItem, Vehicle } from '../../models';
import { uuid } from '../../core/services/id.util';

@Component({
  selector: 'app-quotation-form',
  standalone: false,
  templateUrl: './quotation-form.component.html',
  styleUrls: ['./quotation-form.component.scss'],
})
export class QuotationFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private clients = inject(ClientService);
  private vehicles = inject(VehicleService);
  private catalog = inject(PartsCatalogService);
  private quotations = inject(QuotationService);
  private auth = inject(AuthService);
  private notify = inject(NotificationService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  settings = inject(WorkshopSettingsService);

  editId: string | null = null;
  saving = false;
  loading = false;
  clientList: Client[] = [];
  vehicleList: Vehicle[] = [];
  searchResults: PartCatalogItem[] = [];
  itemTypes = [
    { value: 'part', label: 'Repuesto' }, { value: 'material', label: 'Material' },
    { value: 'labor', label: 'Mano de obra' }, { value: 'other', label: 'Otro' },
  ];

  form = this.fb.group({
    clientId: ['', Validators.required],
    vehicleId: ['', Validators.required],
    date: [new Date(), Validators.required],
    validityDays: [15, [Validators.required, Validators.min(1)]],
    mileage: [0, [Validators.min(0)]],
    paymentMethod: ['Efectivo / Transferencia'],
    advance: [0, [Validators.min(0)]],
    notes: [''],
    considerations: ['Los precios pueden variar según disponibilidad de repuestos.'],
    items: this.fb.array<FormGroup>([]),
  });

  get items(): FormArray<FormGroup> { return this.form.get('items') as FormArray<FormGroup>; }

  ngOnInit(): void {
    if (!this.auth.isMechanic()) { this.router.navigate(['/denied']); return; }

    this.clients.list().subscribe((c) => (this.clientList = c.filter((x) => x.active)));

    this.form.controls.clientId.valueChanges.subscribe((clientId) => {
      this.vehicles.listByOwner(clientId ?? '').subscribe((v) => (this.vehicleList = v));
    });

    const qpVehicle = this.route.snapshot.queryParamMap.get('vehicleId');
    this.editId = this.route.snapshot.paramMap.get('id');

    if (this.editId) {
      this.loading = true;
      this.quotations.getById(this.editId).subscribe((q) => {
        if (q && !this.items.length) { this.loadQuotation(q); }
        this.loading = false;
      });
    } else if (qpVehicle) {
      this.vehicles.getById(qpVehicle).subscribe((v) => {
        if (v) {
          this.form.patchValue({ clientId: v.ownerId, mileage: v.mileage });
          setTimeout(() => this.form.patchValue({ vehicleId: v.id }));
        }
      });
    }
  }

  private loadQuotation(q: Quotation): void {
    this.form.patchValue({
      clientId: q.clientId, vehicleId: q.vehicleId, date: new Date(q.date),
      validityDays: q.validityDays, mileage: q.mileage, paymentMethod: q.paymentMethod,
      advance: q.advance, notes: q.notes, considerations: q.considerations,
    });
    setTimeout(() => this.form.patchValue({ vehicleId: q.vehicleId }));
    q.items.forEach((it) => this.items.push(this.buildItem(it)));
  }

  private buildItem(data?: Partial<QuotationItem>): FormGroup {
    return this.fb.group({
      id: [data?.id ?? uuid()],
      type: [data?.type ?? 'part', Validators.required],
      code: [data?.code ?? ''],
      name: [data?.name ?? '', Validators.required],
      quantity: [data?.quantity ?? 1, [Validators.required, Validators.min(0.01)]],
      unitCost: [data?.unitCost ?? 0, [Validators.min(0)]],
      unitPrice: [data?.unitPrice ?? 0, [Validators.required, Validators.min(0)]],
      discount: [data?.discount ?? 0, [Validators.min(0)]],
      note: [data?.note ?? ''],
    });
  }

  addManualItem(): void { this.items.push(this.buildItem()); }

  addFromCatalog(part: PartCatalogItem): void {
    const type = part.type === 'lubricant' ? 'material'
      : part.type === 'labor' ? 'labor'
      : part.type === 'other' ? 'other' : 'part';
    this.items.push(this.buildItem({
      type: type as QuotationItem['type'], code: part.code, name: part.name,
      unitCost: type === 'labor' ? 0 : part.suggestedCost,
      unitPrice: part.suggestedPrice, quantity: 1, discount: 0,
    }));
    this.searchResults = [];
  }

  onSearch(term: string): void {
    this.searchResults = term && term.length >= 1 ? this.catalog.search(term) : [];
  }

  duplicateItem(index: number): void {
    const v = this.items.at(index).getRawValue() as QuotationItem;
    this.items.insert(index + 1, this.buildItem({ ...v, id: uuid() }));
  }
  removeItem(index: number): void { this.items.removeAt(index); }
  drop(event: CdkDragDrop<unknown>): void {
    moveItemInArray(this.items.controls, event.previousIndex, event.currentIndex);
    this.items.updateValueAndValidity();
  }

  /** La mano de obra no tiene costo base: se oculta la casilla para no confundir. */
  isLabor(group: FormGroup): boolean {
    return group.get('type')?.value === 'labor';
  }

  lineSubtotal(group: FormGroup): number {
    return computeItemSubtotal({
      quantity: group.get('quantity')?.value ?? 0,
      unitPrice: group.get('unitPrice')?.value ?? 0,
      discount: group.get('discount')?.value ?? 0,
    });
  }

  lineCost(group: FormGroup): number {
    return computeItemCost({
      quantity: group.get('quantity')?.value ?? 0,
      unitCost: group.get('unitCost')?.value ?? 0,
      type: group.get('type')?.value ?? 'part',
    });
  }

  /** Ganancia de la línea, para que el mecánico la vea mientras cotiza. */
  lineProfit(group: FormGroup): number {
    return Math.round((this.lineSubtotal(group) - this.lineCost(group)) * 100) / 100;
  }

  get totals() {
    return computeQuotationTotals(this.buildItemsPayload(), this.form.controls.advance.value ?? 0);
  }

  /** Margen sobre la venta, en porcentaje. */
  get marginPct(): number {
    const t = this.totals;
    if (!t.subtotal) { return 0; }
    return Math.round((t.profit / t.subtotal) * 1000) / 10;
  }

  private buildItemsPayload(): QuotationItem[] {
    return this.items.controls.map((g) => {
      const v = g.getRawValue() as QuotationItem;
      const unitCost = v.type === 'labor' ? 0 : v.unitCost;
      return {
        ...v, unitCost,
        subtotal: computeItemSubtotal(v),
        costSubtotal: computeItemCost({ ...v, unitCost }),
      };
    });
  }

  save(status: 'draft' | 'sent'): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); this.notify.error('Revisa los campos del formulario.'); return; }
    if (this.items.length === 0) { this.notify.error('Agrega al menos un artículo a la cotización.'); return; }
    if (this.saving) { return; }

    this.saving = true;
    const v = this.form.getRawValue();
    const base = {
      clientId: v.clientId!, vehicleId: v.vehicleId!, date: (v.date as Date).toISOString(),
      validityDays: v.validityDays!, mileage: v.mileage!, paymentMethod: v.paymentMethod!,
      notes: v.notes!, considerations: v.considerations!,
      items: this.buildItemsPayload(), status,
    };

    if (this.editId) {
      this.quotations.update(this.editId, { ...base, advance: v.advance ?? 0 }).subscribe({
        next: (q) => this.done(q.id, 'Cotización actualizada.'),
        error: (e: Error) => this.fail(e),
      });
    } else {
      this.quotations.create({ ...base, advance: v.advance ?? 0 } as Parameters<QuotationService['create']>[0]).subscribe({
        next: (q) => this.done(q.id, 'Cotización creada.'),
        error: (e: Error) => this.fail(e),
      });
    }
  }

  private done(id: string, msg: string): void {
    this.saving = false; this.notify.success(msg); this.router.navigate(['/app/quotations', id]);
  }
  private fail(e: Error): void { this.saving = false; this.notify.error(e.message || 'No se pudo guardar.'); }

  cancel(): void { this.router.navigate(['/app/quotations']); }
  get title(): string { return this.editId ? 'Editar cotización' : 'Nueva cotización'; }
}
