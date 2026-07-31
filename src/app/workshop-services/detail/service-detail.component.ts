import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { switchMap, combineLatest, of } from 'rxjs';
import { WorkshopServiceService } from '../../core/services/workshop-service.service';
import { ClientService } from '../../core/services/client.service';
import { VehicleService } from '../../core/services/vehicle.service';
import { AuthService } from '../../core/services/auth.service';
import { AuthorizationService } from '../../core/services/authorization.service';
import { NotificationService } from '../../core/services/notification.service';
import { Client, ServiceStatus, Vehicle, WorkshopService } from '../../models';
import { basePath } from '../../shared/nav.util';
import { SERVICE_STATUS_CHIP, SERVICE_STATUS_LABELS } from '../../shared/status.util';
import { StatusChangeDialogComponent } from '../dialogs/status-change-dialog.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-service-detail',
  standalone: false,
  templateUrl: './service-detail.component.html',
})
export class ServiceDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private services = inject(WorkshopServiceService);
  private clients = inject(ClientService);
  private vehicles = inject(VehicleService);
  private auth = inject(AuthService);
  private authz = inject(AuthorizationService);
  private notify = inject(NotificationService);
  private dialog = inject(MatDialog);

  loading = true;
  service?: WorkshopService;
  client?: Client;
  vehicle?: Vehicle;
  base = basePath(this.auth);
  isMechanic = this.auth.isMechanic();
  canManage = this.authz.canManageServices();

  sLabel = SERVICE_STATUS_LABELS; sChip = SERVICE_STATUS_CHIP;

  ngOnInit(): void {
    this.route.paramMap.pipe(
      switchMap((p) => this.services.getById(p.get('id') ?? '')),
      switchMap((s) => {
        this.service = s;
        if (!s) { return of([undefined, undefined] as [Client | undefined, Vehicle | undefined]); }
        return combineLatest([this.clients.getById(s.clientId), this.vehicles.getById(s.vehicleId)]);
      })
    ).subscribe(([client, vehicle]) => {
      this.client = client; this.vehicle = vehicle; this.loading = false;
    });
  }

  get timeline() {
    return this.service ? [...this.service.statusHistory].reverse() : [];
  }

  changeStatus(): void {
    if (!this.service) { return; }
    const id = this.service.id;
    this.dialog.open(StatusChangeDialogComponent, {
      data: { current: this.service.status }, width: '440px',
    }).afterClosed().subscribe((res?: { status: ServiceStatus; comment: string } | null) => {
      if (res) {
        this.services.changeStatus(id, res.status, res.comment).subscribe(() => this.notify.success('Estado actualizado.'));
      }
    });
  }

  remove(): void {
    if (!this.service) { return; }
    const data: ConfirmDialogData = {
      title: 'Eliminar servicio', message: `¿Eliminar el servicio ${this.service.number}?`,
      confirmText: 'Eliminar', danger: true,
    };
    const id = this.service.id;
    this.dialog.open(ConfirmDialogComponent, { data, width: '420px' }).afterClosed().subscribe((ok) => {
      if (ok) { this.services.delete(id).subscribe(() => { this.notify.success('Servicio eliminado.'); this.router.navigate(['/app/services']); }); }
    });
  }

  typeLabel(t: string): string {
    return t === 'part' ? 'Repuesto' : t === 'material' ? 'Material' : t === 'labor' ? 'Mano de obra' : 'Otro';
  }
}
