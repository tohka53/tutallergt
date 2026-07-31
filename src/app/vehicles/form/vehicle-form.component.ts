import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { VehicleService } from '../../core/services/vehicle.service';
import { ClientService } from '../../core/services/client.service';
import { AuthService } from '../../core/services/auth.service';
import { AuthorizationService } from '../../core/services/authorization.service';
import { NotificationService } from '../../core/services/notification.service';
import { Client, Vehicle, VehicleBrand, VehicleModel } from '../../models';
import { OTHER_BRAND_ID } from '../../core/services/catalog.data';
import { basePath } from '../vehicle-nav.util';

@Component({
  selector: 'app-vehicle-form',
  standalone: false,
  templateUrl: './vehicle-form.component.html',
})
export class VehicleFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private vehicles = inject(VehicleService);
  private clients = inject(ClientService);
  private auth = inject(AuthService);
  private authz = inject(AuthorizationService);
  private notify = inject(NotificationService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  editId: string | null = null;
  saving = false;
  loading = false;
  base = basePath(this.auth);
  isMechanic = this.auth.isMechanic();
  currentYear = new Date().getFullYear();

  brands: VehicleBrand[] = this.vehicles.getBrands();
  models: VehicleModel[] = [];
  clientList: Client[] = [];
  readonly OTHER = OTHER_BRAND_ID;
  vehicleTypes = ['Sedán', 'SUV', 'Pickup', 'Hatchback', 'Camión', 'Microbús', 'Motocicleta', 'Otro'];
  fuelTypes = ['Gasolina', 'Diésel', 'Híbrido', 'Eléctrico', 'GLP'];
  transmissions = ['Manual', 'Automática', 'CVT'];

  form = this.fb.nonNullable.group({
    ownerId: ['', Validators.required],
    plate: ['', Validators.required],
    vin: [''],
    brandSelect: ['', Validators.required],
    customBrand: [''],
    modelSelect: ['', Validators.required],
    customModel: [''],
    year: [this.currentYear, [Validators.required, Validators.min(1950), Validators.max(this.currentYear + 1)]],
    color: [''],
    type: ['Sedán'],
    engineSize: [''],
    fuelType: ['Gasolina'],
    transmission: ['Automática'],
    mileage: [0, [Validators.min(0)]],
    origin: ['agency' as 'agency' | 'imported'],
    originCountry: [''],
    engineNumber: [''],
    notes: [''],
    active: [true],
  });

  ngOnInit(): void {
    if (this.isMechanic) {
      this.clients.list().subscribe((c) => (this.clientList = c.filter((x) => x.active)));
    } else {
      const clientId = this.authz.currentClientId() ?? '';
      this.form.patchValue({ ownerId: clientId });
      this.form.controls.ownerId.disable();
    }

    // preseleccionar propietario si viene por query (?ownerId=)
    const qpOwner = this.route.snapshot.queryParamMap.get('ownerId');
    if (qpOwner && this.isMechanic) { this.form.patchValue({ ownerId: qpOwner }); }

    this.editId = this.route.snapshot.paramMap.get('id');
    if (this.editId) {
      this.loading = true;
      this.vehicles.getById(this.editId).subscribe((v) => {
        if (v) { this.loadVehicle(v); }
        this.loading = false;
      });
    }
  }

  private loadVehicle(v: Vehicle): void {
    const brand = this.brands.find((b) => b.name.toLowerCase() === v.brand.toLowerCase());
    const brandSelect = brand ? brand.id : this.OTHER;
    this.models = brand ? this.vehicles.getModels(brand.id) : [];
    const model = this.models.find((m) => m.name.toLowerCase() === v.model.toLowerCase());
    const modelSelect = model ? model.id : (brand ? 'other-model' : 'other-model');

    this.form.patchValue({
      ownerId: v.ownerId, plate: v.plate, vin: v.vin,
      brandSelect, customBrand: brand ? '' : v.brand,
      modelSelect, customModel: model ? '' : v.model,
      year: v.year, color: v.color, type: v.type, engineSize: v.engineSize,
      fuelType: v.fuelType, transmission: v.transmission, mileage: v.mileage,
      origin: v.origin, originCountry: v.originCountry ?? '', engineNumber: v.engineNumber ?? '',
      notes: v.notes, active: v.active,
    });
  }

  onBrandChange(): void {
    const id = this.form.controls.brandSelect.value;
    this.models = id === this.OTHER ? [] : this.vehicles.getModels(id);
    this.form.patchValue({ modelSelect: '', customModel: '' });
  }

  get isOtherBrand(): boolean { return this.form.controls.brandSelect.value === this.OTHER; }
  get isOtherModel(): boolean {
    return this.isOtherBrand || this.form.controls.modelSelect.value === 'other-model';
  }
  get title(): string { return this.editId ? 'Editar vehículo' : 'Nuevo vehículo'; }

  private resolveBrand(): string {
    if (this.isOtherBrand) { return this.form.controls.customBrand.value.trim(); }
    return this.brands.find((b) => b.id === this.form.controls.brandSelect.value)?.name ?? '';
  }
  private resolveModel(): string {
    if (this.isOtherModel) { return this.form.controls.customModel.value.trim(); }
    return this.models.find((m) => m.id === this.form.controls.modelSelect.value)?.name ?? '';
  }

  save(): void {
    if (this.form.invalid || this.saving) { this.form.markAllAsTouched(); return; }
    const brand = this.resolveBrand();
    const model = this.resolveModel();
    if (!brand) { this.notify.error('La marca es obligatoria.'); return; }
    if (!model) { this.notify.error('El modelo o línea es obligatorio.'); return; }

    this.saving = true;
    const v = this.form.getRawValue();
    const payload: Omit<Vehicle, 'id' | 'createdAt'> = {
      ownerId: v.ownerId, plate: v.plate.trim().toUpperCase(), vin: v.vin, brand, model,
      year: v.year, color: v.color, type: v.type, engineSize: v.engineSize, fuelType: v.fuelType,
      transmission: v.transmission, mileage: v.mileage, origin: v.origin,
      originCountry: v.origin === 'imported' ? v.originCountry : undefined,
      engineNumber: v.engineNumber, notes: v.notes, active: v.active,
    };

    const obs = this.editId ? this.vehicles.update(this.editId, payload) : this.vehicles.create(payload);
    obs.subscribe({
      next: (saved) => {
        this.saving = false;
        this.notify.success(this.editId ? 'Vehículo actualizado.' : 'Vehículo creado.');
        this.router.navigate([this.base, 'vehicles', saved.id]);
      },
      error: (err: Error) => { this.saving = false; this.notify.error(err.message || 'No se pudo guardar.'); },
    });
  }

  cancel(): void { this.router.navigate([this.base, 'vehicles']); }
}
