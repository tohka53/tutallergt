import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { delay, map } from 'rxjs/operators';
import { Client, DeliveryLog, Quotation, Vehicle } from '../../models';
import { StorageService } from './storage.service';
import { AuthService } from './auth.service';
import { QuotationPdfService } from './quotation-pdf.service';
import { WorkshopSettingsService } from './workshop-settings.service';
import { uuid } from './id.util';

export interface EmailPayload {
  recipient: string;
  subject: string;
  message: string;
}

/**
 * Contrato de entrega de cotizaciones. En la demo se usan adaptadores mock.
 *
 * PRODUCCIÓN: implementar adaptadores reales:
 *  - EmailDeliveryAdapter -> POST /api/deliveries/email (SendGrid, SES, etc. con adjunto PDF)
 *  - WhatsAppDeliveryAdapter -> WhatsApp Business API / enlace wa.me + almacenamiento público del PDF
 * Inyectarlos mediante DI para reemplazar MockDeliveryAdapter sin tocar los componentes.
 */
export interface DeliveryAdapter {
  readonly channel: 'email' | 'whatsapp';
}

@Injectable({ providedIn: 'root' })
export class QuotationDeliveryService {
  private storage = inject(StorageService);
  private auth = inject(AuthService);
  private pdf = inject(QuotationPdfService);
  private settings = inject(WorkshopSettingsService);
  private readonly key = 'delivery-logs';
  private subject = new BehaviorSubject<DeliveryLog[]>(this.storage.get<DeliveryLog[]>(this.key, []));
  readonly logs$ = this.subject.asObservable();

  logsForQuotation(quotationId: string): Observable<DeliveryLog[]> {
    return this.logs$.pipe(map((l) => l.filter((d) => d.quotationId === quotationId)));
  }

  private record(entry: Omit<DeliveryLog, 'id' | 'createdAt' | 'userId' | 'userName'>): DeliveryLog {
    const user = this.auth.currentUser;
    const log: DeliveryLog = {
      ...entry,
      id: uuid(),
      createdAt: new Date().toISOString(),
      userId: user?.id ?? 'system',
      userName: user?.displayName ?? 'Sistema',
    };
    const items = [...this.subject.value, log];
    this.storage.set(this.key, items);
    this.subject.next(items);
    return log;
  }

  buildEmailDefaults(quotation: Quotation, client: Client): EmailPayload {
    return {
      recipient: client.email,
      subject: `Cotización ${quotation.number} - ${this.settings.current.name}`,
      message:
        `Estimado/a ${client.firstName} ${client.lastName},\n\n` +
        `Adjuntamos la cotización ${quotation.number} por un total de ` +
        `${this.settings.current.currencySymbol} ${quotation.total.toFixed(2)}.\n\n` +
        `Quedamos atentos a sus comentarios.\n\n${this.settings.current.name}`,
    };
  }

  /** MockDeliveryAdapter: registra un envío simulado de correo. */
  sendEmailMock(quotation: Quotation, payload: EmailPayload): Observable<DeliveryLog> {
    const log = this.record({
      quotationId: quotation.id,
      quotationNumber: quotation.number,
      channel: 'email',
      recipient: payload.recipient,
      result: 'simulated',
      message: payload.subject,
    });
    return of(log).pipe(delay(500));
  }

  /** Abre el cliente de correo con mailto (no adjunta archivos). */
  openMailto(payload: EmailPayload): void {
    const url =
      `mailto:${encodeURIComponent(payload.recipient)}` +
      `?subject=${encodeURIComponent(payload.subject)}` +
      `&body=${encodeURIComponent(payload.message)}`;
    window.open(url, '_blank');
  }

  buildWhatsAppMessage(quotation: Quotation, vehicle: Vehicle): string {
    return (
      `Hola, le comparto la cotización ${quotation.number} de ${this.settings.current.name} ` +
      `para su ${vehicle.brand} ${vehicle.model} (${vehicle.plate}). ` +
      `Total: ${this.settings.current.currencySymbol} ${quotation.total.toFixed(2)}.`
    );
  }

  /**
   * Intenta compartir el PDF por Web Share API. Si el navegador no soporta
   * compartir archivos, descarga el PDF y abre WhatsApp con el mensaje.
   * Registra el resultado real (no afirma "enviado" si sólo abrió WhatsApp).
   */
  async shareWhatsApp(
    quotation: Quotation, client: Client, vehicle: Vehicle
  ): Promise<DeliveryLog> {
    const message = this.buildWhatsAppMessage(quotation, vehicle);
    const blob = this.pdf.blob(quotation, client, vehicle);
    const file = new File([blob], `${quotation.number}.pdf`, { type: 'application/pdf' });
    const nav = navigator as Navigator & {
      canShare?: (data?: ShareData) => boolean;
      share?: (data?: ShareData) => Promise<void>;
    };

    if (nav.canShare && nav.canShare({ files: [file] }) && nav.share) {
      try {
        await nav.share({ files: [file], text: message, title: quotation.number });
        return this.record({
          quotationId: quotation.id, quotationNumber: quotation.number, channel: 'whatsapp',
          recipient: client.whatsapp, result: 'shared', message,
        });
      } catch {
        // el usuario canceló: continúa al fallback
      }
    }

    // Fallback: descargar PDF y abrir WhatsApp con el mensaje preparado
    this.pdf.download(quotation, client, vehicle);
    const phone = client.whatsapp.replace(/[^0-9]/g, '');
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
    return this.record({
      quotationId: quotation.id, quotationNumber: quotation.number, channel: 'whatsapp',
      recipient: client.whatsapp, result: 'opened-client', message,
    });
  }
}
