import { Injectable, inject } from '@angular/core';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Client, Quotation, Vehicle } from '../../models';
import { WorkshopSettingsService, LOGO_POR_OMISION } from './workshop-settings.service';
import { amountInWords } from './number-to-words.util';

type RGB = [number, number, number];

const NEGRO: RGB = [0, 0, 0];
const GRIS_BANDA: RGB = [128, 128, 128];
const GRIS_BORDE: RGB = [191, 191, 191];
const ROJO: RGB = [192, 0, 0];
const BLANCO: RGB = [255, 255, 255];

/** Carta en puntos. */
const ANCHO = 612;
const ALTO = 792;
const MARGEN = 36;
const DERECHA = ANCHO - MARGEN;      // 576
const ANCHO_UTIL = DERECHA - MARGEN; // 540

/** Alto del bloque de encabezado, que se repite en cada página. */
const ENCABEZADO_ALTO = 114;
/** Y donde empieza la tabla de artículos. */
const TABLA_Y = 228;

/** Filas mínimas de la tabla, para que el papel se vea como el formato impreso. */
const FILAS_MINIMAS = 14;

/**
 * Genera el PDF de la cotización reproduciendo el formato en papel de Mundo
 * Garage: logo, cuadro No./FECHA, la banda "COTIZACIÓN PARA", los datos del
 * vehículo con los rótulos que se usan en Guatemala (MARCA / LÍNEA / MODELO
 * es el año / C.C.), la tabla y abajo SUBTOTAL, ANTICIPO y TOTAL.
 *
 * Lo que NUNCA sale aquí es el costo del repuesto ni la ganancia: el PDF es
 * el documento que se le manda al cliente.
 */
@Injectable({ providedIn: 'root' })
export class QuotationPdfService {
  private settings = inject(WorkshopSettingsService);

  /** El logo se convierte a data URL una sola vez por sesión. */
  private logoCache = new Map<string, string>();

  private money(n: number): string {
    return (n ?? 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  private async logoDataUrl(): Promise<string | null> {
    const src = this.settings.current.logoDataUrl || LOGO_POR_OMISION;
    if (src.startsWith('data:')) { return src; }
    if (this.logoCache.has(src)) { return this.logoCache.get(src) as string; }
    try {
      const res = await fetch(src);
      if (!res.ok) { return null; }
      const blob = await res.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('logo'));
        reader.readAsDataURL(blob);
      });
      this.logoCache.set(src, dataUrl);
      return dataUrl;
    } catch {
      // Sin logo el PDF sale igual, sólo con el nombre del taller.
      return null;
    }
  }

  // =========================================================================
  // Dibujo
  // =========================================================================

  private celda(
    doc: jsPDF, x: number, y: number, w: number, h: number,
    texto: string,
    opts: { bold?: boolean; align?: 'left' | 'center' | 'right'; size?: number;
            fill?: RGB; color?: RGB; padding?: number } = {}
  ): void {
    const { bold = false, align = 'left', size = 9, fill, color = NEGRO, padding = 6 } = opts;

    if (fill) {
      doc.setFillColor(...fill);
      doc.rect(x, y, w, h, 'F');
    }
    doc.setDrawColor(...GRIS_BORDE);
    doc.setLineWidth(0.8);
    doc.rect(x, y, w, h);

    if (!texto) { return; }
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(...color);

    const tx = align === 'center' ? x + w / 2 : align === 'right' ? x + w - padding : x + padding;
    // Se recorta al ancho de la celda para que un nombre largo no se salga.
    const lineas = doc.splitTextToSize(texto, w - padding * 2) as string[];
    const texto1 = lineas[0] ?? '';
    doc.text(texto1, tx, y + h / 2 + size * 0.35, { align });
  }

  private encabezado(doc: jsPDF, q: Quotation, logo: string | null): void {
    const s = this.settings.current;
    const y = MARGEN;

    // Cuadro del logo
    const logoW = 150;
    this.celda(doc, MARGEN, y, logoW, ENCABEZADO_ALTO, '');
    if (logo) {
      try {
        // 4pt de aire dentro de la celda; la proporción del logo es ~1.65:1
        const w = logoW - 10;
        const h = Math.min(ENCABEZADO_ALTO - 10, w / 1.65);
        doc.addImage(logo, 'JPEG', MARGEN + 5, y + (ENCABEZADO_ALTO - h) / 2, w, h);
      } catch {
        // si la imagen no se puede dibujar, la celda queda vacía
      }
    } else {
      this.celda(doc, MARGEN, y, logoW, ENCABEZADO_ALTO, s.name,
        { bold: true, align: 'center', size: 13 });
    }

    // Centro: título y datos del taller
    const cx = MARGEN + logoW;
    const cw = 230;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(26);
    doc.setTextColor(...NEGRO);
    doc.text('COTIZACIÓN', cx + cw / 2, y + 30, { align: 'center' });

    doc.setFontSize(11);
    doc.text(s.name.toUpperCase(), cx + cw / 2, y + 52, { align: 'center' });

    doc.setFontSize(9);
    if (s.email) {
      doc.setFont('helvetica', 'bold');
      doc.text('Email: ', cx + 24, y + 72);
      doc.setFont('helvetica', 'normal');
      doc.text(s.email, cx + 55, y + 72);
    }
    if (s.phone) {
      doc.setFont('helvetica', 'bold');
      doc.text('Tel: ', cx + cw / 2 - 34, y + 90);
      doc.setFont('helvetica', 'normal');
      doc.text(s.phone, cx + cw / 2 - 12, y + 90);
    }

    // Cuadro No. / FECHA
    const bx = cx + cw;                 // 416
    const bw = DERECHA - bx;            // 160
    const labelW = 84;
    const filaH = 38;
    const by = y + (ENCABEZADO_ALTO - filaH * 2) / 2;

    this.celda(doc, bx, by, labelW, filaH, 'No.', { bold: true, align: 'center', size: 11 });
    this.celda(doc, bx + labelW, by, bw - labelW, filaH, q.number,
      { bold: true, align: 'center', size: 11, color: ROJO });
    this.celda(doc, bx, by + filaH, labelW, filaH, 'FECHA:', { bold: true, align: 'center', size: 11 });
    this.celda(doc, bx + labelW, by + filaH, bw - labelW, filaH,
      new Date(q.date).toLocaleDateString('es-GT'), { align: 'center', size: 10 });
  }

  private datosCliente(doc: jsPDF, q: Quotation, c: Client, v: Vehicle): void {
    const y0 = MARGEN + ENCABEZADO_ALTO;

    // Banda gris
    this.celda(doc, MARGEN, y0, ANCHO_UTIL, 22, 'COTIZACIÓN PARA',
      { bold: true, align: 'center', size: 10.5, fill: GRIS_BANDA, color: BLANCO });

    // Fila 1: NOMBRE / NIT / PLACA
    const y1 = y0 + 22;
    const h = 28;
    const f1 = [78, 150, 55, 110, 60, 87];
    const v1 = [
      'NOMBRE:', `${c.firstName} ${c.lastName}`.trim(),
      'NIT:', c.taxId || 'CF',
      'PLACA:', v.plate,
    ];
    let x = MARGEN;
    f1.forEach((w, i) => {
      const esRotulo = i % 2 === 0;
      this.celda(doc, x, y1, w, h, v1[i], {
        bold: esRotulo, align: esRotulo ? 'left' : 'center', size: esRotulo ? 10 : 9.5,
      });
      x += w;
    });

    // Fila 2: MARCA / LÍNEA / MODELO (=año) / C.C.
    const y2 = y1 + h;
    const f2 = [68, 82, 55, 130, 68, 60, 45, 32];
    const v2 = [
      'MARCA:', v.brand,
      'LINEA:', v.line || v.model,
      'MODELO:', String(v.year || ''),
      'C.C', v.engineSize,
    ];
    x = MARGEN;
    f2.forEach((w, i) => {
      const esRotulo = i % 2 === 0;
      this.celda(doc, x, y2, w, h, v2[i], {
        bold: esRotulo, align: esRotulo ? 'left' : 'center', size: esRotulo ? 10 : 9.5,
      });
      x += w;
    });
    void q;
  }

  // =========================================================================

  async build(quotation: Quotation, client: Client, vehicle: Vehicle): Promise<jsPDF> {
    const logo = await this.logoDataUrl();
    const doc = new jsPDF({ unit: 'pt', format: 'letter' });

    // Cuerpo de la tabla. Se rellenan filas vacías hasta el mínimo para que el
    // documento se vea como el formato impreso aunque lleve dos renglones.
    const body: string[][] = quotation.items.map((it) => [
      this.formatQty(it.quantity),
      it.name + (it.note ? `\n${it.note}` : ''),
      this.money(it.unitPrice),
      this.money(it.subtotal),
    ]);
    const faltan = Math.max(0, FILAS_MINIMAS - body.length);
    for (let i = 0; i < faltan; i++) { body.push(['', '', '', '']); }

    autoTable(doc, {
      startY: TABLA_Y,
      margin: { top: TABLA_Y, left: MARGEN, right: MARGEN, bottom: 150 },
      head: [['CANT', 'DESCRIPCIÓN', 'COSTO UNITARIO', 'SUBTOTAL']],
      body,
      theme: 'grid',
      styles: {
        fontSize: 9, cellPadding: { top: 5, bottom: 5, left: 5, right: 5 },
        textColor: NEGRO, lineColor: GRIS_BORDE, lineWidth: 0.8,
        minCellHeight: 22, valign: 'middle',
      },
      headStyles: {
        fillColor: GRIS_BANDA, textColor: BLANCO, fontStyle: 'bold',
        halign: 'center', valign: 'middle', minCellHeight: 34, fontSize: 9.5,
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 46 },
        1: { halign: 'center', cellWidth: 300 },
        2: { halign: 'right', cellWidth: 97 },
        3: { halign: 'right', cellWidth: 97 },
      },
      didDrawPage: () => {
        this.encabezado(doc, quotation, logo);
        this.datosCliente(doc, quotation, client, vehicle);
      },
    });

    this.totales(doc, quotation);
    this.piePaginas(doc);
    return doc;
  }

  private formatQty(q: number): string {
    return Number.isInteger(q) ? String(q) : String(q);
  }

  private totales(doc: jsPDF, q: Quotation): void {
    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
    const filaH = 26;

    // Si los tres renglones de totales no caben, se pasan a una página nueva.
    let y = finalY;
    if (y + filaH * 3 + 30 > ALTO - MARGEN - 24) {
      doc.addPage();
      y = TABLA_Y;
    }

    const etiquetaW = 146;
    const valorW = 97;
    const etiquetaX = DERECHA - etiquetaW - valorW;
    const valorX = DERECHA - valorW;

    // Celda vacía grande a la izquierda, como en el formato impreso.
    this.celda(doc, MARGEN, y, etiquetaX - MARGEN, filaH * 3, '');

    this.celda(doc, etiquetaX, y, etiquetaW, filaH, 'SUBTOTAL:', { bold: true, align: 'right', size: 10 });
    this.celda(doc, valorX, y, valorW, filaH, this.money(q.subtotal), { align: 'right', size: 10 });

    this.celda(doc, etiquetaX, y + filaH, etiquetaW, filaH, 'ANTICIPO:', { bold: true, align: 'right', size: 10 });
    this.celda(doc, valorX, y + filaH, valorW, filaH, q.advance ? this.money(q.advance) : '',
      { align: 'right', size: 10 });

    this.celda(doc, etiquetaX, y + filaH * 2, etiquetaW, filaH, 'TOTAL:',
      { bold: true, align: 'right', size: 11, color: ROJO });
    this.celda(doc, valorX, y + filaH * 2, valorW, filaH, this.money(q.total),
      { bold: true, align: 'right', size: 11 });

    // Cantidad con letra
    let yy = y + filaH * 3;
    this.celda(doc, MARGEN, yy, ANCHO_UTIL, filaH, '');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...NEGRO);
    doc.text('CANTIDAD CON LETRA:', MARGEN + 6, yy + filaH / 2 + 3);
    doc.setFont('helvetica', 'normal');
    doc.text(amountInWords(q.total), MARGEN + 140, yy + filaH / 2 + 3);
    yy += filaH;

    // Método de pago
    this.celda(doc, MARGEN, yy, ANCHO_UTIL, filaH, '');
    doc.setFont('helvetica', 'bold');
    doc.text('MÉTODO DE PAGO:', MARGEN + 6, yy + filaH / 2 + 3);
    doc.setFont('helvetica', 'normal');
    doc.text(q.paymentMethod || 'Efectivo', MARGEN + 140, yy + filaH / 2 + 3);
    yy += filaH;

    if (q.considerations || q.notes) {
      const texto = [q.considerations, q.notes].filter(Boolean).join('  ·  ');
      const lineas = doc.splitTextToSize(texto, ANCHO_UTIL - 12) as string[];
      const alto = Math.max(filaH, 14 + lineas.length * 11);
      this.celda(doc, MARGEN, yy, ANCHO_UTIL, alto, '');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('OBSERVACIONES:', MARGEN + 6, yy + 14);
      doc.setFont('helvetica', 'normal');
      doc.text(lineas, MARGEN + 100, yy + 14);
      yy += alto;
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(110, 110, 110);
    doc.text(`Vigencia de esta cotización: ${q.validityDays} días.`, MARGEN, yy + 14);
  }

  private piePaginas(doc: jsPDF): void {
    const s = this.settings.current;
    const total = doc.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(130, 130, 130);
      const pie = [s.name, s.phone && `Tel: ${s.phone}`, s.email].filter(Boolean).join('  |  ');
      doc.text(pie, MARGEN, ALTO - 22);
      doc.text(`Página ${i} de ${total}`, DERECHA, ALTO - 22, { align: 'right' });
    }
  }

  // =========================================================================
  // Salidas
  // =========================================================================

  async blobUrl(quotation: Quotation, client: Client, vehicle: Vehicle): Promise<string> {
    const doc = await this.build(quotation, client, vehicle);
    return doc.output('bloburl').toString();
  }

  async download(quotation: Quotation, client: Client, vehicle: Vehicle): Promise<void> {
    const doc = await this.build(quotation, client, vehicle);
    doc.save(this.fileName(quotation, vehicle));
  }

  async blob(quotation: Quotation, client: Client, vehicle: Vehicle): Promise<Blob> {
    const doc = await this.build(quotation, client, vehicle);
    return doc.output('blob');
  }

  /** Nombre con placa para que el cliente lo reconozca en su teléfono. */
  fileName(quotation: Quotation, vehicle?: Vehicle): string {
    const placa = vehicle?.plate ? '-' + vehicle.plate.replace(/[^A-Za-z0-9]/g, '') : '';
    return `${quotation.number}${placa}.pdf`;
  }
}
