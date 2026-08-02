import { AfterViewInit, Component, OnInit, ViewChild, inject } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { FormControl } from '@angular/forms';
import { combineLatest } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { ClientService } from '../../core/services/client.service';
import { VehicleService } from '../../core/services/vehicle.service';
import { NotificationService } from '../../core/services/notification.service';
import { Client } from '../../models';
import {
  ConfirmDialogComponent, ConfirmDialogData,
} from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { MobileSortOption } from '../../shared/components/mobile-sort/mobile-sort.component';

@Component({
  selector: 'app-client-list',
  standalone: false,
  templateUrl: './client-list.component.html',
})
export class ClientListComponent implements OnInit, AfterViewInit {
  private clients = inject(ClientService);
  private vehicles = inject(VehicleService);
  private dialog = inject(MatDialog);
  private notify = inject(NotificationService);
  private router = inject(Router);

  loading = true;
  search = new FormControl('', { nonNullable: true });
  displayedColumns = ['name', 'taxId', 'phone', 'email', 'status', 'actions'];
  dataSource = new MatTableDataSource<Client>([]);
  private platesByClient = new Map<string, string>();

  /** Ordenamiento para móvil (la cabecera de la tabla se oculta en pantallas pequeñas). */
  sortOptions: MobileSortOption[] = [
    { id: 'name', dir: 'asc', label: 'Nombre (A-Z)' },
    { id: 'name', dir: 'desc', label: 'Nombre (Z-A)' },
    { id: 'taxId', dir: 'asc', label: 'NIT / CF' },
  ];

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  ngOnInit(): void {
    combineLatest([this.clients.clients$, this.vehicles.vehicles$]).subscribe(([clients, vehicles]) => {
      this.platesByClient.clear();
      for (const c of clients) {
        this.platesByClient.set(
          c.id,
          vehicles.filter((v) => v.ownerId === c.id).map((v) => v.plate).join(' ').toLowerCase()
        );
      }
      this.dataSource.data = clients;
      this.loading = false;
    });

    this.dataSource.filterPredicate = (c, filter) => {
      const term = filter.trim().toLowerCase();
      const inClient = [c.firstName, c.lastName, c.taxId, c.phone, c.email, c.whatsapp]
        .join(' ').toLowerCase().includes(term);
      const inPlate = (this.platesByClient.get(c.id) ?? '').includes(term);
      return inClient || inPlate;
    };

    this.search.valueChanges.pipe(debounceTime(200)).subscribe((term) => {
      this.dataSource.filter = (term ?? '').trim().toLowerCase();
      if (this.dataSource.paginator) { this.dataSource.paginator.firstPage(); }
    });
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sortingDataAccessor = (item, prop) =>
      prop === 'name'
        ? `${item.firstName} ${item.lastName}`.toLowerCase()
        : String((item as unknown as Record<string, unknown>)[prop] ?? '');
    this.dataSource.sort = this.sort;
  }

  deactivate(client: Client): void {
    const data: ConfirmDialogData = {
      title: 'Marcar cliente como inactivo',
      message: `¿Marcar a ${client.firstName} ${client.lastName} como inactivo?\n\nLos clientes con historial no se eliminan definitivamente.`,
      confirmText: 'Marcar inactivo', danger: true,
    };
    this.dialog.open(ConfirmDialogComponent, { data, width: '420px' }).afterClosed().subscribe((ok) => {
      if (ok) {
        this.clients.deactivate(client.id).subscribe(() => this.notify.info('Cliente marcado como inactivo.'));
      }
    });
  }

  goDetail(id: string): void { this.router.navigate(['/app/clients', id]); }
}
