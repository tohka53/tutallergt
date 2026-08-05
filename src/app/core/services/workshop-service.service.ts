import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { delay, map } from 'rxjs/operators';
import {
  ServiceStatus, ServiceStatusHistory, WorkshopService, WorkshopServiceItem, Quotation,
} from '../../models';
import { StorageService } from './storage.service';
import { uuid } from './id.util';
import { AuthService } from './auth.service';
import { ServicePhotoService } from './service-photo.service';
import { computeItemSubtotal } from './quotation.service';

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
  return Math.round(items.reduce((sum, it) => sum + computeItemSubtotal(it), 0) * 100) / 100;
}

@Injectable({ providedIn: 'root' })
export class WorkshopServiceService {
  private storage = inject(StorageService);
  private auth = inject(AuthService);
  private photos = inject(ServicePhotoService);
  private readonly key = 'workshop-services';
  private readonly seqKey = 'service-seq';
  private subject = new BehaviorSubject<WorkshopService[]>(
    this.storage.get<WorkshopService[]>(this.key, [])
  );
  readonly services$ = this.subject.asObservable();

  private persist(items: WorkshopService[]): void {
    this.storage.set(this.key, items);
    this.subject.next(items);
  }

  nextNumber(): string {
    const current = this.storage.get<number>(this.seqKey, 0) + 1;
    this.storage.set(this.seqKey, current);
    return 'ORD-' + current.toString().padStart(4, '0');
  }

  list(): Observable<WorkshopService[]> {
    return of([...this.subject.value]).pipe(delay(150));
  }
  listByClient(clientId: string): Observable<WorkshopService[]> {
    return this.services$.pipe(map((l) => l.filter((s) => s.clientId === clientId)));
  }
  listByVehicle(vehicleId: string): Observable<WorkshopService[]> {
    return this.services$.pipe(map((l) => l.filter((s) => s.vehicleId === vehicleId)));
  }
  getById(id: string): Observable<WorkshopService | undefined> {
    return of(this.subject.value.find((s) => s.id === id)).pipe(delay(100));
  }

  create(
    data: Omit<WorkshopService, 'id' | 'number' | 'createdAt' | 'updatedAt' | 'total' | 'statusHistory'>
  ): Observable<WorkshopService> {
    const now = new Date().toISOString();
    const user = this.auth.currentUser;
    const service: WorkshopService = {
      ...data,
      id: uuid(),
      number: this.nextNumber(),
      total: computeServiceTotal(data.items),
      statusHistory: [
        {
          id: uuid(),
          fromStatus: null,
          toStatus: data.status,
          changedAt: now,
          userId: user?.id ?? 'system',
          userName: user?.displayName ?? 'Sistema',
          comment: 'Servicio creado',
        },
      ],
      createdAt: now,
      updatedAt: now,
    };
    this.persist([...this.subject.value, service]);
    return of(service).pipe(delay(150));
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
      quotationSnapshotTotal: quotation.total,
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
    const items = this.subject.value.map((s) => {
      if (s.id !== id) { return s; }
      const merged = { ...s, ...changes, id };
      return { ...merged, total: computeServiceTotal(merged.items), updatedAt: new Date().toISOString() };
    });
    this.persist(items);
    return of(items.find((s) => s.id === id) as WorkshopService).pipe(delay(150));
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
    return this.update(id, { status: toStatus, statusHistory: [...svc.statusHistory, entry] });
  }

  delete(id: string): Observable<void> {
    this.persist(this.subject.value.filter((s) => s.id !== id));
    // Los binarios de la evidencia viven en IndexedDB: si no se borran aquí
    // quedan huérfanos ocupando la cuota del navegador para siempre.
    return this.photos.removeForService(id).pipe(delay(120));
  }
}
