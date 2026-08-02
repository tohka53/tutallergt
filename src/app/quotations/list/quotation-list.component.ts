import { AfterViewInit, Component, OnInit, ViewChild, inject } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { FormControl } from '@angular/forms';
import { combineLatest, startWith } from 'rxjs';
import { QuotationService } from '../../core/services/quotation.service';
import { ClientService } from '../../core/services/client.service';
import { VehicleService } from '../../core/services/vehicle.service';
import { AuthService } from '../../core/services/auth.service';
import { AuthorizationService } from '../../core/services/authorization.service';
import { Client, Quotation, QuotationStatus, Vehicle } from '../../models';
import { basePath } from '../../shared/nav.util';
import { QUOTATION_STATUS_CHIP, QUOTATION_STATUS_LABELS } from '../../shared/status.util';
import { MobileSortOption } from '../../shared/components/mobile-sort/mobile-sort.component';

@Component({
  selector: 'app-quotation-list',
  standalone: false,
  templateUrl: './quotation-list.component.html',
})
export class QuotationListComponent implements OnInit, AfterViewInit {
  private quotations = inject(QuotationService);
  private clients = inject(ClientService);
  private vehicles = inject(VehicleService);
  private auth = inject(AuthService);
  private authz = inject(AuthorizationService);

  loading = true;
  base = basePath(this.auth);
  isMechanic = this.auth.isMechanic();
  search = new FormControl('', { nonNullable: true });
  statusFilter = new FormControl<'all' | QuotationStatus>('all', { nonNullable: true });
  dataSource = new MatTableDataSource<Quotation>([]);
  clientMap = new Map<string, Client>();
  vehicleMap = new Map<string, Vehicle>();
  displayedColumns = ['number', 'client', 'vehicle', 'date', 'total', 'status'];

  qLabel: Record<string, string> = QUOTATION_STATUS_LABELS;
  qChip: Record<string, string> = QUOTATION_STATUS_CHIP;
  statuses: QuotationStatus[] = ['draft', 'sent', 'converted', 'void'];

  /** Ordenamiento para móvil (la cabecera de la tabla se oculta en pantallas pequeñas). */
  sortOptions: MobileSortOption[] = [
    { id: 'date', dir: 'desc', label: 'Fecha (más reciente)' },
    { id: 'date', dir: 'asc', label: 'Fecha (más antigua)' },
    { id: 'total', dir: 'desc', label: 'Total (mayor a menor)' },
    { id: 'number', dir: 'asc', label: 'Número' },
  ];

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  ngOnInit(): void {
    combineLatest([
      this.quotations.quotations$, this.clients.clients$, this.vehicles.vehicles$,
      this.search.valueChanges.pipe(startWith('')),
      this.statusFilter.valueChanges.pipe(startWith('all')),
    ]).subscribe(([quotations, clients, vehicles, term, status]) => {
      this.clientMap = new Map(clients.map((c) => [c.id, c]));
      this.vehicleMap = new Map(vehicles.map((v) => [v.id, v]));
      const clientId = this.authz.currentClientId();
      const t = (term ?? '').trim().toLowerCase();

      this.dataSource.data = quotations
        .filter((q) => this.isMechanic || q.clientId === clientId)
        .filter((q) => status === 'all' || q.status === status)
        .filter((q) => {
          const c = this.clientMap.get(q.clientId);
          const v = this.vehicleMap.get(q.vehicleId);
          const hay = [q.number, c ? c.firstName + ' ' + c.lastName : '', v?.plate ?? ''].join(' ').toLowerCase();
          return hay.includes(t);
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      this.loading = false;
    });
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  clientName(q: Quotation): string {
    const c = this.clientMap.get(q.clientId);
    return c ? `${c.firstName} ${c.lastName}` : '—';
  }
  vehicleLabel(q: Quotation): string {
    const v = this.vehicleMap.get(q.vehicleId);
    return v ? `${v.brand} ${v.model} (${v.plate})` : '—';
  }
}
