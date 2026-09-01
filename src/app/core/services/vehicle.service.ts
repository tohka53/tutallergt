import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, from, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { Vehicle, VehicleBrand, VehicleModel } from '../../models';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { ClientService } from './client.service';
import { fromVehicle, toVehicle } from './mappers';
import { VEHICLE_BRANDS, VEHICLE_MODELS } from './catalog.data';

@Injectable({ providedIn: 'root' })
export class VehicleService {
  private sb = inject(SupabaseService);
  private auth = inject(AuthService);
  private clients = inject(ClientService);

  private subject = new BehaviorSubject<Vehicle[]>([]);
  readonly vehicles$ = this.subject.asObservable();

  get snapshot(): Vehicle[] { return this.subject.value; }
  setAll(items: Vehicle[]): void { this.subject.next(items); }
  clear(): void { this.subject.next([]); }

  async reload(): Promise<void> {
    const { data, error } = await this.sb.db
      .from('vehiculos')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) { throw new Error(this.sb.mensaje(error)); }
    this.subject.next((data ?? []).map(toVehicle));
  }

  list(): Observable<Vehicle[]> { return of([...this.subject.value]); }

  listByOwner(ownerId: string): Observable<Vehicle[]> {
    return this.vehicles$.pipe(map((list) => list.filter((v) => v.ownerId === ownerId)));
  }

  getById(id: string): Observable<Vehicle | undefined> {
    return this.vehicles$.pipe(map((l) => l.find((v) => v.id === id)));
  }

  search(term: string): Observable<Vehicle[]> {
    const t = term.trim().toLowerCase();
    return this.vehicles$.pipe(
      map((list) =>
        !t
          ? list
          : list.filter((v) =>
              [v.plate, v.brand, v.model, v.line, v.vin, v.color].join(' ').toLowerCase().includes(t)
            )
      )
    );
  }

  private plateExists(plate: string, exceptId?: string): boolean {
    const p = plate.trim().toUpperCase();
    return this.subject.value.some((v) => v.plate.toUpperCase() === p && v.id !== exceptId);
  }

  /** Nombre del dueño, que la tabla `vehiculos` guarda además del cliente_id. */
  private ownerName(ownerId: string): string {
    const c = this.clients.snapshot.find((x) => x.id === ownerId);
    return c ? `${c.firstName} ${c.lastName}`.trim() : 'Sin asignar';
  }

  create(data: Omit<Vehicle, 'id' | 'createdAt'>): Observable<Vehicle> {
    return from(this.createAsync(data));
  }

  private async createAsync(data: Omit<Vehicle, 'id' | 'createdAt'>): Promise<Vehicle> {
    const mecanicoId = this.auth.mechanicId;
    if (!mecanicoId) { throw new Error('Sólo el mecánico puede registrar vehículos.'); }
    if (this.plateExists(data.plate)) {
      throw new Error('Ya existe un vehículo con esa placa.');
    }

    const { data: row, error } = await this.sb.db
      .from('vehiculos')
      .insert({ ...fromVehicle(data, this.ownerName(data.ownerId)), mecanico_id: mecanicoId })
      .select()
      .single();
    if (error || !row) { throw new Error(this.sb.mensaje(error)); }

    await this.reload();
    return toVehicle(row);
  }

  update(id: string, changes: Partial<Vehicle>): Observable<Vehicle> {
    return from(this.updateAsync(id, changes));
  }

  private async updateAsync(id: string, changes: Partial<Vehicle>): Promise<Vehicle> {
    if (changes.plate && this.plateExists(changes.plate, id)) {
      throw new Error('Ya existe un vehículo con esa placa.');
    }
    const owner = changes.ownerId ? this.ownerName(changes.ownerId) : undefined;
    const { data: row, error } = await this.sb.db
      .from('vehiculos')
      .update(fromVehicle(changes, owner))
      .eq('id', id)
      .select()
      .single();
    if (error || !row) { throw new Error(this.sb.mensaje(error)); }

    await this.reload();
    return toVehicle(row);
  }

  /**
   * Borrado físico. La base rechaza el borrado si el vehículo tiene
   * cotizaciones o servicios (on delete restrict), y ese error se traduce a un
   * mensaje entendible.
   */
  delete(id: string): Observable<void> {
    return from(
      (async () => {
        const { error } = await this.sb.db.from('vehiculos').delete().eq('id', id);
        if (error) {
          if ((error as { code?: string }).code === '23503') {
            throw new Error(
              'Este vehículo tiene cotizaciones o servicios registrados y no se puede eliminar.'
            );
          }
          throw new Error(this.sb.mensaje(error));
        }
        await this.reload();
      })()
    );
  }

  getBrands(): VehicleBrand[] { return VEHICLE_BRANDS; }
  getModels(brandId: string): VehicleModel[] {
    return VEHICLE_MODELS.filter((m) => m.brandId === brandId);
  }
}
