import { AfterViewInit, Component, OnInit, ViewChild, inject } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { FormControl } from '@angular/forms';
import { combineLatest, startWith } from 'rxjs';
import { WorkshopServiceService } from '../../core/services/workshop-service.service';
import { ClientService } from '../../core/services/client.service';
import { VehicleService } from '../../core/services/vehicle.service';
import { AuthService } from '../../core/services/auth.service';
import { AuthorizationService } from '../../core/services/authorization.service';
import { Client, ServiceStatus, Vehicle, WorkshopService } from '../../models';
import { basePath } from '../../shared/nav.util';
import { SERVICE_STATUS_CHIP, SERVICE_STATUS_LABELS } from '../../shared/status.util';
import { MobileSortOption } from '../../shared/components/mobile-sort/mobile-sort.component';

@Component({
  selector: 'app-service-list',
  standalone: false,
  templateUrl: './service-list.component.html',
})
export class ServiceListComponent implements OnInit, AfterViewInit {
  private services = inject(WorkshopServiceService);
  private clients = inject(ClientService);
  private vehicles = inject(VehicleService);
  private auth = inject(AuthService);
  private authz = inject(AuthorizationService);

  loading = true;
  base = basePath(this.auth);
  isMechanic = this.auth.isMechanic();
  search = new FormControl('', { nonNullable: true });
  statusFilter = new FormControl<'all' | ServiceStatus>('all', { nonNullable: true });
  dataSource = new MatTableDataSource<WorkshopService>([]);
  clientMap = new Map<string, Client>();
  vehicleMap = new Map<string, Vehicle>();
  displayedColumns = ['number', 'client', 'vehicle', 'entryDate', 'total', 'status'];

  sLabel: Record<string, string> = SERVICE_STATUS_LABELS;
  sChip: Record<string, string> = SERVICE_STATUS_CHIP;
  statuses: ServiceStatus[] = ['received', 'diagnosis', 'pending-auth', 'waiting-part', 'repairing', 'testing', 'done', 'delivered', 'cancelled'];

  /** Ordenamiento para móvil (la cabecera de la tabla se oculta en pantallas pequeñas). */
  sortOptions: MobileSortOption[] = [
    { id: 'entryDate', dir: 'desc', label: 'Ingreso (más reciente)' },
    { id: 'entryDate', dir: 'asc', label: 'Ingreso (más antiguo)' },
    { id: 'total', dir: 'desc', label: 'Total (mayor a menor)' },
    { id: 'number', dir: 'asc', label: 'Número de orden' },
  ];

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  ngOnInit(): void {
    combineLatest([
      this.services.services$, this.clients.clients$, this.vehicles.vehicles$,
      this.search.valueChanges.pipe(startWith('')),
      this.statusFilter.valueChanges.pipe(startWith('all')),
    ]).subscribe(([services, clients, vehicles, term, status]) => {
      this.clientMap = new Map(clients.map((c) => [c.id, c]));
      this.vehicleMap = new Map(vehicles.map((v) => [v.id, v]));
      const clientId = this.authz.currentClientId();
      const t = (term ?? '').trim().toLowerCase();
      this.dataSource.data = services
        .filter((s) => this.isMechanic || s.clientId === clientId)
        .filter((s) => status === 'all' || s.status === status)
        .filter((s) => {
          const c = this.clientMap.get(s.clientId);
          const v = this.vehicleMap.get(s.vehicleId);
          return [s.number, c ? c.firstName + ' ' + c.lastName : '', v?.plate ?? ''].join(' ').toLowerCase().includes(t);
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      this.loading = false;
    });
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  clientName(s: WorkshopService): string {
    const c = this.clientMap.get(s.clientId);
    return c ? `${c.firstName} ${c.lastName}` : '—';
  }
  vehicleLabel(s: WorkshopService): string {
    const v = this.vehicleMap.get(s.vehicleId);
    return v ? `${v.brand} ${v.model} (${v.plate})` : '—';
  }
}
