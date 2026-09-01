import { Quotation } from '../../models';

/**
 * Cálculo de las métricas del taller.
 *
 * Qué cuenta: sólo las cotizaciones que el cliente ACEPTÓ (estado `accepted`)
 * o que ya se pasaron a orden de servicio (`converted`). Los borradores y las
 * enviadas sin respuesta no son trabajo hecho, y contarlas inflaría los
 * números hasta volverlos inútiles para decidir algo.
 *
 * Con qué fecha: la de aceptación si existe; si no, la de la cotización. Lo
 * que interesa es cuándo entró el trabajo, no cuándo se escribió el papel.
 *
 * Todo son funciones puras para poder probarlas sin base de datos.
 */

export type Granularity = 'day' | 'week' | 'month' | 'year';

/** Estados que cuentan como trabajo real. */
export const ESTADOS_CONTABLES: Quotation['status'][] = ['accepted', 'converted'];

export function cuentaParaMetricas(q: Quotation): boolean {
  return ESTADOS_CONTABLES.includes(q.status);
}

/** Fecha con la que se ubica una cotización en el tiempo. */
export function fechaDeMetrica(q: Quotation): Date {
  return new Date(q.acceptedAt || q.date);
}

export interface Resumen {
  /** Vehículos distintos trabajados en el período. */
  vehiculos: number;
  /** Cotizaciones aceptadas (un vehículo puede tener varias). */
  trabajos: number;
  /** Lo que se le cobró al cliente. */
  ingreso: number;
  /** Lo que costaron los repuestos. */
  gasto: number;
  ganancia: number;
  /** Ganancia sobre el ingreso, en porcentaje. */
  margen: number;
  /** Ingreso promedio por vehículo. */
  promedio: number;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function resumir(quotations: Quotation[]): Resumen {
  const vehiculos = new Set<string>();
  let ingreso = 0;
  let gasto = 0;

  for (const q of quotations) {
    vehiculos.add(q.vehicleId);
    ingreso += q.subtotal;
    gasto += q.costTotal;
  }

  const ing = round2(ingreso);
  const gas = round2(gasto);
  const ganancia = round2(ing - gas);

  return {
    vehiculos: vehiculos.size,
    trabajos: quotations.length,
    ingreso: ing,
    gasto: gas,
    ganancia,
    margen: ing ? Math.round((ganancia / ing) * 1000) / 10 : 0,
    promedio: vehiculos.size ? round2(ing / vehiculos.size) : 0,
  };
}

/** Filtra por rango [desde, hasta) y por estado contable. */
export function enRango(quotations: Quotation[], desde: Date, hasta: Date): Quotation[] {
  const a = desde.getTime();
  const b = hasta.getTime();
  return quotations.filter((q) => {
    if (!cuentaParaMetricas(q)) { return false; }
    const t = fechaDeMetrica(q).getTime();
    return t >= a && t < b;
  });
}

// ===========================================================================
// Rangos de tiempo
// ===========================================================================

export function inicioDelDia(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** La semana empieza el LUNES: es como se cuenta el trabajo en el taller. */
export function inicioDeSemana(d: Date): Date {
  const base = inicioDelDia(d);
  const dia = (base.getDay() + 6) % 7; // 0 = lunes
  base.setDate(base.getDate() - dia);
  return base;
}

export function inicioDeMes(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function sumaDias(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function sumaMeses(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

export interface Rango {
  clave: string;
  etiqueta: string;
  desde: Date;
  hasta: Date;
}

/**
 * Los períodos que ofrece la pantalla. `hoy` se recibe como parámetro para
 * que las pruebas no dependan del reloj.
 */
export function rangosDisponibles(hoy: Date = new Date()): Rango[] {
  const dia = inicioDelDia(hoy);
  const semana = inicioDeSemana(hoy);
  const mes = inicioDeMes(hoy);
  const mesAnterior = sumaMeses(mes, -1);

  return [
    { clave: 'hoy', etiqueta: 'Hoy', desde: dia, hasta: sumaDias(dia, 1) },
    { clave: 'semana', etiqueta: 'Esta semana', desde: semana, hasta: sumaDias(semana, 7) },
    { clave: 'mes', etiqueta: 'Este mes', desde: mes, hasta: sumaMeses(mes, 1) },
    { clave: 'mes-anterior', etiqueta: 'Mes anterior', desde: mesAnterior, hasta: mes },
    { clave: 'trimestre', etiqueta: 'Últimos 3 meses', desde: sumaMeses(mes, -2), hasta: sumaMeses(mes, 1) },
    { clave: 'anio', etiqueta: 'Este año', desde: new Date(hoy.getFullYear(), 0, 1), hasta: new Date(hoy.getFullYear() + 1, 0, 1) },
  ];
}

// ===========================================================================
// Series para las gráficas
// ===========================================================================

export interface Punto {
  etiqueta: string;
  desde: Date;
  hasta: Date;
  resumen: Resumen;
}

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

/** Últimos `n` meses, del más viejo al más nuevo. */
export function serieMensual(quotations: Quotation[], n = 6, hoy: Date = new Date()): Punto[] {
  const base = inicioDeMes(hoy);
  const puntos: Punto[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const desde = sumaMeses(base, -i);
    const hasta = sumaMeses(desde, 1);
    puntos.push({
      etiqueta: MESES[desde.getMonth()],
      desde, hasta,
      resumen: resumir(enRango(quotations, desde, hasta)),
    });
  }
  return puntos;
}

/** Los 7 días de la semana en curso, de lunes a domingo. */
export function serieSemanal(quotations: Quotation[], hoy: Date = new Date()): Punto[] {
  const lunes = inicioDeSemana(hoy);
  const puntos: Punto[] = [];
  for (let i = 0; i < 7; i++) {
    const desde = sumaDias(lunes, i);
    const hasta = sumaDias(desde, 1);
    puntos.push({
      etiqueta: DIAS[i],
      desde, hasta,
      resumen: resumir(enRango(quotations, desde, hasta)),
    });
  }
  return puntos;
}

// ===========================================================================
// Detalle por vehículo
// ===========================================================================

export interface FilaVehiculo {
  vehicleId: string;
  clientId: string;
  trabajos: number;
  ingreso: number;
  gasto: number;
  ganancia: number;
  ultima: string; // ISO
}

/** Un renglón por vehículo, ordenado por ganancia de mayor a menor. */
export function porVehiculo(quotations: Quotation[]): FilaVehiculo[] {
  const mapa = new Map<string, FilaVehiculo>();

  for (const q of quotations) {
    const fila = mapa.get(q.vehicleId) ?? {
      vehicleId: q.vehicleId, clientId: q.clientId,
      trabajos: 0, ingreso: 0, gasto: 0, ganancia: 0,
      ultima: fechaDeMetrica(q).toISOString(),
    };
    fila.trabajos += 1;
    fila.ingreso = round2(fila.ingreso + q.subtotal);
    fila.gasto = round2(fila.gasto + q.costTotal);
    fila.ganancia = round2(fila.ingreso - fila.gasto);
    const fecha = fechaDeMetrica(q).toISOString();
    if (fecha > fila.ultima) { fila.ultima = fecha; }
    mapa.set(q.vehicleId, fila);
  }

  return [...mapa.values()].sort((a, b) => b.ganancia - a.ganancia);
}
