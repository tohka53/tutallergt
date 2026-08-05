import { Component, HostListener, Inject, OnDestroy, OnInit, inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ServicePhoto } from '../../models';
import { ServicePhotoService } from '../../core/services/service-photo.service';

export interface PhotoViewerData {
  photos: ServicePhoto[];
  index: number;
}

/**
 * Visor ampliado de la evidencia. Carga sus propios object URLs y los libera al
 * cerrarse, para no depender del ciclo de vida de la galería que lo abrió.
 */
@Component({
  selector: 'app-photo-viewer-dialog',
  standalone: false,
  templateUrl: './photo-viewer-dialog.component.html',
  styleUrls: ['./photo-viewer-dialog.component.scss'],
})
export class PhotoViewerDialogComponent implements OnInit, OnDestroy {
  private photoService = inject(ServicePhotoService);

  photos: ServicePhoto[] = [];
  index = 0;
  urls: Record<string, string> = {};
  loading = true;
  error = '';
  zoom = 1;

  constructor(@Inject(MAT_DIALOG_DATA) data: PhotoViewerData) {
    this.photos = data.photos ?? [];
    this.index = Math.min(Math.max(0, data.index ?? 0), Math.max(0, this.photos.length - 1));
  }

  get current(): ServicePhoto | undefined {
    return this.photos[this.index];
  }

  get currentUrl(): string {
    const photo = this.current;
    return photo ? this.urls[photo.blobKey] ?? '' : '';
  }

  ngOnInit(): void {
    if (!this.photos.length) {
      this.error = 'No hay fotos que mostrar.';
      this.loading = false;
      return;
    }
    let pending = this.photos.length;
    this.photos.forEach((photo) => {
      this.photoService.getObjectUrl(photo).subscribe({
        next: (url) => {
          this.urls[photo.blobKey] = url;
          if (--pending === 0) { this.loading = false; }
        },
        error: () => {
          if (--pending === 0) { this.loading = false; }
          if (photo.id === this.current?.id) { this.error = 'No se pudo cargar la imagen.'; }
        },
      });
    });
  }

  go(step: number): void {
    if (this.photos.length < 2) { return; }
    this.index = (this.index + step + this.photos.length) % this.photos.length;
    this.zoom = 1;
    this.error = '';
  }

  @HostListener('document:keydown.arrowright')
  next(): void { this.go(1); }

  @HostListener('document:keydown.arrowleft')
  prev(): void { this.go(-1); }

  zoomIn(): void { this.zoom = Math.min(4, this.zoom + 0.25); }
  zoomOut(): void { this.zoom = Math.max(0.5, this.zoom - 0.25); }
  resetZoom(): void { this.zoom = 1; }

  download(): void {
    const photo = this.current;
    if (!photo || !this.currentUrl) { return; }
    const a = document.createElement('a');
    a.href = this.currentUrl;
    a.download = photo.fileName;
    a.click();
  }

  ngOnDestroy(): void {
    Object.values(this.urls).forEach((url) => URL.revokeObjectURL(url));
    this.urls = {};
  }
}
