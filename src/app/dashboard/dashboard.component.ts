import { Component, OnInit, inject } from '@angular/core';
import { combineLatest } from 'rxjs';
import { ClientService } from '../core/services/client.service';
import { VehicleService } from '../core/services/vehicle.service';
import { QuotationService } from '../core/services/quotation.service';
import { WorkshopServiceService } from '../core/services/workshop-service.service';
import { Quotation, ServiceStatus, WorkshopService } from '../models';
import {
  ACTIVE_SERVICE_STATUSES, QUOTATION_STATUS_CHIP, QUOTATION_STATUS_LABELS,
  SERVICE_STATUS_CHIP, SERVICE_STATUS_LABELS,
} from '../shared/status.util';

interface Kpi { label: string; value: number | string; icon: string; accent: string; }
interface Bar { label: string; value: number; color: string; }

@Component({
  selector: 'app-dashboard',
  standalone: false,
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent implements OnInit {
  private clients = inject(ClientService);
  private vehicles = inject(VehicleService);
  private quotations = inject(QuotationService);
  private services = inject(WorkshopServiceService);

  loading = true;
  kpis: Kpi[] = [];
  statusBars: Bar[] = [];
  monthBars: Bar[] = [];
  recentQuotations: Quotation[] = [];
  recentServices: WorkshopService[] = [];
  monthlyIncome = 0;

  qLabel = QUOTATION_STATUS_LABELS;
  qChip = QUOTATION_STATUS_CHIP;
  sLabel = SERVICE_STATUS_LABELS;
  sChip = SERVICE_STATUS_CHIP;

  ngOnInit(): void {
    combineLatest([
      this.clients.clients$, this.vehicles.vehicles$,
      this.quotations.quotations$, this.services.services$,
    ]).subscribe(([clients, vehicles, quotations, services]) => {
      const inShop = services.filter((s) => ACTIVE_SERVICE_STATUSES.includes(s.status)).length;
      const draft = quotations.filter((q) => q.status === 'draft').length;
      const sent = quotations.filter((q) => q.status === 'sent').length;
      const pending = services.filter((s) => s.status === 'received' || s.status === 'pending-auth').length;
      const inProgress = services.filter(
        (s) => s.status === 'repairing' || s.status === 'diagnosis' || s.status === 'waiting-part' || s.status === 'testing'
      ).length;
      const done = services.filter((s) => s.status === 'done' || s.status === 'delivered').length;

      const now = new Date();
      this.monthlyIncome = services
        .filter((s) => {
          const d = new Date(s.entryDate);
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        })
        .reduce((sum, s) => sum + s.total, 0);

      this.kpis = [
        { label: 'Clientes', value: clients.filter((c) => c.active).length, icon: 'people', accent: 'blue' },
        { label: 'Vehículos', value: vehicles.filter((v) => v.active).length, icon: 'directions_car', accent: 'blue' },
        { label: 'En el taller', value: inShop, icon: 'garage', accent: 'yellow' },
        { label: 'Cot. borrador', value: draft, icon: 'edit_note', accent: 'gray' },
        { label: 'Cot. enviadas', value: sent, icon: 'send', accent: 'blue' },
        { label: 'Serv. pendientes', value: pending, icon: 'pending_actions', accent: 'yellow' },
        { label: 'Serv. en proceso', value: inProgress, icon: 'build', accent: 'yellow' },
        { label: 'Serv. terminados', value: done, icon: 'task_alt', accent: 'green' },
      ];

      this.buildStatusChart(services);
      this.buildMonthChart(services);

      this.recentQuotations = [...quotations]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
      this.recentServices = [...services]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);

      this.loading = false;
    });
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

  private buildMonthChart(services: WorkshopService[]): void {
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const now = new Date();
    const bars: Bar[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const count = services.filter((s) => {
        const sd = new Date(s.entryDate);
        return sd.getMonth() === d.getMonth() && sd.getFullYear() === d.getFullYear();
      }).length;
      bars.push({ label: months[d.getMonth()], value: count, color: '#1565c0' });
    }
    this.monthBars = bars;
  }

  maxOf(bars: Bar[]): number {
    return Math.max(1, ...bars.map((b) => b.value));
  }
}
