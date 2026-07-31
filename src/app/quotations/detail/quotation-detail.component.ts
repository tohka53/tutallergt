import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { switchMap, combineLatest, of } from 'rxjs';
import { QuotationService } from '../../core/services/quotation.service';
import { ClientService } from '../../core/services/client.service';
import { VehicleService } from '../../core/services/vehicle.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { numberToWords } from '../../core/services/number-to-words.util';
import { Client, Quotation, Vehicle } from '../../models';
import { basePath } from '../../shared/nav.util';
import { QUOTATION_STATUS_CHIP, QUOTATION_STATUS_LABELS } from '../../shared/status.util';
import { PdfPreviewDialogComponent } from '../dialogs/pdf-preview-dialog.component';
import { DeliveryDialogComponent } from '../dialogs/delivery-dialog.component';
import { ConvertToServiceDialogComponent } from '../dialogs/convert-to-service-dialog.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-quotation-detail',
  standalone: false,
  templateUrl: './quotation-detail.component.html',
})
export class QuotationDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private quotations = inject(QuotationService);
  private clients = inject(ClientService);
  private vehicles = inject(VehicleService);
  private auth = inject(AuthService);
  private notify = inject(NotificationService);
  private dialog = inject(MatDialog);

  loading = true;
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
        return combineLatest([this.clients.getById(q.clientId), this.vehicles.getById(q.vehicleId)]);
      })
    ).subscribe(([client, vehicle]) => {
      this.client = client; this.vehicle = vehicle; this.loading = false;
    });
  }

  get totalInWords(): string {
    return this.quotation ? numberToWords(this.quotation.total) : '';
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

  share(): void {
    if (!this.quotation || !this.client || !this.vehicle) { return; }
    this.dialog.open(DeliveryDialogComponent, {
      data: { quotation: this.quotation, client: this.client, vehicle: this.vehicle },
      width: '620px', maxWidth: '95vw',
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
      if (ok) { this.quotations.setStatus(id, 'void').subscribe(() => this.notify.info('Cotización anulada.')); }
    });
  }

  typeLabel(t: string): string {
    return t === 'part' ? 'Repuesto' : t === 'material' ? 'Material' : t === 'labor' ? 'Mano de obra' : 'Otro';
  }
}
