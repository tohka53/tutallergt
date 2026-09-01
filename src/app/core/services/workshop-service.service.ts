import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, from, of, throwError } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  Quotation, ServiceStatus, ServiceStatusHistory, WorkshopService, WorkshopServiceItem,
} from '../../models';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { ServicePhotoService } from './service-photo.service';
import { VehicleService } from './vehicle.service';
import { computeItemSubtotal, computeItemCost, round2 } from './quotation.service';
import { fromService, toService } from './mappers';
import { uuid } from './id.util';

export const SERVICE_STATUS_LABELS: Record<ServiceStatus, string> = {
  'received': 'Recibido',
  'diagnosis': 'En diagnóstico',
  'pending-auth': 'Pendiente de autorización',
  'waiting-part': 'Esperando repuesto',
  'repairing': 'En reparación',
  'testing': 'En prueba',
  'done': 'Terminado',
  'delivered': 'Entregado',
  'cancelled': 'Cancelado',
};

export function computeServiceTotal(items: WorkshopServiceItem[]): number {
  return round2(items.reduce((sum, it) => sum + computeItemSubtotal(it), 0));
}

export function computeServiceCost(items: WorkshopServiceItem[]): number {
  return round2(items.reduce((sum, it) => sum + computeItemCost(it), 0));
}

type NewService = Omit<
  WorkshopService,
  'id' | 'number' | 'createdAt' | 'updatedAt' | 'total' | 'costTotal' | 'statusHistory'
>;

@Injectable({ providedIn: 'root' })
export class WorkshopServiceService {
  private sb = inject(SupabaseService);
  private auth = inject(AuthService);
  private photos = inject(ServicePhotoService);
  private vehicles = inject(VehicleService);

  private subject = new BehaviorSubject<WorkshopService[]>([]);
  readonly services$ = this.subject.asObservable();

  get snapshot(): WorkshopService[] { return this.subject.value; }
  setAll(items: WorkshopService[]): void { this.subject.next(items); }
  clear(): void { this.subject.next([]); }

  async reload(): Promise<void> {
    const { data, error } = await this.sb.db
      .from('servicios')
      .select('*')
      .order('fecha_creacion', { ascending: false });
    if (error) { throw new Error(this.sb.mensaje(error)); }
    this.subject.next((data ?? []).map(toService));
  }

  list(): Observable<WorkshopService[]> { return of([...this.subject.value]); }
  listByClient(clientId: string): Observable<WorkshopService[]> {
    return this.services$.pipe(map((l) => l.filter((s) => s.clientId === clientId)));
  }
  listByVehicle(vehicleId: string): Observable<WorkshopService[]> {
    return this.services$.pipe(map((l) => l.filter((s) => s.vehicleId === vehicleId)));
  }
  getById(id: string): Observable<WorkshopService | undefined> {
    return this.services$.pipe(map((l) => l.find((s) => s.id === id)));
  }

  private async nextNumber(): Promise<string> {
    const { data, error } = await this.sb.db.rpc('siguiente_correlativo', { p_tipo: 'servicio' });
    if (error) { throw new Error(this.sb.mensaje(error)); }
    return 'ORD-' + String(data ?? 1).padStart(4, '0');
  }

  create(data: NewService): Observable<WorkshopService> {
    return from(this.createAsync(data));
  }

  private async createAsync(data: NewService): Promise<WorkshopService> {
    const mecanicoId = this.auth.mechanicId;
    if (!mecanicoId) { throw new Error('Sólo el mecánico puede crear servicios.'); }

    const now = new Date().toISOString();
    const user = this.auth.currentUser;
    const numero = await this.nextNumber();
    const vehicle = this.vehicles.snapshot.find((v) => v.id === data.vehicleId);
    const items = data.items.map((it) => ({
      ...it,
      unitCost: it.type === 'labor' ? 0 : it.unitCost,
      subtotal: computeItemSubtotal(it),
      costSubtotal: computeItemCost(it),
    }));

    const history: ServiceStatusHistory[] = [{
      id: uuid(),
      fromStatus: null,
      toStatus: data.status,
      changedAt: now,
      userId: user?.id ?? 'system',
      userName: user?.displayName ?? 'Sistema',
      comment: 'Servicio creado',
    }];

    const row = fromService(
      { ...data, items, number: numero, total: computeServiceTotal(items),
        costTotal: computeServiceCost(items), statusHistory: history },
      vehicle?.plate ?? 'SIN-PLACA',
      data.reason?.slice(0, 80) || 'Servicio ' + numero
    );

    const { data: created, error } = await this.sb.db
      .from('servicios')
      .insert({ ...row, mecanico_id: mecanicoId })
      .select()
      .single();
    if (error || !created) { throw new Error(this.sb.mensaje(error)); }

    await this.reload();
    return toService(created);
  }

  /** Crea un servicio a partir de una cotización (conversión). */
  createFromQuotation(
    quotation: Quotation,
    items: WorkshopServiceItem[],
    extra: Partial<WorkshopService>
  ): Observable<WorkshopService> {
    if (quotation.status === 'converted' || quotation.convertedServiceId) {
      return throwError(() => new Error('Esta cotización ya fue convertida en servicio.'));
    }
    return this.create({
      clientId: quotation.clientId,
      vehicleId: quotation.vehicleId,
      quotationId: quotation.id,
      entryDate: new Date().toISOString(),
      entryMileage: quotation.mileage,
      reason: extra.reason ?? 'Trabajos autorizados de la cotización ' + quotation.number,
      diagnosis: extra.diagnosis ?? '',
      requestedWork: extra.requestedWork ?? '',
      performedWork: '',
      internalNotes: '',
      clientVisibleNotes: '',
      items,
      mechanicName: this.auth.currentUser?.displayName ?? 'Mecánico',
      status: 'received',
      estimatedDelivery: extra.estimatedDelivery,
      fuelLevel: extra.fuelLevel,
    });
  }

  update(id: string, changes: Partial<WorkshopService>): Observable<WorkshopService> {
    return from(this.updateAsync(id, changes));
  }

  private async updateAsync(id: string, changes: Partial<WorkshopService>): Promise<WorkshopService> {
    const current = this.subject.value.find((s) => s.id === id);
    if (!current) { throw new Error('Servicio no encontrado.'); }

    const merged = { ...current, ...changes };
    const items = merged.items.map((it) => ({
      ...it,
      unitCost: it.type === 'labor' ? 0 : it.unitCost,
      subtotal: computeItemSubtotal(it),
      costSubtotal: computeItemCost(it),
    }));
    const vehicle = this.vehicles.snapshot.find((v) => v.id === merged.vehicleId);

    const row = fromService(
      { ...merged, items, total: computeServiceTotal(items), costTotal: computeServiceCost(items) },
      vehicle?.plate,
      merged.reason?.slice(0, 80) || 'Servicio ' + merged.number
    );
    delete row['numero'];

    const { error } = await this.sb.db.from('servicios').update(row).eq('id', id);
    if (error) { throw new Error(this.sb.mensaje(error)); }

    await this.reload();
    return this.subject.value.find((s) => s.id === id) as WorkshopService;
  }

  changeStatus(id: string, toStatus: ServiceStatus, comment: string): Observable<WorkshopService> {
    const svc = this.subject.value.find((s) => s.id === id);
    if (!svc) { return throwError(() => new Error('Servicio no encontrado.')); }
    const user = this.auth.currentUser;
    const entry: ServiceStatusHistory = {
      id: uuid(),
      fromStatus: svc.status,
      toStatus,
      changedAt: new Date().toISOString(),
      userId: user?.id ?? 'system',
      userName: user?.displayName ?? 'Sistema',
      comment: comment || SERVICE_STATUS_LABELS[toStatus],
    };
    const changes: Partial<WorkshopService> = {
      status: toStatus,
      statusHistory: [...svc.statusHistory, entry],
    };
    if (toStatus === 'delivered' && !svc.actualDelivery) {
      changes.actualDelivery = new Date().toISOString();
    }
    return this.update(id, changes);
  }

  delete(id: string): Observable<void> {
    return from(
      (async () => {
        // Primero los archivos: si se borra la fila, las fotos quedan
        // ocupando espacio en el bucket y ya nadie sabe a qué servicio eran.
        await this.photos.removeForService(id);
        const { error } = await this.sb.db.from('servicios').delete().eq('id', id);
        if (error) { throw new Error(this.sb.mensaje(error)); }
        await this.reload();
      })()
    );
  }
}
