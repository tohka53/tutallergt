import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { switchMap, combineLatest, of, take } from 'rxjs';
import { QuotationService } from '../../core/services/quotation.service';
import { ClientService } from '../../core/services/client.service';
import { VehicleService } from '../../core/services/vehicle.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { QuotationDeliveryService } from '../../core/services/quotation-delivery.service';
import { QuotationPdfService } from '../../core/services/quotation-pdf.service';
import { amountInWords } from '../../core/services/number-to-words.util';
import { Client, Quotation, Vehicle } from '../../models';
import { basePath } from '../../shared/nav.util';
import { QUOTATION_STATUS_CHIP, QUOTATION_STATUS_LABELS } from '../../shared/status.util';
import { PdfPreviewDialogComponent } from '../dialogs/pdf-preview-dialog.component';
import { ConvertToServiceDialogComponent } from '../dialogs/convert-to-service-dialog.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-quotation-detail',
  standalone: false,
  templateUrl: './quotation-detail.component.html',
  styleUrls: ['./quotation-detail.component.scss'],
})
export class QuotationDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private quotations = inject(QuotationService);
  private clients = inject(ClientService);
  private vehicles = inject(VehicleService);
  private auth = inject(AuthService);
  private notify = inject(NotificationService);
  private delivery = inject(QuotationDeliveryService);
  private pdf = inject(QuotationPdfService);
  private dialog = inject(MatDialog);

  loading = true;
  sending = false;
  quotation?: Quotation;
  client?: Client;
  vehicle?: Vehicle;
  base = basePath(this.auth);
  isMechanic = this.auth.isMechanic();

  qLabel = QUOTATION_STATUS_LABELS; qChip = QUOTATION_STATUS_CHIP;

  ngOnInit(): void {
    this.route.paramMap.pipe(
      switchMap((p) => this.quotations.getById(p.get('id') ?? '')),
      switchMap((q) => {
        this.quotation = q;
        if (!q) { return of([undefined, undefined] as [Client | undefined, Vehicle | undefined]); }
        return combineLatest([
          this.clients.getById(q.clientId).pipe(take(1)),
          this.vehicles.getById(q.vehicleId).pipe(take(1)),
        ]);
      })
    ).subscribe(([client, vehicle]) => {
      this.client = client; this.vehicle = vehicle; this.loading = false;
    });
  }

  get totalInWords(): string {
    return this.quotation ? amountInWords(this.quotation.total) : '';
  }

  /** Margen sobre la venta. Sólo se pinta para el mecánico. */
  get marginPct(): number {
    if (!this.quotation?.subtotal) { return 0; }
    return Math.round((this.quotation.profit / this.quotation.subtotal) * 1000) / 10;
  }

  canConvert(): boolean {
    return this.isMechanic && !!this.quotation && this.quotation.status !== 'converted'
      && this.quotation.status !== 'void' && !this.quotation.convertedServiceId;
  }

  preview(): void {
    if (!this.quotation || !this.client || !this.vehicle) { return; }
    this.dialog.open(PdfPreviewDialogComponent, {
      data: { quotation: this.quotation, client: this.client, vehicle: this.vehicle },
      width: '820px', maxWidth: '95vw',
    });
  }

  async downloadPdf(): Promise<void> {
    if (!this.quotation || !this.client || !this.vehicle) { return; }
    await this.pdf.download(this.quotation, this.client, this.vehicle);
  }

  /**
   * Un solo botón: arma el PDF, lo manda por WhatsApp con el mensaje y,
   * si salió, deja la cotización marcada como enviada.
   */
  async send(): Promise<void> {
    if (!this.quotation || !this.client || !this.vehicle || this.sending) { return; }
    this.sending = true;
    try {
      const result = await this.delivery.send(this.quotation, this.client, this.vehicle);
      if (result.outcome === 'cancelled') {
        this.notify.info(result.message);
      } else {
        this.notify.success(result.message);
        if (this.quotation.status === 'draft') {
          this.quotations.setStatus(this.quotation.id, 'sent').subscribe({
            error: () => undefined,
          });
        }
      }
    } catch (e) {
      this.notify.error((e as Error).message || 'No se pudo preparar la cotización.');
    } finally {
      this.sending = false;
    }
  }

  markAccepted(): void {
    if (!this.quotation) { return; }
    this.quotations.setStatus(this.quotation.id, 'accepted').subscribe({
      next: () => this.notify.success('Cotización marcada como aceptada. Ya cuenta en tus métricas.'),
      error: (e: Error) => this.notify.error(e.message),
    });
  }

  convert(): void {
    if (!this.quotation || !this.client || !this.vehicle) { return; }
    this.dialog.open(ConvertToServiceDialogComponent, {
      data: { quotation: this.quotation, client: this.client, vehicle: this.vehicle },
      width: '820px', maxWidth: '95vw', disableClose: true,
    }).afterClosed().subscribe((serviceId?: string | null) => {
      if (serviceId) { this.router.navigate(['/app/services', serviceId]); }
    });
  }

  voidQuotation(): void {
    if (!this.quotation) { return; }
    const data: ConfirmDialogData = {
      title: 'Anular cotización', message: `¿Anular la cotización ${this.quotation.number}?`,
      confirmText: 'Anular', danger: true,
    };
    const id = this.quotation.id;
    this.dialog.open(ConfirmDialogComponent, { data, width: '420px' }).afterClosed().subscribe((ok) => {
      if (ok) {
        this.quotations.setStatus(id, 'void').subscribe(() => this.notify.info('Cotización anulada.'));
      }
    });
  }

  typeLabel(t: string): string {
    return t === 'part' ? 'Repuesto' : t === 'material' ? 'Material' : t === 'labor' ? 'Mano de obra' : 'Otro';
  }
}
