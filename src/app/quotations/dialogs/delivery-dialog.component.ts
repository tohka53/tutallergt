import { Component, Inject, OnInit, inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Client, DeliveryLog, Quotation, Vehicle } from '../../models';
import { QuotationDeliveryService } from '../../core/services/quotation-delivery.service';
import { NotificationService } from '../../core/services/notification.service';

export interface DeliveryData { quotation: Quotation; client: Client; vehicle: Vehicle; }

@Component({
  selector: 'app-delivery-dialog',
  standalone: false,
  templateUrl: './delivery-dialog.component.html',
})
export class DeliveryDialogComponent implements OnInit {
  private fb = inject(FormBuilder);
  private delivery = inject(QuotationDeliveryService);
  private notify = inject(NotificationService);

  sending = false;
  logs: DeliveryLog[] = [];
  whatsAppMessage = '';

  emailForm = this.fb.nonNullable.group({
    recipient: ['', [Validators.required, Validators.email]],
    subject: ['', Validators.required],
    message: ['', Validators.required],
  });

  constructor(@Inject(MAT_DIALOG_DATA) public data: DeliveryData) {}

  ngOnInit(): void {
    const defaults = this.delivery.buildEmailDefaults(this.data.quotation, this.data.client);
    this.emailForm.patchValue(defaults);
    this.whatsAppMessage = this.delivery.buildWhatsAppMessage(this.data.quotation, this.data.vehicle);
    this.delivery.logsForQuotation(this.data.quotation.id).subscribe((l) =>
      (this.logs = [...l].sort((a, b) => b.createdAt.localeCompare(a.createdAt))));
  }

  sendEmailMock(): void {
    if (this.emailForm.invalid) { this.emailForm.markAllAsTouched(); return; }
    this.sending = true;
    this.delivery.sendEmailMock(this.data.quotation, this.emailForm.getRawValue()).subscribe(() => {
      this.sending = false;
      this.notify.info('Correo simulado en modo demo (no se envió un correo real).');
    });
  }

  openMailto(): void {
    this.delivery.openMailto(this.emailForm.getRawValue());
    this.notify.info('Se abrió tu cliente de correo. mailto no adjunta el PDF automáticamente.');
  }

  async shareWhatsApp(): Promise<void> {
    this.sending = true;
    const log = await this.delivery.shareWhatsApp(this.data.quotation, this.data.client, this.data.vehicle);
    this.sending = false;
    this.notify.info(
      log.result === 'shared'
        ? 'PDF compartido por el selector del sistema.'
        : 'Se descargó el PDF y se abrió WhatsApp. Adjunta manualmente el archivo descargado.'
    );
  }

  channelLabel(c: string): string { return c === 'email' ? 'Correo' : 'WhatsApp'; }
  resultLabel(r: string): string {
    const map: Record<string, string> = {
      simulated: 'Simulado (demo)', 'opened-client': 'Abrió WhatsApp', shared: 'Compartido', failed: 'Falló',
    };
    return map[r] ?? r;
  }
}
