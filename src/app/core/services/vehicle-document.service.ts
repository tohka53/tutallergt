import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, from, of, throwError } from 'rxjs';
import { map } from 'rxjs/operators';
import { VehicleDocument } from '../../models';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { WorkshopSettingsService } from './workshop-settings.service';
import { uuid } from './id.util';
import { environment } from '../../../environments/environment';

const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];

/**
 * Tarjeta de circulación: un archivo por vehículo, guardado en el bucket
 * PRIVADO "documentos".
 *
 * Privado a diferencia de las fotos de evidencia: la tarjeta lleva datos
 * personales del dueño. Sólo el mecánico la abre, y siempre con un enlace
 * firmado que caduca; el portal del cliente ni siquiera la lista.
 */
@Injectable({ providedIn: 'root' })
export class VehicleDocumentService {
  private sb = inject(SupabaseService);
  private auth = inject(AuthService);
  private settings = inject(WorkshopSettingsService);

  private readonly bucket = environment.bucketDocumentos;
  private subject = new BehaviorSubject<VehicleDocument[]>([]);

  get snapshot(): VehicleDocument[] { return this.subject.value; }
  clear(): void { this.subject.next([]); }

  /** Se llena desde las columnas doc_* de la tabla `vehiculos`. */
  async reload(): Promise<void> {
    const { data, error } = await this.sb.db
      .from('vehiculos')
      .select('id, doc_ruta, doc_nombre, doc_mime, doc_tamano, doc_subido_en')
      .not('doc_ruta', 'is', null);
    if (error) { throw new Error(this.sb.mensaje(error)); }

    this.subject.next(
      (data ?? []).map((r) => ({
        id: String(r['id']),
        vehicleId: String(r['id']),
        kind: 'circulation-card' as const,
        fileName: String(r['doc_nombre'] ?? 'documento'),
        mimeType: String(r['doc_mime'] ?? 'application/pdf'),
        size: Number(r['doc_tamano'] ?? 0),
        path: String(r['doc_ruta']),
        uploadedAt: String(r['doc_subido_en'] ?? new Date().toISOString()),
      }))
    );
  }

  getForVehicle(vehicleId: string): Observable<VehicleDocument | undefined> {
    return this.subject.pipe(map((list) => list.find((d) => d.vehicleId === vehicleId)));
  }

  /** Valida tipo MIME real y tamaño antes de guardar. */
  validate(file: File): string | null {
    const maxBytes = this.settings.current.maxUploadMb * 1024 * 1024;
    if (!ALLOWED_MIME.includes(file.type)) {
      return 'Formato no permitido. Use PDF, JPG, JPEG o PNG.';
    }
    if (file.size > maxBytes) {
      return `El archivo supera el máximo de ${this.settings.current.maxUploadMb} MB.`;
    }
    return null;
  }

  upload(vehicleId: string, file: File): Observable<VehicleDocument> {
    const error = this.validate(file);
    if (error) { return throwError(() => new Error(error)); }
    return from(this.uploadAsync(vehicleId, file));
  }

  private async uploadAsync(vehicleId: string, file: File): Promise<VehicleDocument> {
    const mecanicoId = this.auth.mechanicId;
    if (!mecanicoId) { throw new Error('Sólo el mecánico puede subir documentos.'); }

    const previous = this.subject.value.find((d) => d.vehicleId === vehicleId);
    const ext = (file.name.split('.').pop() ?? 'pdf').toLowerCase();
    const path = `${mecanicoId}/${vehicleId}/${uuid()}.${ext}`;

    const up = await this.sb.db.storage
      .from(this.bucket)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (up.error) { throw new Error(this.sb.mensaje(up.error)); }

    const { error } = await this.sb.db
      .from('vehiculos')
      .update({
        doc_ruta: path,
        doc_nombre: file.name,
        doc_mime: file.type,
        doc_tamano: file.size,
        doc_subido_en: new Date().toISOString(),
      })
      .eq('id', vehicleId);

    if (error) {
      await this.sb.db.storage.from(this.bucket).remove([path]).catch(() => undefined);
      throw new Error(this.sb.mensaje(error));
    }

    // El anterior se borra sólo cuando el nuevo ya quedó registrado.
    if (previous) {
      await this.sb.db.storage.from(this.bucket).remove([previous.path]).catch(() => undefined);
    }

    await this.reload();
    return this.subject.value.find((d) => d.vehicleId === vehicleId) as VehicleDocument;
  }

  /**
   * Enlace firmado de una hora. No se guarda: se pide cada vez que se abre el
   * visor, así el enlace que quede en el historial del navegador ya no sirve.
   */
  getObjectUrl(doc: VehicleDocument): Observable<string> {
    return from(
      (async () => {
        const { data, error } = await this.sb.db.storage
          .from(this.bucket)
          .createSignedUrl(doc.path, 3600);
        if (error || !data) { throw new Error('No se pudo abrir el archivo.'); }
        return data.signedUrl;
      })()
    );
  }

  remove(doc: VehicleDocument): Observable<void> {
    return from(
      (async () => {
        const { error } = await this.sb.db
          .from('vehiculos')
          .update({
            doc_ruta: null, doc_nombre: null, doc_mime: null,
            doc_tamano: null, doc_subido_en: null,
          })
          .eq('id', doc.vehicleId);
        if (error) { throw new Error(this.sb.mensaje(error)); }
        await this.sb.db.storage.from(this.bucket).remove([doc.path]).catch(() => undefined);
        await this.reload();
      })()
    );
  }
}
