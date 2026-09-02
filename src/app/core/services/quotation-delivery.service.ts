import { Injectable, inject } from '@angular/core';
import { Client, Quotation, Vehicle } from '../../models';
import { QuotationPdfService } from './quotation-pdf.service';
import { WorkshopSettingsService } from './workshop-settings.service';

export type DeliveryOutcome = 'shared' | 'opened' | 'blocked' | 'cancelled';

/**
 * ¿Es un teléfono o una tablet de verdad?
 *
 * Why: Chrome de macOS y de Windows también implementan `navigator.share` con
 * archivos, así que preguntar sólo "¿puede compartir?" hace que en la
 * computadora se abra el panel de compartir del sistema — donde WhatsApp casi
 * nunca aparece como destino — en lugar de WhatsApp Web. En el escritorio lo
 * que el mecánico quiere es WhatsApp Web con el mensaje escrito.
 *
 * Función pura para poder probarla con distintos navegadores sin un navegador.
 */
export function esDispositivoTactil(userAgent: string, maxTouchPoints: number): boolean {
  const ua = userAgent || '';
  if (/Android|iPhone|iPod|iPad/i.test(ua)) { return true; }
  // El iPad moderno se anuncia como "Macintosh": se delata por el táctil.
  if (/Macintosh/i.test(ua) && maxTouchPoints > 1) { return true; }
  return maxTouchPoints > 0 && /Mobile|Tablet/i.test(ua);
}

export interface DeliveryResult {
  outcome: DeliveryOutcome;
  message: string;
  /** Enlace de respaldo cuando el navegador bloqueó la ventana emergente. */
  url?: string;
}

/**
 * Envío de la cotización por WhatsApp.
 *
 * WhatsApp NO deja adjuntar un archivo desde un enlace wa.me: sólo texto. La
 * única forma de que el PDF viaje dentro del mismo mensaje es el selector del
 * sistema (Web Share API con archivos), que en el teléfono abre WhatsApp con el
 * PDF ya adjunto. En computadora ese selector no existe, así que se abre
 * WhatsApp Web con el mensaje y se descarga el PDF para arrastrarlo.
 *
 * ## Por qué esto es tan quisquilloso con el momento
 *
 * Tanto `navigator.share()` como `window.open()` sólo funcionan mientras el
 * navegador considera que está atendiendo un clic del usuario ("activación
 * transitoria"). Si primero se genera el PDF con `await` y después se llama a
 * cualquiera de los dos, Chrome ya perdió esa activación y **bloquea la ventana
 * en silencio**: no sale error, simplemente no pasa nada.
 *
 * Por eso el PDF se prepara ANTES (ver `prepareFile`, que la pantalla llama al
 * cargar) y los métodos de envío son SÍNCRONOS: no hay ningún `await` entre el
 * clic y la llamada al navegador.
 */
@Injectable({ providedIn: 'root' })
export class QuotationDeliveryService {
  private pdf = inject(QuotationPdfService);
  private settings = inject(WorkshopSettingsService);

  /** "Honda CR-V LX 4WD 2011". */
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

  /**
   * Número del cliente en formato internacional, listo para wa.me.
   * Devuelve '' si no hay número: en ese caso wa.me abre WhatsApp con el
   * mensaje escrito para que el mecánico elija el contacto a mano.
   */
  waNumber(client: Client): string {
    const raw = (client.whatsapp || client.phone || '').replace(/[^0-9]/g, '');
    if (raw.length < 8) { return ''; }
    // Un número guatemalteco escrito sin código de país lleva 8 dígitos.
    return raw.length === 8 ? '502' + raw : raw;
  }

  whatsappUrl(quotation: Quotation, client: Client, vehicle: Vehicle): string {
    const numero = this.waNumber(client);
    const texto = encodeURIComponent(this.buildMessage(quotation, client, vehicle));
    return numero ? `https://wa.me/${numero}?text=${texto}` : `https://wa.me/?text=${texto}`;
  }

  // =========================================================================
  // Preparación (lenta, con await) — se hace ANTES del clic
  // =========================================================================

  /** Arma el PDF como archivo para poder compartirlo después sin esperas. */
  async prepareFile(quotation: Quotation, client: Client, vehicle: Vehicle): Promise<File> {
    const blob = await this.pdf.blob(quotation, client, vehicle);
    return new File([blob], this.pdf.fileName(quotation, vehicle), { type: 'application/pdf' });
  }

  /**
   * ¿Conviene mandar el PDF adjunto por el selector del sistema?
   *
   * Sólo en teléfono o tablet. En la computadora el selector existe pero abre
   * el panel del sistema, donde WhatsApp no suele estar: ahí es mucho mejor
   * WhatsApp Web con el mensaje ya escrito.
   */
  canShareFile(file: File | undefined): boolean {
    if (!file) { return false; }
    const nav = navigator as Navigator & {
      canShare?: (data?: ShareData) => boolean;
      share?: (data?: ShareData) => Promise<void>;
      maxTouchPoints?: number;
    };
    if (!esDispositivoTactil(nav.userAgent ?? '', nav.maxTouchPoints ?? 0)) { return false; }
    try {
      return !!nav.share && !!nav.canShare?.({ files: [file] });
    } catch {
      return false;
    }
  }

  // =========================================================================
  // Envío (síncrono: se llama dentro del clic)
  // =========================================================================

  /**
   * Teléfono: abre el selector del sistema con el PDF adjunto.
   * Se llama SIN await previo, para no perder la activación del clic.
   */
  shareFile(file: File, quotation: Quotation, client: Client, vehicle: Vehicle): Promise<DeliveryResult> {
    const message = this.buildMessage(quotation, client, vehicle);
    const nav = navigator as Navigator & { share: (data?: ShareData) => Promise<void> };
    return nav
      .share({ files: [file], text: message, title: quotation.number })
      .then<DeliveryResult>(() => ({
        outcome: 'shared',
        message: 'Cotización compartida con el PDF adjunto.',
      }))
      .catch<DeliveryResult>((e: Error) => {
        // AbortError = cerró el selector. No es un fallo y no se abre WhatsApp
        // por detrás, porque no era lo que quería.
        if (e?.name === 'AbortError') {
          return { outcome: 'cancelled', message: 'Envío cancelado.' };
        }
        return this.openWhatsApp(quotation, client, vehicle);
      });
  }

  /**
   * Computadora: abre WhatsApp Web con el mensaje ya escrito.
   * Síncrono a propósito. Si el navegador bloqueó la ventana emergente lo
   * decimos, en vez de dejar al mecánico esperando algo que nunca pasó.
   */
  openWhatsApp(quotation: Quotation, client: Client, vehicle: Vehicle): DeliveryResult {
    const url = this.whatsappUrl(quotation, client, vehicle);
    // Sin 'noopener' a propósito: con esa opción window.open devuelve null
    // SIEMPRE, aunque la ventana se haya abierto bien, y no habría forma de
    // distinguir "abrió" de "el navegador lo bloqueó".
    const win = window.open(url, '_blank');

    if (!win || win.closed) {
      return {
        outcome: 'blocked',
        message: 'El navegador bloqueó la ventana de WhatsApp.',
        url,
      };
    }
    return {
      outcome: 'opened',
      message: 'Se abrió WhatsApp con el mensaje escrito. Adjunta el PDF descargado.',
      url,
    };
  }

  /** Descarga el PDF. Va después de abrir WhatsApp: esto sí puede esperar. */
  async downloadPdf(quotation: Quotation, client: Client, vehicle: Vehicle): Promise<void> {
    await this.pdf.download(quotation, client, vehicle);
  }
}
