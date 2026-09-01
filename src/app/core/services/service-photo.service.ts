import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, from, of, throwError } from 'rxjs';
import { map } from 'rxjs/operators';
import { MAX_SERVICE_PHOTOS, ServicePhoto } from '../../models';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { WorkshopSettingsService } from './workshop-settings.service';
import { downscaleImage } from './image.util';
import { uuid } from './id.util';
import { toPhoto } from './mappers';
import { environment } from '../../../environments/environment';

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
 * Fotos de evidencia. Los metadatos van a la tabla `servicio_fotos` y el
 * archivo al bucket PÚBLICO "evidencias".
 *
 * Público a propósito: el cliente entra sin sesión, así que no puede firmar
 * una URL temporal. Las rutas llevan uuid, no son adivinables, y lo que
 * contienen son fotos de piezas de carro. La tarjeta de circulación, que sí es
 * un dato personal, va en un bucket privado aparte (ver VehicleDocumentService).
 */
@Injectable({ providedIn: 'root' })
export class ServicePhotoService {
  private sb = inject(SupabaseService);
  private auth = inject(AuthService);
  private settings = inject(WorkshopSettingsService);

  private readonly bucket = environment.bucketEvidencias;
  private subject = new BehaviorSubject<ServicePhoto[]>([]);

  readonly photos$ = this.subject.asObservable();
  readonly max = MAX_SERVICE_PHOTOS;

  get snapshot(): ServicePhoto[] { return this.subject.value; }
  setAll(items: ServicePhoto[]): void { this.subject.next(items); }
  clear(): void { this.subject.next([]); }

  publicUrl(path: string): string {
    if (!path) { return ''; }
    return this.sb.db.storage.from(this.bucket).getPublicUrl(path).data.publicUrl;
  }

  async reload(): Promise<void> {
    const { data, error } = await this.sb.db
      .from('servicio_fotos')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) { throw new Error(this.sb.mensaje(error)); }
    this.subject.next((data ?? []).map((r) => toPhoto(r, (p) => this.publicUrl(p))));
  }

  private forService(list: ServicePhoto[], serviceId: string): ServicePhoto[] {
    return list
      .filter((p) => p.serviceId === serviceId)
      .sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt));
  }

  listForService(serviceId: string): Observable<ServicePhoto[]> {
    return this.photos$.pipe(map((list) => this.forService(list, serviceId)));
  }

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

  remainingSlots(serviceId: string): number {
    return Math.max(0, MAX_SERVICE_PHOTOS - this.countFor(serviceId));
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

  upload(serviceId: string, file: File, caption = ''): Observable<ServicePhoto> {
    const error = this.validate(serviceId, file);
    if (error) { return throwError(() => new Error(error)); }
    return from(this.uploadAsync(serviceId, file, caption));
  }

  private async uploadAsync(serviceId: string, file: File, caption: string): Promise<ServicePhoto> {
    const mecanicoId = this.auth.mechanicId;
    if (!mecanicoId) { throw new Error('Sólo el mecánico puede subir fotos.'); }

    // Se reduce antes de subir; si falla, downscaleImage devuelve el original.
    const optimized = await downscaleImage(file);
    const path = `${mecanicoId}/${serviceId}/${uuid()}.jpg`;

    const up = await this.sb.db.storage
      .from(this.bucket)
      .upload(path, optimized, { contentType: optimized.type || 'image/jpeg', upsert: false });
    if (up.error) { throw new Error(this.sb.mensaje(up.error)); }

    const { data: row, error } = await this.sb.db
      .from('servicio_fotos')
      .insert({
        servicio_id: serviceId,
        mecanico_id: mecanicoId,
        nota: caption.trim(),
        ruta: path,
        nombre: optimized.name,
        tamano: optimized.size,
      })
      .select()
      .single();

    if (error || !row) {
      // La fila no se guardó: se quita el archivo para no dejar basura suelta.
      await this.sb.db.storage.from(this.bucket).remove([path]).catch(() => undefined);
      throw new Error(this.sb.mensaje(error));
    }

    await this.reload();
    return toPhoto(row, (p) => this.publicUrl(p));
  }

  updateCaption(id: string, caption: string): Observable<void> {
    return from(
      (async () => {
        const { error } = await this.sb.db
          .from('servicio_fotos')
          .update({ nota: caption.trim() })
          .eq('id', id);
        if (error) { throw new Error(this.sb.mensaje(error)); }
        await this.reload();
      })()
    );
  }

  /** El bucket es público, así que la URL sirve directo en un <img>. */
  getObjectUrl(photo: ServicePhoto): Observable<string> {
    return of(photo.url || this.publicUrl(photo.path));
  }

  remove(photo: ServicePhoto): Observable<void> {
    return from(
      (async () => {
        const { error } = await this.sb.db.from('servicio_fotos').delete().eq('id', photo.id);
        if (error) { throw new Error(this.sb.mensaje(error)); }
        await this.sb.db.storage.from(this.bucket).remove([photo.path]).catch(() => undefined);
        await this.reload();
      })()
    );
  }

  /** Se llama al eliminar un servicio, para no dejar archivos huérfanos. */
  removeForService(serviceId: string): Observable<void> {
    const doomed = this.subject.value.filter((p) => p.serviceId === serviceId);
    if (!doomed.length) { return of(void 0); }
    return from(
      (async () => {
        await this.sb.db.storage.from(this.bucket).remove(doomed.map((p) => p.path))
          .catch(() => undefined);
        await this.sb.db.from('servicio_fotos').delete().eq('servicio_id', serviceId);
        this.subject.next(this.subject.value.filter((p) => p.serviceId !== serviceId));
      })()
    );
  }
}
