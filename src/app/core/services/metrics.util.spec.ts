import { Quotation, QuotationItem } from '../../models';
import {
  cuentaParaMetricas, enRango, inicioDeSemana, porVehiculo, rangosDisponibles,
  resumir, serieMensual, serieSemanal,
} from './metrics.util';

function item(p: Partial<QuotationItem>): QuotationItem {
  const base: QuotationItem = {
    id: 'i', type: 'part', name: 'x', quantity: 1,
    unitCost: 0, unitPrice: 0, discount: 0, subtotal: 0, costSubtotal: 0,
  };
  const merged = { ...base, ...p };
  merged.subtotal = merged.quantity * merged.unitPrice - merged.discount;
  merged.costSubtotal = merged.type === 'labor' ? 0 : merged.quantity * merged.unitCost;
  return merged;
}

function quotation(p: Partial<Quotation>): Quotation {
  const items = p.items ?? [];
  const subtotal = items.reduce((s, i) => s + i.subtotal, 0);
  const costTotal = items.reduce((s, i) => s + i.costSubtotal, 0);
  return {
    id: 'q', number: 'COT-0001', clientId: 'c1', vehicleId: 'v1',
    date: '2026-06-15T12:00:00.000Z', validityDays: 15, mileage: 0,
    paymentMethod: '', notes: '', considerations: '',
    items, status: 'accepted',
    partsSubtotal: 0, laborSubtotal: 0, discountTotal: 0,
    subtotal, advance: 0, total: subtotal,
    costTotal, profit: subtotal - costTotal,
    createdAt: '2026-06-15T12:00:00.000Z', updatedAt: '2026-06-15T12:00:00.000Z',
    ...p,
  } as Quotation;
}

describe('métricas: qué cuenta', () => {
  it('sólo cuentan las aceptadas y las convertidas', () => {
    expect(cuentaParaMetricas(quotation({ status: 'accepted' }))).toBe(true);
    expect(cuentaParaMetricas(quotation({ status: 'converted' }))).toBe(true);
    expect(cuentaParaMetricas(quotation({ status: 'sent' }))).toBe(false);
    expect(cuentaParaMetricas(quotation({ status: 'draft' }))).toBe(false);
    expect(cuentaParaMetricas(quotation({ status: 'void' }))).toBe(false);
  });

  it('una cotización enviada pero sin respuesta no entra en el rango', () => {
    const lista = [
      quotation({ id: 'a', status: 'accepted', date: '2026-06-10T00:00:00.000Z' }),
      quotation({ id: 'b', status: 'sent', date: '2026-06-11T00:00:00.000Z' }),
    ];
    const dentro = enRango(lista, new Date(2026, 5, 1), new Date(2026, 6, 1));
    expect(dentro.map((q) => q.id)).toEqual(['a']);
  });
});

describe('métricas: gasto, ingreso y ganancia', () => {
  it('la mano de obra no suma gasto: toda es ganancia', () => {
    const q = quotation({
      items: [
        item({ id: '1', type: 'part', quantity: 1, unitCost: 390, unitPrice: 610 }),
        item({ id: '2', type: 'labor', quantity: 1, unitCost: 999, unitPrice: 450 }),
      ],
    });
    const r = resumir([q]);
    expect(r.ingreso).toBe(1060);
    expect(r.gasto).toBe(390);      // sólo el repuesto
    expect(r.ganancia).toBe(670);   // 220 del repuesto + 450 de mano de obra
  });

  it('el margen es la ganancia sobre el ingreso', () => {
    const q = quotation({ items: [item({ quantity: 1, unitCost: 50, unitPrice: 100 })] });
    expect(resumir([q]).margen).toBe(50);
  });

  it('cuenta vehículos distintos, no cotizaciones', () => {
    const lista = [
      quotation({ id: 'a', vehicleId: 'v1', items: [item({ quantity: 1, unitPrice: 100 })] }),
      quotation({ id: 'b', vehicleId: 'v1', items: [item({ quantity: 1, unitPrice: 100 })] }),
      quotation({ id: 'c', vehicleId: 'v2', items: [item({ quantity: 1, unitPrice: 100 })] }),
    ];
    const r = resumir(lista);
    expect(r.vehiculos).toBe(2);
    expect(r.trabajos).toBe(3);
    expect(r.promedio).toBe(150); // 300 entre 2 vehículos
  });

  it('sin datos devuelve ceros y no divide entre cero', () => {
    const r = resumir([]);
    expect(r.ingreso).toBe(0);
    expect(r.margen).toBe(0);
    expect(r.promedio).toBe(0);
  });
});

describe('métricas: fechas', () => {
  it('usa la fecha de aceptación, no la de creación', () => {
    const q = quotation({
      date: '2026-05-20T12:00:00.000Z',
      acceptedAt: '2026-06-05T12:00:00.000Z',
      items: [item({ quantity: 1, unitPrice: 100 })],
    });
    expect(enRango([q], new Date(2026, 4, 1), new Date(2026, 5, 1)).length).toBe(0);
    expect(enRango([q], new Date(2026, 5, 1), new Date(2026, 6, 1)).length).toBe(1);
  });

  it('la semana empieza el lunes', () => {
    // 2026-09-01 es martes; el lunes de esa semana es el 31 de agosto.
    const lunes = inicioDeSemana(new Date(2026, 8, 1));
    expect(lunes.getDay()).toBe(1);
    expect(lunes.getDate()).toBe(31);
    expect(lunes.getMonth()).toBe(7);
  });

  it('un domingo pertenece a la semana que empezó el lunes anterior', () => {
    const lunes = inicioDeSemana(new Date(2026, 8, 6)); // domingo 6/9/2026
    expect(lunes.getDate()).toBe(31);
  });

  it('el rango "mes anterior" no se traslapa con "este mes"', () => {
    const rangos = rangosDisponibles(new Date(2026, 8, 15));
    const mes = rangos.find((r) => r.clave === 'mes')!;
    const anterior = rangos.find((r) => r.clave === 'mes-anterior')!;
    expect(anterior.hasta.getTime()).toBe(mes.desde.getTime());
    expect(anterior.desde.getMonth()).toBe(7);
  });

  it('la serie mensual devuelve n meses terminando en el actual', () => {
    const serie = serieMensual([], 6, new Date(2026, 8, 15));
    expect(serie.length).toBe(6);
    expect(serie[5].etiqueta).toBe('Sep');
    expect(serie[0].etiqueta).toBe('Abr');
  });

  it('la serie semanal devuelve los 7 días', () => {
    const serie = serieSemanal([], new Date(2026, 8, 1));
    expect(serie.length).toBe(7);
    expect(serie[0].etiqueta).toBe('Lun');
    expect(serie[6].etiqueta).toBe('Dom');
  });
});

describe('métricas: detalle por vehículo', () => {
  it('agrupa por vehículo y ordena por ganancia', () => {
    const lista = [
      quotation({ id: 'a', vehicleId: 'v1', items: [item({ quantity: 1, unitCost: 10, unitPrice: 100 })] }),
      quotation({ id: 'b', vehicleId: 'v1', items: [item({ quantity: 1, unitCost: 10, unitPrice: 100 })] }),
      quotation({ id: 'c', vehicleId: 'v2', items: [item({ quantity: 1, unitCost: 0, unitPrice: 500 })] }),
    ];
    const filas = porVehiculo(lista);
    expect(filas.length).toBe(2);
    expect(filas[0].vehicleId).toBe('v2');
    expect(filas[0].ganancia).toBe(500);
    expect(filas[1].vehicleId).toBe('v1');
    expect(filas[1].trabajos).toBe(2);
    expect(filas[1].ganancia).toBe(180);
  });
});
