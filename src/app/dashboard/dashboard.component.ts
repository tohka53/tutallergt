import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Subject, combineLatest, takeUntil } from 'rxjs';
import { ClientService } from '../core/services/client.service';
import { VehicleService } from '../core/services/vehicle.service';
import { QuotationService } from '../core/services/quotation.service';
import { WorkshopServiceService } from '../core/services/workshop-service.service';
import { DataSyncService } from '../core/services/data-sync.service';
import { Quotation, ServiceStatus, WorkshopService } from '../models';
import {
  ACTIVE_SERVICE_STATUSES, QUOTATION_STATUS_CHIP, QUOTATION_STATUS_LABELS,
  SERVICE_STATUS_CHIP, SERVICE_STATUS_LABELS,
} from '../shared/status.util';
import { enRango, inicioDeMes, resumir, sumaMeses, Resumen } from '../core/services/metrics.util';

interface Kpi { label: string; value: number | string; icon: string; accent: string; link?: string; }
interface Bar { label: string; value: number; color: string; }

@Component({
  selector: 'app-dashboard',
  standalone: false,
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent implements OnInit, OnDestroy {
  private clients = inject(ClientService);
  private vehicles = inject(VehicleService);
  private quotations = inject(QuotationService);
  private services = inject(WorkshopServiceService);
  sync = inject(DataSyncService);

  private destroy$ = new Subject<void>();

  loading = true;
  kpis: Kpi[] = [];
  statusBars: Bar[] = [];
  recentQuotations: Quotation[] = [];
  recentServices: WorkshopService[] = [];

  /** Resumen del mes en curso: se calcula igual que en la pantalla de Métricas. */
  mes: Resumen = resumir([]);

  qLabel = QUOTATION_STATUS_LABELS;
  qChip = QUOTATION_STATUS_CHIP;
  sLabel = SERVICE_STATUS_LABELS;
  sChip = SERVICE_STATUS_CHIP;

  ngOnInit(): void {
    combineLatest([
      this.clients.clients$, this.vehicles.vehicles$,
      this.quotations.quotations$, this.services.services$,
    ])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([clients, vehicles, quotations, services]) => {
        const inShop = services.filter((s) => ACTIVE_SERVICE_STATUSES.includes(s.status)).length;
        const draft = quotations.filter((q) => q.status === 'draft').length;
        const sent = quotations.filter((q) => q.status === 'sent').length;
        const pending = services.filter((s) => s.status === 'received' || s.status === 'pending-auth').length;
        const done = services.filter((s) => s.status === 'done' || s.status === 'delivered').length;

        const desde = inicioDeMes(new Date());
        this.mes = resumir(enRango(quotations, desde, sumaMeses(desde, 1)));

        this.kpis = [
          { label: 'Clientes', value: clients.filter((c) => c.active).length, icon: 'people', accent: 'blue', link: '/app/clients' },
          { label: 'Vehículos', value: vehicles.filter((v) => v.active).length, icon: 'directions_car', accent: 'blue', link: '/app/vehicles' },
          { label: 'En el taller', value: inShop, icon: 'garage', accent: 'yellow', link: '/app/services' },
          { label: 'Cot. borrador', value: draft, icon: 'edit_note', accent: 'gray', link: '/app/quotations' },
          { label: 'Cot. enviadas', value: sent, icon: 'send', accent: 'blue', link: '/app/quotations' },
          { label: 'Serv. pendientes', value: pending, icon: 'pending_actions', accent: 'yellow', link: '/app/services' },
          { label: 'Serv. terminados', value: done, icon: 'task_alt', accent: 'green', link: '/app/services' },
          { label: 'Vehículos del mes', value: this.mes.vehiculos, icon: 'insights', accent: 'green', link: '/app/metrics' },
        ];

        this.buildStatusChart(services);

        this.recentQuotations = [...quotations]
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
        this.recentServices = [...services]
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);

        this.loading = false;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private buildStatusChart(services: WorkshopService[]): void {
    const counts = new Map<ServiceStatus, number>();
    services.forEach((s) => counts.set(s.status, (counts.get(s.status) ?? 0) + 1));
    const palette: Record<string, string> = {
      received: '#1565c0', diagnosis: '#42a5f5', 'pending-auth': '#ef6c00',
      'waiting-part': '#ff8f00', repairing: '#ffc107', testing: '#26a69a',
      done: '#2e7d32', delivered: '#66bb6a', cancelled: '#c62828',
    };
    this.statusBars = [...counts.entries()].map(([status, value]) => ({
      label: SERVICE_STATUS_LABELS[status], value, color: palette[status] ?? '#78909c',
    }));
  }

  maxOf(bars: Bar[]): number {
    return Math.max(1, ...bars.map((b) => b.value));
  }

  async reintentar(): Promise<void> {
    this.loading = true;
    await this.sync.loadForCurrentUser();
    this.loading = false;
  }
}
