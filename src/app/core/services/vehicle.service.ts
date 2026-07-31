import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { delay, map } from 'rxjs/operators';
import { Vehicle, VehicleBrand, VehicleModel } from '../../models';
import { StorageService } from './storage.service';
import { uuid } from './id.util';
import { VEHICLE_BRANDS, VEHICLE_MODELS } from './catalog.data';

@Injectable({ providedIn: 'root' })
export class VehicleService {
  private storage = inject(StorageService);
  private readonly key = 'vehicles';
  private subject = new BehaviorSubject<Vehicle[]>(this.storage.get<Vehicle[]>(this.key, []));
  readonly vehicles$ = this.subject.asObservable();

  private persist(items: Vehicle[]): void {
    this.storage.set(this.key, items);
    this.subject.next(items);
  }

  list(): Observable<Vehicle[]> {
    return of([...this.subject.value]).pipe(delay(150));
  }

  listByOwner(ownerId: string): Observable<Vehicle[]> {
    return this.vehicles$.pipe(map((list) => list.filter((v) => v.ownerId === ownerId)));
  }

  getById(id: string): Observable<Vehicle | undefined> {
    return of(this.subject.value.find((v) => v.id === id)).pipe(delay(100));
  }

  search(term: string): Observable<Vehicle[]> {
    const t = term.trim().toLowerCase();
    return this.vehicles$.pipe(
      map((list) =>
        !t
          ? list
          : list.filter((v) =>
              [v.plate, v.brand, v.model, v.vin, v.color].join(' ').toLowerCase().includes(t)
            )
      )
    );
  }

  private plateExists(plate: string, exceptId?: string): boolean {
    const p = plate.trim().toUpperCase();
    return this.subject.value.some((v) => v.plate.toUpperCase() === p && v.id !== exceptId);
  }

  create(data: Omit<Vehicle, 'id' | 'createdAt'>): Observable<Vehicle> {
    if (this.plateExists(data.plate)) {
      return throwError(() => new Error('Ya existe un vehículo con esa placa.'));
    }
    const vehicle: Vehicle = { ...data, id: uuid(), createdAt: new Date().toISOString() };
    this.persist([...this.subject.value, vehicle]);
    return of(vehicle).pipe(delay(150));
  }

  update(id: string, changes: Partial<Vehicle>): Observable<Vehicle> {
    if (changes.plate && this.plateExists(changes.plate, id)) {
      return throwError(() => new Error('Ya existe un vehículo con esa placa.'));
    }
    const items = this.subject.value.map((v) => (v.id === id ? { ...v, ...changes, id } : v));
    this.persist(items);
    return of(items.find((v) => v.id === id) as Vehicle).pipe(delay(150));
  }

  /** Eliminación física. La autorización (sólo mecánico) se valida antes de llamar. */
  delete(id: string): Observable<void> {
    this.persist(this.subject.value.filter((v) => v.id !== id));
    return of(void 0).pipe(delay(120));
  }

  getBrands(): VehicleBrand[] {
    return VEHICLE_BRANDS;
  }
  getModels(brandId: string): VehicleModel[] {
    return VEHICLE_MODELS.filter((m) => m.brandId === brandId);
  }
}
