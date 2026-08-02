import { Component, Input } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { SortDirection } from '@angular/material/sort';

export interface MobileSortOption {
  /** Nombre de la columna (matColumnDef). */
  id: string;
  dir: SortDirection;
  label: string;
}

/**
 * Selector de ordenamiento visible solo en móvil.
 * En pantallas pequeñas la cabecera de la tabla se oculta (cada fila se muestra
 * como tarjeta), así que este control reemplaza a los encabezados ordenables.
 */
@Component({
  selector: 'app-mobile-sort',
  standalone: false,
  template: `
    <mat-form-field class="tc-full" subscriptSizing="dynamic">
      <mat-label>Ordenar por</mat-label>
      <mat-select [value]="value" (selectionChange)="apply($event.value)">
        <mat-option *ngFor="let o of options" [value]="key(o)">{{ o.label }}</mat-option>
      </mat-select>
      <mat-icon matSuffix>swap_vert</mat-icon>
    </mat-form-field>
  `,
  styles: [`
    :host { display: none; }
    @media (max-width: 900px) { :host { display: block; margin-bottom: 12px; } }
  `],
})
export class MobileSortComponent {
  /** Se usa el dataSource (referencia estable) en lugar del MatSort del padre. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  @Input() dataSource?: MatTableDataSource<any>;
  @Input() options: MobileSortOption[] = [];

  value = '';

  key(option: MobileSortOption): string { return `${option.id}:${option.dir}`; }

  apply(value: string): void {
    this.value = value;
    const sort = this.dataSource?.sort;
    if (!sort) { return; }
    const [active, direction] = value.split(':');
    sort.active = active;
    sort.direction = direction as SortDirection;
    sort.sortChange.emit({ active, direction: direction as SortDirection });
  }
}
