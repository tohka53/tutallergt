import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, from, of, throwError } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { MAX_SERVICE_PHOTOS, ServicePhoto } from '../../models';
import { StorageService } from './storage.service';
import { IndexedDbService } from './indexed-db.service';
import { WorkshopSettingsService } from './workshop-settings.service';
import { AuthService } from './auth.service';
import { downscaleImage } from './image.util';
import { uuid } from './id.util';

/**
 * No se acepta HEIC/HEIF: Chrome y Firefox no saben dibujarlo, así que la foto
 * se guardaría pero el cliente vería un recuadro roto. iOS convierte a JPEG al
 * subir cuando "Formatos de cámara" está en "Más compatible" (el valor por
 * omisión), y el rechazo trae un mensaje que explica qué hacer.
 */
const ALLOWED_MIME = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

/** Extensiones que se ofrecen en el selector de archivos del sistema. */
export const SERVICE_PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp';

/**
 * Fotos de evidencia de los servicios. Los metadatos van a localStorage (via
 * StorageService) y el binario a IndexedDB, igual que VehicleDocumentService.
 *
 * PRODUCCIÓN: reemplazar IndexedDbService por Supabase/S3 y este servicio por
 * llamadas a la API. Los componentes sólo dependen de la interfaz pública.
 */
@Injectable({ providedIn: 'root' })
export class ServicePhotoService {
  private storage = inject(StorageService);
  private idb = inject(IndexedDbService);
  private settings = inject(WorkshopSettingsService);
  private auth = inject(AuthService);

  private readonly key = 'service-photos';
  private subject = new BehaviorSubject<ServicePhoto[]>(
    this.storage.get<ServicePhoto[]>(this.key, [])
  );

  readonly photos$ = this.subject.asObservable();
  readonly max = MAX_SERVICE_PHOTOS;

  private persist(items: ServicePhoto[]): void {
    this.storage.set(this.key, items);
    this.subject.next(items);
  }

  private forService(list: ServicePhoto[], serviceId: string): ServicePhoto[] {
    return list
      .filter((p) => p.serviceId === serviceId)
      .sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt));
  }

  /** Fotos de un servicio, en orden de carga. Se reemite en cada cambio. */
  listForService(serviceId: string): Observable<ServicePhoto[]> {
    return this.photos$.pipe(map((list) => this.forService(list, serviceId)));
  }

  /** Cuántas fotos tiene cada servicio, para pintar contadores en listados. */
  countsByService(): Observable<Record<string, number>> {
    return this.photos$.pipe(
      map((list) =>
        list.reduce<Record<string, number>>((acc, p) => {
          acc[p.serviceId] = (acc[p.serviceId] ?? 0) + 1;
          return acc;
        }, {})
      )
    );
  }

  countFor(serviceId: string): number {
    return this.subject.value.filter((p) => p.serviceId === serviceId).length;
  }

  /** Valida tipo MIME real, tamaño y cupo. Devuelve el error o null. */
  validate(serviceId: string, file: File): string | null {
    if (!ALLOWED_MIME.includes(file.type)) {
      return 'Formato no permitido. Use JPG, PNG o WEBP.';
    }
    const maxBytes = this.settings.current.maxUploadMb * 1024 * 1024;
    if (file.size > maxBytes) {
      return `La imagen supera el máximo de ${this.settings.current.maxUploadMb} MB.`;
    }
    if (this.countFor(serviceId) >= MAX_SERVICE_PHOTOS) {
      return `Máximo ${MAX_SERVICE_PHOTOS} fotos por servicio. Elimine una para subir otra.`;
    }
    return null;
  }

  /** Cuántas fotos más caben en este servicio. */
  remainingSlots(serviceId: string): number {
    return Math.max(0, MAX_SERVICE_PHOTOS - this.countFor(serviceId));
  }

  upload(serviceId: string, file: File, caption = ''): Observable<ServicePhoto> {
    const error = this.validate(serviceId, file);
    if (error) { return throwError(() => new Error(error)); }

    const user = this.auth.currentUser;
    const blobKey = 'svc-photo-' + uuid();

    // Se reduce antes de guardar; si falla, downscaleImage devuelve el original.
    return from(downscaleImage(file)).pipe(
      switchMap((optimized) =>
        from(this.idb.saveBlob(blobKey, optimized)).pipe(map(() => optimized))
      ),
      map((stored) => {
        const photo: ServicePhoto = {
          id: uuid(),
          serviceId,
          caption: caption.trim(),
          fileName: stored.name,
          mimeType: stored.type,
          size: stored.size,
          blobKey,
          uploadedAt: new Date().toISOString(),
          uploadedById: user?.id ?? 'system',
          uploadedByName: user?.displayName ?? 'Mecánico',
        };
        this.persist([...this.subject.value, photo]);
        return photo;
      })
    );
  }

  updateCaption(id: string, caption: string): Observable<void> {
    this.persist(
      this.subject.value.map((p) => (p.id === id ? { ...p, caption: caption.trim() } : p))
    );
    return of(void 0);
  }

  /** Devuelve un object URL. Quien lo pide DEBE liberarlo con revokeObjectURL. */
  getObjectUrl(photo: ServicePhoto): Observable<string> {
    return from(this.idb.getBlob(photo.blobKey)).pipe(
      map((blob) => {
        if (!blob) { throw new Error('Imagen no encontrada.'); }
        return URL.createObjectURL(blob);
      })
    );
  }

  remove(photo: ServicePhoto): Observable<void> {
    return from(this.idb.deleteBlob(photo.blobKey)).pipe(
      map(() => {
        this.persist(this.subject.value.filter((p) => p.id !== photo.id));
      })
    );
  }

  /** Se llama al eliminar un servicio, para no dejar blobs huérfanos. */
  removeForService(serviceId: string): Observable<void> {
    const doomed = this.subject.value.filter((p) => p.serviceId === serviceId);
    if (!doomed.length) { return of(void 0); }
    return from(Promise.all(doomed.map((p) => this.idb.deleteBlob(p.blobKey)))).pipe(
      map(() => {
        this.persist(this.subject.value.filter((p) => p.serviceId !== serviceId));
      })
    );
  }
}
