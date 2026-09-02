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
import { QuotationImageService } from '../../core/services/quotation-image.service';
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
  private imageService = inject(QuotationImageService);
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

  /**
   * La cotización como imagen PNG, sólo en computadora.
   *
   * Why: desde la computadora WhatsApp no acepta adjuntos por enlace, y el
   * portapapeles del navegador no admite PDF. Una imagen sí se puede pegar en
   * el chat, así que es la única forma de que la cotización viaje dentro del
   * mensaje sin salir del navegador. En el teléfono no hace falta: ahí el
   * selector del sistema adjunta el PDF de verdad.
   */
  private imagen?: Blob;

  /** Enlace a WhatsApp que se deja a la vista después de enviar. */
  enlaceRespaldo = '';
  /** true cuando la imagen quedó lista en el portapapeles. */
  imagenCopiada = false;
  atajoPegar = '';

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
    this.atajoPegar = this.delivery.atajoPegar();

    this.preparando = this.delivery
      .prepareFile(quotation, client, vehicle)
      .then((f) => (this.archivo = f))
      .catch(() => undefined);

    // La imagen sólo se prepara en computadora: es donde hace falta pegarla, y
    // rasterizar el PDF trae una librería pesada que no vale la pena bajar en
    // el teléfono, donde el selector del sistema ya adjunta el PDF.
    if (!this.delivery.esEscritorio()) { return; }
    this.preparando
      .then(() => this.imageService.build(quotation, client, vehicle))
      .then((b) => (this.imagen = b))
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
    this.imagenCopiada = false;

    // Teléfono: el selector del sistema manda el PDF adjunto.
    if (this.delivery.canShareFile(this.archivo)) {
      this.sending = true;
      this.delivery
        .shareFile(this.archivo as File, quotation, client, vehicle)
        .then((r) => this.resolverEnvio(r))
        .finally(() => (this.sending = false));
      return;
    }

    // Computadora. El orden importa:
    // 1) copiar la imagen mientras el documento AÚN tiene el foco — el
    //    navegador exige foco para escribir en el portapapeles, y abrir la
    //    pestaña de WhatsApp se lo quita;
    // 2) abrir WhatsApp, con el clic todavía vivo;
    // 3) descargar el PDF, que ya no tiene prisa.
    const copiando = this.imagen
      ? this.delivery.copyImage(this.imagen)
      : Promise.resolve(false);

    const resultado = this.delivery.openWhatsApp(quotation, client, vehicle);
    this.resolverEnvio(resultado);

    copiando.then((ok) => (this.imagenCopiada = ok));

    this.delivery.downloadPdf(quotation, client, vehicle).catch(() => {
      this.notify.error('No se pudo generar el PDF para descargar.');
    });
  }

  /** Botón de respaldo: vuelve a copiar la imagen al portapapeles. */
  async copiarImagen(): Promise<void> {
    const { quotation, client, vehicle } = this;
    if (!quotation || !client || !vehicle) { return; }
    try {
      if (!this.imagen) {
        this.imagen = await this.imageService.build(quotation, client, vehicle);
      }
      this.imagenCopiada = await this.delivery.copyImage(this.imagen);
      if (this.imagenCopiada) {
        this.notify.success(`Imagen copiada. Pega con ${this.atajoPegar} en WhatsApp.`);
      } else {
        this.notify.error('Tu navegador no dejó copiar la imagen. Usa el PDF descargado.');
      }
    } catch {
      this.notify.error('No se pudo preparar la imagen.');
    }
  }

  /** ¿Tiene sentido ofrecer la imagen en este navegador? */
  get puedeCopiarImagen(): boolean {
    return this.delivery.esEscritorio() && this.delivery.canCopyImage();
  }

  /**
   * El bloque con el enlace a WhatsApp se muestra SIEMPRE después de pulsar
   * enviar, pase lo que pase.
   *
   * Why: los tres finales posibles se ven igual desde afuera cuando salen mal.
   * En Mac el panel de compartir del sistema se abre pero NO tiene WhatsApp en
   * la lista; una ventana emergente puede quedar bloqueada sin decir nada; y
   * el navegador puede saltar a la app de WhatsApp dejando la pantalla igual.
   * Un aviso que sólo aparece "cuando se detecta el fallo" no sirve, porque el
   * fallo es justamente que nadie se entera. Con el enlace siempre presente
   * hay dónde hacer clic sin depender de acertar el diagnóstico.
   */
  private resolverEnvio(r: DeliveryResult): void {
    this.enlaceRespaldo = r.url || this.urlWhatsApp();

    if (r.outcome === 'cancelled') { this.notify.info(r.message); return; }
    if (r.outcome === 'blocked') {
      this.notify.error('El navegador bloqueó la ventana. Usa el enlace de abajo.');
      return;
    }
    this.notify.success(r.message);
    this.marcarEnviada();
  }

  private urlWhatsApp(): string {
    const { quotation, client, vehicle } = this;
    if (!quotation || !client || !vehicle) { return ''; }
    return this.delivery.whatsappUrl(quotation, client, vehicle);
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
