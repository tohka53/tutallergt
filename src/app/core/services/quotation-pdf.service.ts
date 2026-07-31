import { Injectable, inject } from '@angular/core';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Client, Quotation, Vehicle } from '../../models';
import { WorkshopSettingsService } from './workshop-settings.service';
import { numberToWords } from './number-to-words.util';

/**
 * Genera el PDF de la cotización con jsPDF + jspdf-autotable.
 * Colores de marca: negro, amarillo, blanco y azul.
 * La tabla crece dinámicamente y continúa en la siguiente página automáticamente.
 */
@Injectable({ providedIn: 'root' })
export class QuotationPdfService {
  private settings = inject(WorkshopSettingsService);

  private money(n: number): string {
    return this.settings.current.currencySymbol + ' ' +
      n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  build(quotation: Quotation, client: Client, vehicle: Vehicle): jsPDF {
    const s = this.settings.current;
    const doc = new jsPDF({ unit: 'pt', format: 'letter' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const marginX = 40;

    const BLACK: [number, number, number] = [17, 17, 17];
    const YELLOW: [number, number, number] = [255, 193, 7];
    const BLUE: [number, number, number] = [21, 101, 192];
    const GRAY: [number, number, number] = [107, 119, 133];

    // ===== Encabezado =====
    doc.setFillColor(...BLACK);
    doc.rect(0, 0, pageWidth, 90, 'F');
    doc.setFillColor(...YELLOW);
    doc.rect(0, 90, pageWidth, 4, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text(s.name, marginX, 38);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(220, 220, 220);
    doc.text(s.address, marginX, 54);
    doc.text(`Tel: ${s.phone}   |   ${s.email}`, marginX, 66);
    doc.text(`NIT: ${s.taxId}`, marginX, 78);

    doc.setTextColor(...YELLOW);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.text('COTIZACIÓN', pageWidth - marginX, 38, { align: 'right' });
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text(quotation.number, pageWidth - marginX, 56, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Fecha: ' + new Date(quotation.date).toLocaleDateString('es-GT'),
      pageWidth - marginX, 70, { align: 'right' });

    // ===== Datos cliente / vehículo =====
    let y = 118;
    doc.setTextColor(...BLUE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('CLIENTE', marginX, y);
    doc.text('VEHÍCULO', pageWidth / 2 + 10, y);
    doc.setDrawColor(...YELLOW);
    doc.setLineWidth(1.5);
    doc.line(marginX, y + 4, marginX + 60, y + 4);
    doc.line(pageWidth / 2 + 10, y + 4, pageWidth / 2 + 70, y + 4);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...BLACK);
    y += 20;
    const clientLines = [
      `${client.firstName} ${client.lastName}`,
      `NIT/CF: ${client.taxId}`,
      `Tel: ${client.phone}`,
      `Correo: ${client.email}`,
    ];
    const vehicleLines = [
      `Placa: ${vehicle.plate}`,
      `${vehicle.brand} ${vehicle.model} ${vehicle.year}`,
      `Cilindraje: ${vehicle.engineSize}`,
      `Kilometraje: ${quotation.mileage.toLocaleString('es-GT')} km`,
    ];
    clientLines.forEach((line, i) => doc.text(line, marginX, y + i * 13));
    vehicleLines.forEach((line, i) => doc.text(line, pageWidth / 2 + 10, y + i * 13));

    // ===== Tabla de artículos =====
    const body = quotation.items.map((it) => [
      it.quantity.toString(),
      it.name + (it.note ? `\n${it.note}` : ''),
      this.typeLabel(it.type),
      this.money(it.unitPrice),
      this.money(it.discount),
      this.money(it.subtotal),
    ]);

    autoTable(doc, {
      startY: y + 60,
      head: [['Cant.', 'Descripción', 'Tipo', 'Costo unit.', 'Desc.', 'Subtotal']],
      body,
      margin: { left: marginX, right: marginX },
      styles: { fontSize: 8.5, cellPadding: 5, textColor: BLACK, lineColor: [225, 225, 225], lineWidth: 0.5 },
      headStyles: { fillColor: BLUE, textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { halign: 'center', cellWidth: 40 },
        1: { cellWidth: 'auto' },
        2: { halign: 'center', cellWidth: 70 },
        3: { halign: 'right', cellWidth: 75 },
        4: { halign: 'right', cellWidth: 60 },
        5: { halign: 'right', cellWidth: 75 },
      },
      didDrawPage: (data) => {
        const page = doc.getNumberOfPages();
        doc.setFontSize(8);
        doc.setTextColor(...GRAY);
        doc.text(
          `${s.name}  |  Tel: ${s.phone}  |  ${s.email}`,
          marginX, doc.internal.pageSize.getHeight() - 24
        );
        doc.text(
          `Página ${data.pageNumber} de ${page}`,
          pageWidth - marginX, doc.internal.pageSize.getHeight() - 24, { align: 'right' }
        );
      },
    });

    // ===== Totales =====
    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 16;
    const boxX = pageWidth - marginX - 230;
    const rows: Array<[string, string]> = [
      ['Subtotal repuestos:', this.money(quotation.partsSubtotal)],
      ['Subtotal mano de obra:', this.money(quotation.laborSubtotal)],
      ['Descuentos:', '- ' + this.money(quotation.discountTotal)],
    ];
    if (quotation.applyTax) {
      rows.push([`Impuesto (${quotation.taxRate}%):`, this.money(quotation.taxAmount)]);
    }

    let ty = finalY;
    doc.setFontSize(9);
    doc.setTextColor(...BLACK);
    rows.forEach(([label, val]) => {
      doc.setFont('helvetica', 'normal');
      doc.text(label, boxX, ty);
      doc.text(val, pageWidth - marginX, ty, { align: 'right' });
      ty += 15;
    });

    doc.setFillColor(...YELLOW);
    doc.rect(boxX - 10, ty - 11, 240, 22, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...BLACK);
    doc.text('TOTAL:', boxX, ty + 4);
    doc.text(this.money(quotation.total), pageWidth - marginX, ty + 4, { align: 'right' });
    ty += 30;

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(...GRAY);
    const words = doc.splitTextToSize('Son: ' + numberToWords(quotation.total), pageWidth - marginX * 2);
    doc.text(words, marginX, ty);
    ty += words.length * 11 + 8;

    // ===== Información adicional =====
    doc.setTextColor(...BLACK);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Forma de pago: ', marginX, ty);
    doc.setFont('helvetica', 'normal');
    doc.text(quotation.paymentMethod || 'No especificado', marginX + 78, ty);
    doc.setFont('helvetica', 'bold');
    doc.text('Vigencia: ', pageWidth / 2, ty);
    doc.setFont('helvetica', 'normal');
    doc.text(`${quotation.validityDays} días`, pageWidth / 2 + 48, ty);
    ty += 16;

    if (quotation.considerations) {
      ty = this.wrapBlock(doc, 'Consideraciones:', quotation.considerations, marginX, ty, pageWidth - marginX * 2);
    }
    if (quotation.notes) {
      ty = this.wrapBlock(doc, 'Observaciones:', quotation.notes, marginX, ty, pageWidth - marginX * 2);
    }

    // Firma
    ty = Math.max(ty + 30, doc.internal.pageSize.getHeight() - 90);
    doc.setDrawColor(...BLACK);
    doc.setLineWidth(0.7);
    doc.line(marginX, ty, marginX + 200, ty);
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.text('Firma / Autorización del cliente', marginX, ty + 12);

    return doc;
  }

  private wrapBlock(doc: jsPDF, title: string, text: string, x: number, y: number, maxW: number): number {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(17, 17, 17);
    doc.text(title, x, y);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(text, maxW);
    doc.text(lines, x, y + 12);
    return y + 12 + lines.length * 11 + 6;
  }

  private typeLabel(type: string): string {
    switch (type) {
      case 'part': return 'Repuesto';
      case 'material': return 'Material';
      case 'labor': return 'Mano obra';
      default: return 'Otro';
    }
  }

  blobUrl(quotation: Quotation, client: Client, vehicle: Vehicle): string {
    return this.build(quotation, client, vehicle).output('bloburl').toString();
  }

  download(quotation: Quotation, client: Client, vehicle: Vehicle): void {
    this.build(quotation, client, vehicle).save(`${quotation.number}.pdf`);
  }

  blob(quotation: Quotation, client: Client, vehicle: Vehicle): Blob {
    return this.build(quotation, client, vehicle).output('blob');
  }
}
