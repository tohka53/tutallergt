import { AfterViewInit, Component, OnInit, ViewChild, inject } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatDialog } from '@angular/material/dialog';
import { FormControl } from '@angular/forms';
import { combineLatest, startWith } from 'rxjs';
import { PartsCatalogService } from '../../core/services/parts-catalog.service';
import { NotificationService } from '../../core/services/notification.service';
import { PartCatalogItem } from '../../models';
import { PartFormDialogComponent } from '../form/part-form-dialog.component';

@Component({
  selector: 'app-parts-catalog-list',
  standalone: false,
  templateUrl: './parts-catalog-list.component.html',
})
export class PartsCatalogListComponent implements OnInit, AfterViewInit {
  private catalog = inject(PartsCatalogService);
  private dialog = inject(MatDialog);
  private notify = inject(NotificationService);

  loading = true;
  search = new FormControl('', { nonNullable: true });
  categoryFilter = new FormControl('all', { nonNullable: true });
  displayedColumns = ['code', 'name', 'category', 'type', 'price', 'status', 'actions'];
  dataSource = new MatTableDataSource<PartCatalogItem>([]);
  categories = this.catalog.categories;

  typeLabels: Record<string, string> = {
    part: 'Repuesto', material: 'Material', lubricant: 'Lubricante', labor: 'Mano de obra', other: 'Otro',
  };

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  ngOnInit(): void {
    combineLatest([
      this.catalog.items$,
      this.search.valueChanges.pipe(startWith('')),
      this.categoryFilter.valueChanges.pipe(startWith('all')),
    ]).subscribe(([items, term, category]) => {
      const t = (term ?? '').trim().toLowerCase();
      this.dataSource.data = items.filter((i) => {
        const matchText = [i.name, i.code, i.description].join(' ').toLowerCase().includes(t);
        const matchCat = category === 'all' || i.category === category;
        return matchText && matchCat;
      });
      this.loading = false;
    });
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  openForm(item?: PartCatalogItem): void {
    this.dialog.open(PartFormDialogComponent, { data: item ?? null, width: '640px', maxWidth: '95vw' })
      .afterClosed().subscribe((ok) => { if (ok) { this.notify.success('Catálogo actualizado.'); } });
  }

  toggle(item: PartCatalogItem): void {
    this.catalog.toggleActive(item.id).subscribe(() =>
      this.notify.info(item.active ? 'Artículo desactivado.' : 'Artículo activado.'));
  }
}
