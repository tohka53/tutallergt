import { AfterViewInit, Component, OnInit, ViewChild, inject } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { FormControl } from '@angular/forms';
import { combineLatest } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { VehicleService } from '../../core/services/vehicle.service';
import { ClientService } from '../../core/services/client.service';
import { AuthService } from '../../core/services/auth.service';
import { AuthorizationService } from '../../core/services/authorization.service';
import { NotificationService } from '../../core/services/notification.service';
import { Client, Vehicle } from '../../models';
import { basePath } from '../vehicle-nav.util';
import {
  ConfirmDialogComponent, ConfirmDialogData,
} from '../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-vehicle-list',
  standalone: false,
  templateUrl: './vehicle-list.component.html',
})
export class VehicleListComponent implements OnInit, AfterViewInit {
  private vehicles = inject(VehicleService);
  private clients = inject(ClientService);
  private auth = inject(AuthService);
  private authz = inject(AuthorizationService);
  private dialog = inject(MatDialog);
  private notify = inject(NotificationService);
  private router = inject(Router);

  loading = true;
  search = new FormControl('', { nonNullable: true });
  dataSource = new MatTableDataSource<Vehicle>([]);
  clientMap = new Map<string, Client>();
  base = basePath(this.auth);
  canDelete = this.authz.canDeleteVehicle();
  displayedColumns: string[] = [];

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  ngOnInit(): void {
    this.displayedColumns = this.auth.isMechanic()
      ? ['plate', 'vehicle', 'owner', 'year', 'status', 'actions']
      : ['plate', 'vehicle', 'year', 'status', 'actions'];

    combineLatest([this.vehicles.vehicles$, this.clients.clients$]).subscribe(([vehicles, clients]) => {
      this.clientMap = new Map(clients.map((c) => [c.id, c]));
      const clientId = this.authz.currentClientId();
      this.dataSource.data = this.auth.isMechanic()
        ? vehicles
        : vehicles.filter((v) => v.ownerId === clientId);
      this.loading = false;
    });

    this.dataSource.filterPredicate = (v, filter) => {
      const owner = this.clientMap.get(v.ownerId);
      const ownerName = owner ? `${owner.firstName} ${owner.lastName}` : '';
      return [v.plate, v.brand, v.model, v.color, ownerName].join(' ').toLowerCase().includes(filter);
    };

    this.search.valueChanges.pipe(debounceTime(200)).subscribe((term) => {
      this.dataSource.filter = (term ?? '').trim().toLowerCase();
      if (this.dataSource.paginator) { this.dataSource.paginator.firstPage(); }
    });
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  ownerName(v: Vehicle): string {
    const c = this.clientMap.get(v.ownerId);
    return c ? `${c.firstName} ${c.lastName}` : '—';
  }

  remove(v: Vehicle): void {
    if (!this.authz.canDeleteVehicle()) {
      this.notify.error('No tienes permiso para eliminar vehículos.');
      return;
    }
    const data: ConfirmDialogData = {
      title: 'Eliminar vehículo',
      message: `¿Eliminar el vehículo ${v.brand} ${v.model} (${v.plate})? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar', danger: true,
    };
    this.dialog.open(ConfirmDialogComponent, { data, width: '420px' }).afterClosed().subscribe((ok) => {
      if (ok) { this.vehicles.delete(v.id).subscribe(() => this.notify.success('Vehículo eliminado.')); }
    });
  }

  goDetail(id: string): void { this.router.navigate([this.base, 'vehicles', id]); }
}
