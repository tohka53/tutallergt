import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { ClientService } from './client.service';
import { VehicleService } from './vehicle.service';
import { PartsCatalogService } from './parts-catalog.service';
import { QuotationService } from './quotation.service';
import { WorkshopServiceService } from './workshop-service.service';
import { ServicePhotoService } from './service-photo.service';
import { VehicleDocumentService } from './vehicle-document.service';
import { WorkshopSettingsService } from './workshop-settings.service';
import { toPortalQuotation, toService, toVehicle } from './mappers';
import { ServicePhoto } from '../../models';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Trae de Supabase todo lo que la app necesita y lo deja en memoria.
 *
 * Se carga todo de una vez a propósito: un taller maneja cientos de registros,
 * no millones, y tenerlos en memoria permite que las pantallas sigan leyendo
 * de forma síncrona (buscar, filtrar, calcular métricas) sin una consulta por
 * cada tecla. Después de cada escritura, el servicio correspondiente vuelve a
 * leer su tabla, así que lo que se ve siempre viene del servidor.
 */
@Injectable({ providedIn: 'root' })
export class DataSyncService {
  private sb = inject(SupabaseService);
  private auth = inject(AuthService);
  private clients = inject(ClientService);
  private vehicles = inject(VehicleService);
  private catalog = inject(PartsCatalogService);
  private quotations = inject(QuotationService);
  private services = inject(WorkshopServiceService);
  private photos = inject(ServicePhotoService);
  private documents = inject(VehicleDocumentService);
  private settings = inject(WorkshopSettingsService);

  private loadingSubject = new BehaviorSubject<boolean>(false);
  readonly loading$ = this.loadingSubject.asObservable();

  private errorSubject = new BehaviorSubject<string | null>(null);
  readonly error$ = this.errorSubject.asObservable();

  get lastError(): string | null { return this.errorSubject.value; }

  async loadForCurrentUser(): Promise<void> {
    if (!this.auth.isAuthenticated) { this.clearAll(); return; }
    this.loadingSubject.next(true);
    this.errorSubject.next(null);
    try {
      if (this.auth.isMechanic()) {
        await this.loadMechanic();
      } else {
        await this.loadPortal();
      }
    } catch (e) {
      this.errorSubject.next((e as Error).message ?? 'No se pudieron cargar los datos.');
    } finally {
      this.loadingSubject.next(false);
    }
  }

  private async loadMechanic(): Promise<void> {
    await this.settings.reload();
    await Promise.all([
      this.clients.reload(),
      this.vehicles.reload(),
      this.catalog.reload(),
      this.quotations.reload(),
      this.services.reload(),
      this.photos.reload(),
      this.documents.reload(),
    ]);
    // El catálogo base se copia una sola vez, la primera que entra el mecánico.
    await this.catalog.seedIfEmpty();
  }

  private async loadPortal(): Promise<void> {
    const phone = this.auth.portalPhone;
    const client = this.auth.portalClient;
    if (!phone || !client) { this.clearAll(); return; }

    const { data, error } = await this.sb.db.rpc('portal_datos', { p_telefono: phone });
    if (error) { throw new Error(this.sb.mensaje(error)); }
    const payload = (data ?? {}) as Record<string, any>;

    this.settings.applyPortalSettings(payload['taller']);
    this.clients.setAll([client]);
    this.vehicles.setAll(((payload['vehiculos'] as any[]) ?? []).map(toVehicle));
    this.quotations.setAll(((payload['cotizaciones'] as any[]) ?? []).map(toPortalQuotation));

    const servicios = (payload['servicios'] as any[]) ?? [];
    this.services.setAll(servicios.map(toService));

    // Las fotos vienen anidadas dentro de cada servicio.
    const fotos: ServicePhoto[] = [];
    for (const s of servicios) {
      for (const f of (s['fotos'] as any[]) ?? []) {
        fotos.push({
          id: String(f['id']),
          serviceId: String(s['id']),
          caption: String(f['nota'] ?? ''),
          fileName: '',
          size: 0,
          path: String(f['ruta']),
          url: this.photos.publicUrl(String(f['ruta'])),
          uploadedAt: new Date().toISOString(),
        });
      }
    }
    this.photos.setAll(fotos);
    this.catalog.clear();
    this.documents.clear();
  }

  clearAll(): void {
    this.clients.clear();
    this.vehicles.clear();
    this.catalog.clear();
    this.quotations.clear();
    this.services.clear();
    this.photos.clear();
    this.documents.clear();
    this.settings.clear();
    this.errorSubject.next(null);
  }
}
