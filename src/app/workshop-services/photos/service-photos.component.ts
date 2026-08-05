import { Component, Input, OnDestroy, OnInit, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Subject, takeUntil } from 'rxjs';
import { MAX_SERVICE_PHOTOS, ServicePhoto } from '../../models';
import {
  SERVICE_PHOTO_ACCEPT, ServicePhotoService,
} from '../../core/services/service-photo.service';
import { WorkshopSettingsService } from '../../core/services/workshop-settings.service';
import { NotificationService } from '../../core/services/notification.service';
import {
  ConfirmDialogComponent, ConfirmDialogData,
} from '../../shared/components/confirm-dialog/confirm-dialog.component';
import {
  PhotoViewerDialogComponent, PhotoViewerData,
} from './photo-viewer-dialog.component';

/**
 * Galería de evidencia del servicio: cómo se encontró la pieza antes de
 * cambiarla. La misma tarjeta la ve el mecánico y el cliente; sólo cambian los
 * controles de edición según `canEdit`.
 */
@Component({
  selector: 'app-service-photos',
  standalone: false,
  templateUrl: './service-photos.component.html',
  styleUrls: ['./service-photos.component.scss'],
})
export class ServicePhotosComponent implements OnInit, OnDestroy {
  /** Servicio al que pertenecen las fotos. */
  @Input({ required: true }) serviceId!: string;
  /** true para el mecánico: habilita subir, editar la nota y eliminar. */
  @Input() canEdit = false;

  private photoService = inject(ServicePhotoService);
  private settingsService = inject(WorkshopSettingsService);
  private notify = inject(NotificationService);
  private dialog = inject(MatDialog);
  private destroy$ = new Subject<void>();

  readonly max = MAX_SERVICE_PHOTOS;
  readonly accept = SERVICE_PHOTO_ACCEPT;

  photos: ServicePhoto[] = [];
  /** object URLs vivos, por blobKey. Se liberan al cambiar la lista y al destruir. */
  urls: Record<string, string> = {};
  uploading = false;

  get maxUploadMb(): number {
    return this.settingsService.current.maxUploadMb;
  }

  get remaining(): number {
    return Math.max(0, this.max - this.photos.length);
  }

  ngOnInit(): void {
    this.photoService.listForService(this.serviceId)
      .pipe(takeUntil(this.destroy$))
      .subscribe((list) => {
        this.photos = list;
        this.syncUrls(list);
      });
  }

  /** Crea los object URL que faltan y libera los que ya no se usan. */
  private syncUrls(list: ServicePhoto[]): void {
    const live = new Set(list.map((p) => p.blobKey));
    Object.keys(this.urls).forEach((key) => {
      if (!live.has(key)) {
        URL.revokeObjectURL(this.urls[key]);
        delete this.urls[key];
      }
    });
    list.forEach((photo) => {
      if (this.urls[photo.blobKey]) { return; }
      this.photoService.getObjectUrl(photo)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (url) => { this.urls[photo.blobKey] = url; },
          error: () => { /* la miniatura queda con el marcador de "no disponible" */ },
        });
    });
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = ''; // permite volver a elegir el mismo archivo
    if (!files.length) { return; }

    if (files.length > this.remaining) {
      this.notify.error(
        this.remaining === 0
          ? `Ya hay ${this.max} fotos. Elimine una para subir otra.`
          : `Sólo caben ${this.remaining} foto(s) más en este servicio.`
      );
      return;
    }
    this.uploadNext(files);
  }

  /** Sube en serie: cada validación depende de cuántas fotos ya se guardaron. */
  private uploadNext(queue: File[]): void {
    const file = queue.shift();
    if (!file) { this.uploading = false; return; }

    this.uploading = true;
    this.photoService.upload(this.serviceId, file).subscribe({
      next: () => {
        if (queue.length) {
          this.uploadNext(queue);
        } else {
          this.uploading = false;
          this.notify.success('Evidencia guardada.');
        }
      },
      error: (err: Error) => {
        this.uploading = false;
        this.notify.error(err.message || 'No se pudo guardar la imagen.');
      },
    });
  }

  saveCaption(photo: ServicePhoto, value: string): void {
    if (value.trim() === photo.caption) { return; }
    this.photoService.updateCaption(photo.id, value).subscribe();
  }

  open(index: number): void {
    const data: PhotoViewerData = { photos: this.photos, index };
    this.dialog.open(PhotoViewerDialogComponent, {
      data, width: '900px', maxWidth: '96vw', autoFocus: false,
    });
  }

  remove(photo: ServicePhoto): void {
    const data: ConfirmDialogData = {
      title: 'Eliminar foto',
      message: '¿Eliminar esta foto de evidencia? El cliente dejará de verla.',
      confirmText: 'Eliminar',
      danger: true,
    };
    this.dialog.open(ConfirmDialogComponent, { data, width: '420px' })
      .afterClosed().subscribe((ok) => {
        if (!ok) { return; }
        this.photoService.remove(photo).subscribe({
          next: () => this.notify.success('Foto eliminada.'),
          error: () => this.notify.error('No se pudo eliminar la foto.'),
        });
      });
  }

  trackById(_: number, photo: ServicePhoto): string {
    return photo.id;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    Object.values(this.urls).forEach((url) => URL.revokeObjectURL(url));
    this.urls = {};
  }
}
