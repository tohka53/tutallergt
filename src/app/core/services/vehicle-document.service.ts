import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, from, of, throwError } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { VehicleDocument } from '../../models';
import { StorageService } from './storage.service';
import { IndexedDbService } from './indexed-db.service';
import { WorkshopSettingsService } from './workshop-settings.service';
import { uuid } from './id.util';

const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];

@Injectable({ providedIn: 'root' })
export class VehicleDocumentService {
  private storage = inject(StorageService);
  private idb = inject(IndexedDbService);
  private settings = inject(WorkshopSettingsService);
  private readonly key = 'vehicle-documents';
  private subject = new BehaviorSubject<VehicleDocument[]>(
    this.storage.get<VehicleDocument[]>(this.key, [])
  );

  private persist(items: VehicleDocument[]): void {
    this.storage.set(this.key, items);
    this.subject.next(items);
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

    // Reemplaza documento anterior si existe
    const existing = this.subject.value.find((d) => d.vehicleId === vehicleId);
    const blobKey = 'doc-' + uuid();

    return from(this.idb.saveBlob(blobKey, file)).pipe(
      switchMap(() => {
        if (existing) {
          return from(this.idb.deleteBlob(existing.blobKey)).pipe(map(() => existing));
        }
        return of(null);
      }),
      map(() => {
        const doc: VehicleDocument = {
          id: existing?.id ?? uuid(),
          vehicleId,
          kind: 'circulation-card',
          fileName: file.name,
          mimeType: file.type,
          size: file.size,
          blobKey,
          uploadedAt: new Date().toISOString(),
        };
        const others = this.subject.value.filter((d) => d.vehicleId !== vehicleId);
        this.persist([...others, doc]);
        return doc;
      })
    );
  }

  /** Devuelve un object URL. El componente DEBE liberarlo con URL.revokeObjectURL. */
  getObjectUrl(doc: VehicleDocument): Observable<string> {
    return from(this.idb.getBlob(doc.blobKey)).pipe(
      map((blob) => {
        if (!blob) { throw new Error('Archivo no encontrado.'); }
        return URL.createObjectURL(blob);
      })
    );
  }

  remove(doc: VehicleDocument): Observable<void> {
    return from(this.idb.deleteBlob(doc.blobKey)).pipe(
      map(() => {
        this.persist(this.subject.value.filter((d) => d.id !== doc.id));
      })
    );
  }
}
