import { Pipe, PipeTransform } from '@angular/core';

/** Formatea un número como moneda guatemalteca: Q 1,234.50 */
@Pipe({ name: 'gtq', standalone: false })
export class GtqPipe implements PipeTransform {
  transform(value: number | null | undefined, symbol = 'Q'): string {
    const n = value ?? 0;
    return `${symbol} ${n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}
