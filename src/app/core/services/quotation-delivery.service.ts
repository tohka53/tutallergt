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
  /** Computadora = todo lo que no sea teléfono ni tablet. */
  esEscritorio(): boolean {
    const nav = navigator as Navigator & { maxTouchPoints?: number };
    return !esDispositivoTactil(nav.userAgent ?? '', nav.maxTouchPoints ?? 0);
  }

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
    const url = this.whatsappUrl(quotation, client, vehicle);
    const nav = navigator as Navigator & { share: (data?: ShareData) => Promise<void> };
    return nav
      .share({ files: [file], text: message, title: quotation.number })
      .then<DeliveryResult>(() => ({
        outcome: 'shared',
        message: 'Cotización compartida con el PDF adjunto.',
        url,
      }))
      .catch<DeliveryResult>((e: Error) => {
        // AbortError = cerró el selector. No es un fallo y no se abre WhatsApp
        // por detrás, porque no era lo que quería. Pero SÍ se devuelve la url:
        // puede haberlo cerrado justamente porque WhatsApp no aparecía en la
        // lista, como pasa en el panel de compartir de macOS.
        if (e?.name === 'AbortError') {
          return { outcome: 'cancelled', message: 'Se cerró el panel de compartir.', url };
        }
        return this.openWhatsApp(quotation, client, vehicle);
      });
  }

  /**
   * Computadora: abre WhatsApp Web con el mensaje ya escrito.
   *
   * Se hace con un enlace de verdad (`<a target="_blank">`) y no con
   * `window.open`. Why: el navegador trata el clic sobre un enlace como
   * navegación normal, mientras que una ventana emergente puede quedar
   * bloqueada por la configuración del sitio, por una extensión o por el
   * sistema — y en Chrome eso pasa en silencio: sin error y sin pestaña. Con
   * un enlace no hay ventana emergente que bloquear.
   *
   * Aun así se devuelve la `url`, porque la pantalla SIEMPRE muestra el enlace
   * a la vista después de enviar. Si algo se lo tragó, hay dónde hacer clic en
   * vez de quedarse mirando un botón que "no hace nada".
   */
  openWhatsApp(quotation: Quotation, client: Client, vehicle: Vehicle): DeliveryResult {
    const url = this.whatsappUrl(quotation, client, vehicle);
    this.abrirEnlace(url);
    return {
      outcome: 'opened',
      message: 'Se abrió WhatsApp con el mensaje escrito. Adjunta el PDF descargado.',
      url,
    };
  }

  /** Crea un enlace, lo pulsa y lo quita. Más confiable que window.open. */
  private abrirEnlace(url: string): void {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  /** Descarga el PDF. Va después de abrir WhatsApp: esto sí puede esperar. */
  async downloadPdf(quotation: Quotation, client: Client, vehicle: Vehicle): Promise<void> {
    await this.pdf.download(quotation, client, vehicle);
  }

  // =========================================================================
  // Imagen al portapapeles (el único adjunto posible desde la computadora)
  // =========================================================================

  /**
   * ¿Se puede dejar la cotización en el portapapeles como imagen?
   *
   * El portapapeles del navegador sólo admite unos pocos formatos y **PDF no
   * es uno**; PNG sí. Por eso el adjunto de escritorio es una imagen: WhatsApp
   * Web acepta que se pegue y la manda dentro del mismo mensaje.
   */
  canCopyImage(): boolean {
    return typeof ClipboardItem !== 'undefined'
      && typeof navigator.clipboard?.write === 'function';
  }

  /**
   * Copia la imagen. Devuelve false en vez de lanzar: que falle el
   * portapapeles no debe romper el envío, que igual abre WhatsApp.
   *
   * Se llama ANTES de abrir WhatsApp: el navegador exige que el documento esté
   * enfocado al momento de escribir, y abrir la otra pestaña le quita el foco.
   */
  copyImage(blob: Blob): Promise<boolean> {
    if (!this.canCopyImage()) { return Promise.resolve(false); }
    try {
      return navigator.clipboard
        .write([new ClipboardItem({ 'image/png': blob })])
        .then(() => true)
        .catch(() => false);
    } catch {
      return Promise.resolve(false);
    }
  }

  /** "⌘V" en Mac, "Ctrl+V" en el resto. */
  atajoPegar(): string {
    return /Mac|iPhone|iPad/i.test(navigator.userAgent ?? '') ? '⌘V' : 'Ctrl+V';
  }
}
