import { Component, OnInit, inject } from '@angular/core';
import { combineLatest, of } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { VehicleService } from '../../core/services/vehicle.service';
import { QuotationService } from '../../core/services/quotation.service';
import { WorkshopServiceService } from '../../core/services/workshop-service.service';
import { Vehicle, WorkshopService } from '../../models';
import {
  ACTIVE_SERVICE_STATUSES, SERVICE_STATUS_CHIP, SERVICE_STATUS_LABELS,
} from '../../shared/status.util';

@Component({
  selector: 'app-client-dashboard',
  standalone: false,
  templateUrl: './client-dashboard.component.html',
  styleUrls: ['./client-dashboard.component.scss'],
})
export class ClientDashboardComponent implements OnInit {
  private auth = inject(AuthService);
  private vehicles = inject(VehicleService);
  private quotations = inject(QuotationService);
  private services = inject(WorkshopServiceService);

  loading = true;
  userName = this.auth.currentUser?.displayName ?? '';
  vehicleCount = 0;
  quotationCount = 0;
  serviceCount = 0;
  activeServices: Array<{ service: WorkshopService; vehicle?: Vehicle }> = [];

  sLabel = SERVICE_STATUS_LABELS;
  sChip = SERVICE_STATUS_CHIP;

  ngOnInit(): void {
    const clientId = this.auth.currentUser?.clientId;
    if (!clientId) { this.loading = false; return; }

    combineLatest([
      this.vehicles.listByOwner(clientId),
      this.quotations.listByClient(clientId),
      this.services.listByClient(clientId),
      of(clientId),
    ]).subscribe(([vehicles, quotations, services]) => {
      this.vehicleCount = vehicles.filter((v) => v.active).length;
      this.quotationCount = quotations.length;
      this.serviceCount = services.length;
      this.activeServices = services
        .filter((s) => ACTIVE_SERVICE_STATUSES.includes(s.status))
        .map((s) => ({ service: s, vehicle: vehicles.find((v) => v.id === s.vehicleId) }));
      this.loading = false;
    });
  }
}
