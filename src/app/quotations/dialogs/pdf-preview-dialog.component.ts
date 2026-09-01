import { Component, Inject, OnDestroy, OnInit, inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Client, Quotation, Vehicle } from '../../models';
import { QuotationPdfService } from '../../core/services/quotation-pdf.service';
import { NotificationService } from '../../core/services/notification.service';

export interface PdfPreviewData { quotation: Quotation; client: Client; vehicle: Vehicle; }

@Component({
  selector: 'app-pdf-preview-dialog',
  standalone: false,
  template: `
    <h2 mat-dialog-title>Vista previa · {{ data.quotation.number }}</h2>
    <mat-dialog-content>
      <div *ngIf="loading" class="tc-loading" style="padding:40px 0;">
        <mat-progress-spinner mode="indeterminate" diameter="40"></mat-progress-spinner>
      </div>
      <iframe *ngIf="safeUrl" [src]="safeUrl" class="pdf-frame" title="Vista previa PDF"></iframe>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cerrar</button>
      <button mat-raised-button class="tc-btn-primary" (click)="download()" [disabled]="loading">
        <mat-icon>download</mat-icon> Descargar PDF
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .pdf-frame { display: block; width: 100%; height: 70vh; border: none; }
    @media (max-width: 900px) {
      .pdf-frame { height: calc(100vh - 240px); min-height: 300px; }
    }
  `],
})
export class PdfPreviewDialogComponent implements OnInit, OnDestroy {
  private pdf = inject(QuotationPdfService);
  private sanitizer = inject(DomSanitizer);
  private notify = inject(NotificationService);

  safeUrl?: SafeResourceUrl;
  loading = true;
  private url = '';

  constructor(@Inject(MAT_DIALOG_DATA) public data: PdfPreviewData) {}

  async ngOnInit(): Promise<void> {
    try {
      this.url = await this.pdf.blobUrl(this.data.quotation, this.data.client, this.data.vehicle);
      this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.url);
    } catch (e) {
      this.notify.error((e as Error).message || 'No se pudo generar el PDF.');
    } finally {
      this.loading = false;
    }
  }

  async download(): Promise<void> {
    await this.pdf.download(this.data.quotation, this.data.client, this.data.vehicle);
  }

  ngOnDestroy(): void { if (this.url) { URL.revokeObjectURL(this.url); } }
}
