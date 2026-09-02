import { Injectable, inject } from '@angular/core';
import { Client, Quotation, Vehicle } from '../../models';
import { QuotationPdfService } from './quotation-pdf.service';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Convierte la cotización en una IMAGEN PNG.
 *
 * ¿Para qué, si ya hay PDF? Porque desde la computadora WhatsApp no acepta
 * adjuntos por enlace: un `wa.me` sólo lleva texto. Pero WhatsApp Web sí acepta
 * que se PEGUE una imagen desde el portapapeles, y el portapapeles del
 * navegador sólo admite unos pocos formatos — PNG entre ellos, PDF no. Así que
 * la imagen es la única manera de que la cotización viaje dentro del mismo
 * mensaje sin salir del navegador.
 *
 * Se rasteriza el PDF ya generado en vez de dibujar la cotización otra vez.
 * Why: así la imagen y el PDF no pueden desincronizarse nunca; lo que el
 * cliente ve pegado en el chat es exactamente el documento.
 */
@Injectable({ providedIn: 'root' })
export class QuotationImageService {
  private pdf = inject(QuotationPdfService);

  /**
   * 2x sobre el tamaño carta da ~1224×1584 px: se lee cómodo al ampliarlo en
   * el teléfono y pesa unos cientos de KB. A 3x el archivo se dispara sin que
   * se note en pantalla.
   */
  private readonly escala = 2;

  private pdfjs?: any;

  private async cargarPdfjs(): Promise<any> {
    if (this.pdfjs) { return this.pdfjs; }
    // Importación dinámica: la librería es pesada y sólo hace falta en la
    // pantalla de detalle, y sólo en computadora. Se importa el paquete y no
    // `build/pdf.min.mjs` porque sólo el paquete trae los tipos; la
    // compilación de producción lo minifica igual.
    const lib = await import('pdfjs-dist');
    // El worker se copia a assets desde angular.json. Sin esto pdf.js intenta
    // adivinar la ruta y falla en producción, donde los nombres van con hash.
    lib.GlobalWorkerOptions.workerSrc = 'assets/pdf.worker.min.mjs';
    this.pdfjs = lib;
    return lib;
  }

  /** PNG de la primera página. Es la que lleva el total y los datos del vehículo. */
  async build(quotation: Quotation, client: Client, vehicle: Vehicle): Promise<Blob> {
    const blob = await this.pdf.blob(quotation, client, vehicle);
    const datos = new Uint8Array(await blob.arrayBuffer());

    const pdfjs = await this.cargarPdfjs();
    const doc = await pdfjs.getDocument({ data: datos }).promise;
    try {
      const page = await doc.getPage(1);
      const viewport = page.getViewport({ scale: this.escala });

      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) { throw new Error('No se pudo preparar la imagen.'); }

      // El PDF no pinta fondo: sin esto la imagen sale con fondo transparente
      // y WhatsApp la muestra sobre negro, ilegible.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({ canvasContext: ctx, viewport }).promise;

      return await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('No se pudo generar la imagen.'))),
          'image/png'
        );
      });
    } finally {
      await doc.destroy();
    }
  }
}
