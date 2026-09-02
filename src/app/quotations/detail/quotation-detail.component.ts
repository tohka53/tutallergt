import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { switchMap, combineLatest, of, take } from 'rxjs';
import { QuotationService } from '../../core/services/quotation.service';
import { ClientService } from '../../core/services/client.service';
import { VehicleService } from '../../core/services/vehicle.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { DeliveryResult, QuotationDeliveryService } from '../../core/services/quotation-delivery.service';
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

  /**
   * El PDF se arma apenas carga la pantalla, no al hacer clic.
   *
   * Why: `navigator.share()` y `window.open()` sólo funcionan mientras el
   * navegador considera que está atendiendo un clic. Si se genera el PDF con
   * `await` y después se abre WhatsApp, Chrome ya perdió esa activación y
   * bloquea la ventana en silencio — el botón parecía no hacer nada.
   */
  private archivo?: File;
  private preparando?: Promise<File | undefined>;

  /** Enlace visible cuando el navegador bloqueó la ventana emergente. */
  enlaceRespaldo = '';

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
      if (this.isMechanic) { this.prepararArchivo(); }
    });
  }

  /** Deja el PDF listo en segundo plano. Si falla, el envío sigue con el texto. */
  private prepararArchivo(): void {
    const { quotation, client, vehicle } = this;
    if (!quotation || !client || !vehicle) { return; }
    this.preparando = this.delivery
      .prepareFile(quotation, client, vehicle)
      .then((f) => (this.archivo = f))
      .catch(() => undefined);
  }

  get totalInWords(): string {
    return this.quotation ? amountInWords(this.quotation.total) : '';
  }

  /** Número al que se va a mandar, para que el mecánico pueda verificarlo. */
  get numeroDestino(): string {
    return this.client ? this.delivery.waNumber(this.client) : '';
  }

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
   * Un solo botón. OJO: este método NO puede tener `await` antes de llamar a
   * `share()` o `window.open()`, o el navegador bloquea la ventana. Todo lo
   * lento ya se hizo en `prepararArchivo()`.
   */
  send(): void {
    const { quotation, client, vehicle } = this;
    if (!quotation || !client || !vehicle || this.sending) { return; }
    this.enlaceRespaldo = '';

    // Teléfono: el selector del sistema manda el PDF adjunto.
    if (this.delivery.canShareFile(this.archivo)) {
      this.sending = true;
      this.delivery
        .shareFile(this.archivo as File, quotation, client, vehicle)
        .then((r) => this.resolverEnvio(r))
        .finally(() => (this.sending = false));
      return;
    }

    // Computadora: se abre WhatsApp de una vez, con el clic todavía vivo.
    const resultado = this.delivery.openWhatsApp(quotation, client, vehicle);
    this.resolverEnvio(resultado);

    // Y después, ya sin prisa, se descarga el PDF para arrastrarlo al chat.
    if (resultado.outcome !== 'blocked') {
      this.delivery.downloadPdf(quotation, client, vehicle).catch(() => {
        this.notify.error('No se pudo generar el PDF para descargar.');
      });
    }
  }

  private resolverEnvio(r: DeliveryResult): void {
    if (r.outcome === 'cancelled') {
      this.notify.info(r.message);
      return;
    }
    if (r.outcome === 'blocked') {
      this.enlaceRespaldo = r.url ?? '';
      this.notify.error('El navegador bloqueó la ventana. Usa el enlace que apareció abajo del botón.');
      return;
    }
    // En la computadora el enlace se deja SIEMPRE a la vista, no sólo cuando
    // se detecta un bloqueo. Un aviso que sólo aparece "cuando falla" no sirve
    // si el fallo es justamente que no se entera nadie: extensiones, bloqueo
    // de ventanas o el navegador cambiando a la app de WhatsApp dejan al
    // mecánico mirando un botón que aparentemente no hizo nada.
    if (r.outcome === 'opened' && r.url) {
      this.enlaceRespaldo = r.url;
    }
    this.notify.success(r.message);
    this.marcarEnviada();
  }

  private marcarEnviada(): void {
    if (this.quotation?.status !== 'draft') { return; }
    this.quotations.setStatus(this.quotation.id, 'sent').subscribe({ error: () => undefined });
  }

  /** El mecánico ya no necesita el bloque de respaldo. */
  ocultarRespaldo(): void {
    this.enlaceRespaldo = '';
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
