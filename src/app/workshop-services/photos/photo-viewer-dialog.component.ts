import { Component, HostListener, Inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ServicePhoto } from '../../models';

export interface PhotoViewerData {
  photos: ServicePhoto[];
  index: number;
}

/**
 * Visor ampliado de la evidencia. Las imágenes viven en un bucket público de
 * Supabase, así que cada foto ya trae su URL: el visor sólo navega entre ellas.
 */
@Component({
  selector: 'app-photo-viewer-dialog',
  standalone: false,
  templateUrl: './photo-viewer-dialog.component.html',
  styleUrls: ['./photo-viewer-dialog.component.scss'],
})
export class PhotoViewerDialogComponent {
  photos: ServicePhoto[] = [];
  index = 0;
  loading = false;
  error = '';
  zoom = 1;

  constructor(@Inject(MAT_DIALOG_DATA) data: PhotoViewerData) {
    this.photos = data.photos ?? [];
    this.index = Math.min(Math.max(0, data.index ?? 0), Math.max(0, this.photos.length - 1));
    if (!this.photos.length) { this.error = 'No hay fotos que mostrar.'; }
  }

  get current(): ServicePhoto | undefined {
    return this.photos[this.index];
  }

  get currentUrl(): string {
    return this.current?.url ?? '';
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

}
