import { Component, OnInit, inject } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ClientService } from '../../core/services/client.service';
import { VehicleService } from '../../core/services/vehicle.service';
import { PartsCatalogService } from '../../core/services/parts-catalog.service';
import { WorkshopServiceService, computeServiceTotal } from '../../core/services/workshop-service.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { Client, PartCatalogItem, ServiceStatus, Vehicle, WorkshopService, WorkshopServiceItem } from '../../models';
import { computeItemSubtotal } from '../../core/services/quotation.service';
import { SERVICE_STATUS_LABELS } from '../../shared/status.util';
import { uuid } from '../../core/services/id.util';

@Component({
  selector: 'app-service-form',
  standalone: false,
  templateUrl: './service-form.component.html',
  styleUrls: ['./service-form.component.scss'],
})
export class ServiceFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private clients = inject(ClientService);
  private vehicles = inject(VehicleService);
  private catalog = inject(PartsCatalogService);
  private services = inject(WorkshopServiceService);
  private auth = inject(AuthService);
  private notify = inject(NotificationService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  editId: string | null = null;
  saving = false;
  loading = false;
  clientList: Client[] = [];
  vehicleList: Vehicle[] = [];
  searchResults: PartCatalogItem[] = [];
  statusLabels = SERVICE_STATUS_LABELS;
  statuses: ServiceStatus[] = ['received', 'diagnosis', 'pending-auth', 'waiting-part', 'repairing', 'testing', 'done', 'delivered', 'cancelled'];
  itemTypes = [
    { value: 'part', label: 'Repuesto' }, { value: 'material', label: 'Material' },
    { value: 'labor', label: 'Mano de obra' }, { value: 'other', label: 'Otro' },
  ];

  form = this.fb.group({
    clientId: ['', Validators.required],
    vehicleId: ['', Validators.required],
    entryDate: [new Date(), Validators.required],
    estimatedDelivery: [null as Date | null],
    entryMileage: [0, [Validators.min(0)]],
    fuelLevel: ['1/2'],
    reason: ['', Validators.required],
    diagnosis: [''],
    requestedWork: [''],
    performedWork: [''],
    internalNotes: [''],
    clientVisibleNotes: [''],
    mechanicName: [this.auth.currentUser?.displayName ?? '', Validators.required],
    status: ['received' as ServiceStatus, Validators.required],
    items: this.fb.array<FormGroup>([]),
  });

  get items(): FormArray<FormGroup> { return this.form.get('items') as FormArray<FormGroup>; }

  ngOnInit(): void {
    if (!this.auth.isMechanic()) { this.router.navigate(['/denied']); return; }
    this.clients.list().subscribe((c) => (this.clientList = c.filter((x) => x.active)));
    this.form.controls.clientId.valueChanges.subscribe((id) => {
      this.vehicles.listByOwner(id ?? '').subscribe((v) => (this.vehicleList = v));
    });

    this.editId = this.route.snapshot.paramMap.get('id');
    if (this.editId) {
      this.loading = true;
      this.services.getById(this.editId).subscribe((s) => {
        if (s) { this.loadService(s); }
        this.loading = false;
      });
    }
  }

  private loadService(s: WorkshopService): void {
    this.form.patchValue({
      clientId: s.clientId, vehicleId: s.vehicleId, entryDate: new Date(s.entryDate),
      estimatedDelivery: s.estimatedDelivery ? new Date(s.estimatedDelivery) : null,
      entryMileage: s.entryMileage, fuelLevel: s.fuelLevel ?? '',
      reason: s.reason, diagnosis: s.diagnosis, requestedWork: s.requestedWork,
      performedWork: s.performedWork, internalNotes: s.internalNotes, clientVisibleNotes: s.clientVisibleNotes,
      mechanicName: s.mechanicName, status: s.status,
    });
    setTimeout(() => this.form.patchValue({ vehicleId: s.vehicleId }));
    s.items.forEach((it) => this.items.push(this.buildItem(it)));
  }

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

  addManualItem(): void { this.items.push(this.buildItem()); }
  addFromCatalog(part: PartCatalogItem): void {
    const type = part.type === 'lubricant' ? 'material' : part.type === 'labor' ? 'labor' : part.type === 'other' ? 'other' : 'part';
    this.items.push(this.buildItem({ type: type as WorkshopServiceItem['type'], code: part.code, name: part.name, unitPrice: part.suggestedPrice }));
    this.searchResults = [];
  }
  onSearch(term: string): void { this.searchResults = term ? this.catalog.search(term) : []; }
  removeItem(i: number): void { this.items.removeAt(i); }

  lineSubtotal(g: FormGroup): number {
    return computeItemSubtotal({ quantity: g.get('quantity')?.value ?? 0, unitPrice: g.get('unitPrice')?.value ?? 0, discount: g.get('discount')?.value ?? 0 });
  }
  get total(): number { return computeServiceTotal(this.buildItems()); }

  private buildItems(): WorkshopServiceItem[] {
    return this.items.controls.map((g) => {
      const v = g.getRawValue() as WorkshopServiceItem;
      return { ...v, subtotal: computeItemSubtotal(v) };
    });
  }

  save(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); this.notify.error('Revisa los campos.'); return; }
    if (this.saving) { return; }
    this.saving = true;
    const v = this.form.getRawValue();
    const base = {
      clientId: v.clientId!, vehicleId: v.vehicleId!,
      entryDate: (v.entryDate as Date).toISOString(),
      estimatedDelivery: v.estimatedDelivery ? (v.estimatedDelivery as Date).toISOString() : undefined,
      entryMileage: v.entryMileage!, fuelLevel: v.fuelLevel ?? '',
      reason: v.reason!, diagnosis: v.diagnosis ?? '', requestedWork: v.requestedWork ?? '',
      performedWork: v.performedWork ?? '', internalNotes: v.internalNotes ?? '', clientVisibleNotes: v.clientVisibleNotes ?? '',
      mechanicName: v.mechanicName!, status: v.status!, items: this.buildItems(),
    };

    if (this.editId) {
      this.services.update(this.editId, base).subscribe({
        next: (s) => this.done(s.id, 'Servicio actualizado.'),
        error: () => this.fail(),
      });
    } else {
      this.services.create(base).subscribe({
        next: (s) => this.done(s.id, 'Servicio creado.'),
        error: () => this.fail(),
      });
    }
  }
  private done(id: string, msg: string): void { this.saving = false; this.notify.success(msg); this.router.navigate(['/app/services', id]); }
  private fail(): void { this.saving = false; this.notify.error('No se pudo guardar el servicio.'); }
  cancel(): void { this.router.navigate(['/app/services']); }
  get title(): string { return this.editId ? 'Editar servicio' : 'Nuevo servicio'; }
}
