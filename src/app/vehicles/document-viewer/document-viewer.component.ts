import { Component, Inject, OnDestroy, OnInit, inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { VehicleDocument } from '../../models';
import { VehicleDocumentService } from '../../core/services/vehicle-document.service';

@Component({
  selector: 'app-document-viewer',
  standalone: false,
  templateUrl: './document-viewer.component.html',
  styleUrls: ['./document-viewer.component.scss'],
})
export class DocumentViewerComponent implements OnInit, OnDestroy {
  private docService = inject(VehicleDocumentService);
  private sanitizer = inject(DomSanitizer);

  loading = true;
  error = '';
  isPdf = false;
  objectUrl = '';
  safeUrl?: SafeResourceUrl;
  zoom = 1;

  constructor(@Inject(MAT_DIALOG_DATA) public doc: VehicleDocument) {}

  ngOnInit(): void {
    this.isPdf = this.doc.mimeType === 'application/pdf';
    this.docService.getObjectUrl(this.doc).subscribe({
      next: (url) => {
        this.objectUrl = url;
        // El blob proviene de IndexedDB (origen propio), se marca como confiable.
        this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
        this.loading = false;
      },
      error: () => { this.error = 'No se pudo cargar el archivo.'; this.loading = false; },
    });
  }

  zoomIn(): void { this.zoom = Math.min(4, this.zoom + 0.25); }
  zoomOut(): void { this.zoom = Math.max(0.5, this.zoom - 0.25); }
  resetZoom(): void { this.zoom = 1; }

  download(): void {
    const a = document.createElement('a');
    a.href = this.objectUrl;
    a.download = this.doc.fileName;
    a.click();
  }

  ngOnDestroy(): void {
    // Liberar el object URL para evitar fugas de memoria
    if (this.objectUrl) { URL.revokeObjectURL(this.objectUrl); }
  }
}
