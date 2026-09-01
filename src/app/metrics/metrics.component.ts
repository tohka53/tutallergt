import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Subject, combineLatest, takeUntil } from 'rxjs';
import { QuotationService } from '../core/services/quotation.service';
import { VehicleService } from '../core/services/vehicle.service';
import { ClientService } from '../core/services/client.service';
import { WorkshopSettingsService } from '../core/services/workshop-settings.service';
import { Client, Quotation, Vehicle } from '../models';
import {
  FilaVehiculo, Punto, Rango, Resumen,
  enRango, porVehiculo, rangosDisponibles, resumir, serieMensual, serieSemanal,
} from '../core/services/metrics.util';

interface FilaTabla extends FilaVehiculo {
  vehiculo: string;
  placa: string;
  cliente: string;
}

@Component({
  selector: 'app-metrics',
  standalone: false,
  templateUrl: './metrics.component.html',
  styleUrls: ['./metrics.component.scss'],
})
export class MetricsComponent implements OnInit, OnDestroy {
  private quotations = inject(QuotationService);
  private vehicles = inject(VehicleService);
  private clients = inject(ClientService);
  settings = inject(WorkshopSettingsService);

  private destroy$ = new Subject<void>();
  private todas: Quotation[] = [];
  private vehiculos: Vehicle[] = [];
  private clientes: Client[] = [];

  rangos: Rango[] = rangosDisponibles();
  rangoActivo: Rango = this.rangos[2]; // "Este mes"

  resumen: Resumen = resumir([]);
  /** El mismo período del mes anterior, para poder comparar. */
  comparacion: Resumen | null = null;

  serieMeses: Punto[] = [];
  serieDias: Punto[] = [];
  filas: FilaTabla[] = [];

  /** Cuántos meses se muestran en la gráfica de barras. */
  mesesGrafica = 6;

  ngOnInit(): void {
    combineLatest([
      this.quotations.quotations$,
      this.vehicles.vehicles$,
      this.clients.clients$,
    ])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([quotations, vehicles, clients]) => {
        this.todas = quotations;
        this.vehiculos = vehicles;
        this.clientes = clients;
        this.recalcular();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  seleccionar(rango: Rango): void {
    this.rangoActivo = rango;
    this.recalcular();
  }

  cambiarMeses(n: number): void {
    this.mesesGrafica = n;
    this.recalcular();
  }

  private recalcular(): void {
    const delPeriodo = enRango(this.todas, this.rangoActivo.desde, this.rangoActivo.hasta);
    this.resumen = resumir(delPeriodo);
    this.comparacion = this.calcularComparacion();

    this.serieMeses = serieMensual(this.todas, this.mesesGrafica);
    this.serieDias = serieSemanal(this.todas);

    this.filas = porVehiculo(delPeriodo).map((f) => {
      const v = this.vehiculos.find((x) => x.id === f.vehicleId);
      const c = this.clientes.find((x) => x.id === f.clientId);
      return {
        ...f,
        vehiculo: v ? `${v.brand} ${v.line || v.model}` : 'Vehículo eliminado',
        placa: v?.plate ?? '—',
        cliente: c ? `${c.firstName} ${c.lastName}`.trim() : '—',
      };
    });
  }

  /**
   * Compara contra el período inmediatamente anterior de la misma duración.
   * Un número solo no dice nada; "Q3,200 este mes" cobra sentido al lado de
   * lo que se ganó el mes pasado.
   */
  private calcularComparacion(): Resumen | null {
    const duracion = this.rangoActivo.hasta.getTime() - this.rangoActivo.desde.getTime();
    if (duracion <= 0) { return null; }
    const desde = new Date(this.rangoActivo.desde.getTime() - duracion);
    const hasta = new Date(this.rangoActivo.desde.getTime());
    const previo = resumir(enRango(this.todas, desde, hasta));
    return previo.trabajos === 0 && this.resumen.trabajos === 0 ? null : previo;
  }

  /** Variación porcentual contra el período anterior. */
  variacion(actual: number, previo: number): number | null {
    if (!this.comparacion) { return null; }
    if (previo === 0) { return actual === 0 ? 0 : null; }
    return Math.round(((actual - previo) / previo) * 1000) / 10;
  }

  maxGanancia(puntos: Punto[]): number {
    return Math.max(1, ...puntos.map((p) => Math.max(0, p.resumen.ganancia)));
  }

  maxVehiculos(puntos: Punto[]): number {
    return Math.max(1, ...puntos.map((p) => p.resumen.vehiculos));
  }

  altura(valor: number, maximo: number): number {
    return Math.max(0, Math.min(100, (valor / maximo) * 100));
  }
}
