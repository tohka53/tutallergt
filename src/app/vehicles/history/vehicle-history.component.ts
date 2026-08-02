import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormControl } from '@angular/forms';
import { combineLatest, switchMap, of } from 'rxjs';
import { VehicleService } from '../../core/services/vehicle.service';
import { QuotationService } from '../../core/services/quotation.service';
import { WorkshopServiceService } from '../../core/services/workshop-service.service';
import { AuthService } from '../../core/services/auth.service';
import { Quotation, Vehicle, WorkshopService } from '../../models';
import { basePath } from '../vehicle-nav.util';
import {
  QUOTATION_STATUS_CHIP, QUOTATION_STATUS_LABELS, SERVICE_STATUS_CHIP, SERVICE_STATUS_LABELS,
} from '../../shared/status.util';

interface HistoryEvent {
  kind: 'quotation' | 'service';
  id: string;
  date: string;
  title: string;
  statusLabel: string;
  statusChip: string;
  total: number;
  mileage?: number;
  diagnosis?: string;
  mechanic?: string;
}

@Component({
  selector: 'app-vehicle-history',
  standalone: false,
  templateUrl: './vehicle-history.component.html',
  styleUrls: ['./vehicle-history.component.scss'],
})
export class VehicleHistoryComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private vehicles = inject(VehicleService);
  private quotations = inject(QuotationService);
  private services = inject(WorkshopServiceService);
  private auth = inject(AuthService);

  loading = true;
  vehicle?: Vehicle;
  base = basePath(this.auth);
  allEvents: HistoryEvent[] = [];
  events: HistoryEvent[] = [];

  kindFilter = new FormControl<'all' | 'quotation' | 'service'>('all', { nonNullable: true });

  ngOnInit(): void {
    this.route.paramMap.pipe(
      switchMap((p) => {
        const id = p.get('id') ?? '';
        return combineLatest([
          this.vehicles.getById(id),
          this.quotations.listByVehicle(id),
          this.services.listByVehicle(id),
          of(id),
        ]);
      })
    ).subscribe(([vehicle, quotations, services]) => {
      this.vehicle = vehicle;
      this.allEvents = [
        ...quotations.map((q) => this.fromQuotation(q)),
        ...services.map((s) => this.fromService(s)),
      ].sort((a, b) => b.date.localeCompare(a.date));
      this.applyFilter();
      this.loading = false;
    });

    this.kindFilter.valueChanges.subscribe(() => this.applyFilter());
  }

  private fromQuotation(q: Quotation): HistoryEvent {
    return {
      kind: 'quotation', id: q.id, date: q.date, title: 'Cotización ' + q.number,
      statusLabel: QUOTATION_STATUS_LABELS[q.status], statusChip: QUOTATION_STATUS_CHIP[q.status],
      total: q.total, mileage: q.mileage,
    };
  }
  private fromService(s: WorkshopService): HistoryEvent {
    return {
      kind: 'service', id: s.id, date: s.entryDate, title: 'Servicio ' + s.number,
      statusLabel: SERVICE_STATUS_LABELS[s.status], statusChip: SERVICE_STATUS_CHIP[s.status],
      total: s.total, mileage: s.entryMileage, diagnosis: s.diagnosis, mechanic: s.mechanicName,
    };
  }

  applyFilter(): void {
    const k = this.kindFilter.value;
    this.events = k === 'all' ? this.allEvents : this.allEvents.filter((e) => e.kind === k);
  }

  linkFor(e: HistoryEvent): string[] {
    return e.kind === 'quotation'
      ? [this.base, 'quotations', e.id]
      : [this.base, 'services', e.id];
  }
}
