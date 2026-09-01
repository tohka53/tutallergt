import { Injectable, inject } from '@angular/core';
import { Client, Quotation, Vehicle } from '../../models';
import { QuotationPdfService } from './quotation-pdf.service';
import { WorkshopSettingsService } from './workshop-settings.service';

export type DeliveryOutcome = 'shared' | 'downloaded' | 'cancelled';

export interface DeliveryResult {
  outcome: DeliveryOutcome;
  message: string;
}

/**
 * Envío de la cotización por WhatsApp.
 *
 * WhatsApp no deja adjuntar un archivo desde un enlace wa.me — sólo texto. La
 * única forma de que el PDF viaje dentro del mismo mensaje es el selector del
 * sistema (Web Share API con archivos), que en el teléfono abre WhatsApp con
 * el PDF ya adjunto y el texto escrito. Eso es lo que se intenta primero,
 * porque es donde el mecánico realmente usa esto.
 *
 * En una computadora ese selector no existe, así que se descarga el PDF y se
 * abre WhatsApp Web con el mensaje listo: sólo falta arrastrar el archivo.
 */
@Injectable({ providedIn: 'root' })
export class QuotationDeliveryService {
  private pdf = inject(QuotationPdfService);
  private settings = inject(WorkshopSettingsService);

  /** "Tu cotización para Honda CR-V LX 4WD · Placa P-234ABC". */
  describeVehicle(vehicle: Vehicle): string {
    const linea = vehicle.line || vehicle.model;
    return [vehicle.brand, linea, vehicle.year ? String(vehicle.year) : '']
      .filter(Boolean)
      .join(' ');
  }

  buildMessage(quotation: Quotation, client: Client, vehicle: Vehicle): string {
    const s = this.settings.current;
    const saludo = client.firstName ? `Hola ${client.firstName}, ` : 'Hola, ';
    return (
      `${saludo}tu cotización para ${this.describeVehicle(vehicle)} ` +
      `(placa ${vehicle.plate}).\n\n` +
      `No. ${quotation.number}\n` +
      `Total: ${s.currencySymbol} ${quotation.total.toLocaleString('es-GT', {
        minimumFractionDigits: 2, maximumFractionDigits: 2,
      })}\n\n` +
      `Cualquier duda me avisas.\n${s.name}`
    );
  }

  /** Número del cliente en formato internacional, listo para wa.me. */
  private waNumber(client: Client): string {
    const raw = (client.whatsapp || client.phone || '').replace(/[^0-9]/g, '');
    if (!raw) { return ''; }
    // Un número guatemalteco escrito sin código de país lleva 8 dígitos.
    return raw.length === 8 ? '502' + raw : raw;
  }

  /**
   * Intenta compartir el PDF con el selector del sistema; si no se puede,
   * descarga el archivo y abre WhatsApp con el mensaje.
   */
  async send(quotation: Quotation, client: Client, vehicle: Vehicle): Promise<DeliveryResult> {
    const message = this.buildMessage(quotation, client, vehicle);
    const blob = await this.pdf.blob(quotation, client, vehicle);
    const file = new File([blob], this.pdf.fileName(quotation, vehicle), { type: 'application/pdf' });

    const nav = navigator as Navigator & {
      canShare?: (data?: ShareData) => boolean;
      share?: (data?: ShareData) => Promise<void>;
    };

    if (nav.share && nav.canShare?.({ files: [file] })) {
      try {
        await nav.share({ files: [file], text: message, title: quotation.number });
        return { outcome: 'shared', message: 'Cotización compartida con el PDF adjunto.' };
      } catch (e) {
        // AbortError = el usuario cerró el selector. No es un fallo: no se
        // abre WhatsApp por detrás, porque no era lo que quería.
        if ((e as Error)?.name === 'AbortError') {
          return { outcome: 'cancelled', message: 'Envío cancelado.' };
        }
      }
    }

    await this.pdf.download(quotation, client, vehicle);
    const numero = this.waNumber(client);
    const url = numero
      ? `https://wa.me/${numero}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');

    return {
      outcome: 'downloaded',
      message: 'Se descargó el PDF y se abrió WhatsApp: adjunta el archivo descargado al chat.',
    };
  }

  /** Sólo el texto, para copiarlo o mandarlo por otro medio. */
  openWhatsAppText(quotation: Quotation, client: Client, vehicle: Vehicle): void {
    const numero = this.waNumber(client);
    const message = this.buildMessage(quotation, client, vehicle);
    const url = numero
      ? `https://wa.me/${numero}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  }
}
