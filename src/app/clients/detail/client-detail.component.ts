import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { combineLatest, of, switchMap } from 'rxjs';
import { ClientService } from '../../core/services/client.service';
import { VehicleService } from '../../core/services/vehicle.service';
import { QuotationService } from '../../core/services/quotation.service';
import { WorkshopServiceService } from '../../core/services/workshop-service.service';
import { Client, Quotation, Vehicle, WorkshopService } from '../../models';
import {
  QUOTATION_STATUS_CHIP, QUOTATION_STATUS_LABELS, SERVICE_STATUS_CHIP, SERVICE_STATUS_LABELS,
} from '../../shared/status.util';

@Component({
  selector: 'app-client-detail',
  standalone: false,
  templateUrl: './client-detail.component.html',
})
export class ClientDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private clients = inject(ClientService);
  private vehicles = inject(VehicleService);
  private quotations = inject(QuotationService);
  private services = inject(WorkshopServiceService);

  loading = true;
  client?: Client;
  vehicles$: Vehicle[] = [];
  quotations$: Quotation[] = [];
  services$: WorkshopService[] = [];

  qLabel = QUOTATION_STATUS_LABELS; qChip = QUOTATION_STATUS_CHIP;
  sLabel = SERVICE_STATUS_LABELS; sChip = SERVICE_STATUS_CHIP;

  ngOnInit(): void {
    this.route.paramMap.pipe(
      switchMap((p) => {
        const id = p.get('id') ?? '';
        return combineLatest([
          this.clients.getById(id),
          this.vehicles.listByOwner(id),
          this.quotations.listByClient(id),
          this.services.listByClient(id),
          of(id),
        ]);
      })
    ).subscribe(([client, vehicles, quotations, services]) => {
      this.client = client;
      this.vehicles$ = vehicles;
      this.quotations$ = quotations;
      this.services$ = services;
      this.loading = false;
    });
  }
}
