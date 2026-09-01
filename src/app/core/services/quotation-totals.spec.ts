import { QuotationItem } from '../../models';
import {
  computeItemCost, computeItemSubtotal, computeQuotationTotals, normalizeItems,
} from './quotation.service';

function item(p: Partial<QuotationItem>): QuotationItem {
  return {
    id: 'i', type: 'part', name: 'x', quantity: 1,
    unitCost: 0, unitPrice: 0, discount: 0, subtotal: 0, costSubtotal: 0,
    ...p,
  };
}

describe('subtotal de la línea (lo que se le cobra al cliente)', () => {
  it('cantidad por precio menos descuento', () => {
    expect(computeItemSubtotal(item({ quantity: 2, unitPrice: 420, discount: 40 }))).toBe(800);
  });
  it('nunca es negativo aunque el descuento se pase', () => {
    expect(computeItemSubtotal(item({ quantity: 1, unitPrice: 100, discount: 500 }))).toBe(0);
  });
  it('trata los valores negativos como cero', () => {
    expect(computeItemSubtotal(item({ quantity: -3, unitPrice: 100, discount: 0 }))).toBe(0);
  });
  it('redondea a dos decimales', () => {
    expect(computeItemSubtotal(item({ quantity: 3, unitPrice: 33.333, discount: 0 }))).toBe(100);
  });
});

describe('costo de la línea (lo que le cuesta al taller)', () => {
  it('cantidad por costo unitario', () => {
    expect(computeItemCost(item({ type: 'part', quantity: 2, unitCost: 195 }))).toBe(390);
  });
  it('la mano de obra siempre cuesta cero, aunque le escriban un costo', () => {
    expect(computeItemCost(item({ type: 'labor', quantity: 1, unitCost: 999 }))).toBe(0);
  });
  it('el descuento al cliente no cambia lo que costó el repuesto', () => {
    expect(computeItemCost(item({ type: 'part', quantity: 1, unitCost: 100, discount: 50 }))).toBe(100);
  });
});

describe('totales de la cotización', () => {
  // El caso del formato en papel: cable de freno + mano de obra = Q1,060.
  const cotizacionReal = [
    item({ id: '1', type: 'part', name: 'Cable de freno de mano', quantity: 1, unitCost: 390, unitPrice: 610 }),
    item({ id: '2', type: 'labor', name: 'MO cambio de cable', quantity: 1, unitPrice: 450 }),
  ];

  it('separa repuestos de mano de obra', () => {
    const t = computeQuotationTotals(normalizeItems(cotizacionReal));
    expect(t.partsSubtotal).toBe(610);
    expect(t.laborSubtotal).toBe(450);
    expect(t.subtotal).toBe(1060);
  });

  it('la ganancia es el subtotal menos lo que costaron los repuestos', () => {
    const t = computeQuotationTotals(normalizeItems(cotizacionReal));
    expect(t.costTotal).toBe(390);
    expect(t.profit).toBe(670);
  });

  it('el anticipo se resta del total pero no de la ganancia', () => {
    const t = computeQuotationTotals(normalizeItems(cotizacionReal), 300);
    expect(t.advance).toBe(300);
    expect(t.total).toBe(760);
    // El anticipo es dinero del mismo trabajo, no una rebaja: la ganancia no cambia.
    expect(t.profit).toBe(670);
    expect(t.subtotal).toBe(1060);
  });

  it('un anticipo mayor al subtotal no deja el total en negativo', () => {
    const t = computeQuotationTotals(normalizeItems(cotizacionReal), 5000);
    expect(t.total).toBe(0);
  });

  it('sin anticipo, el total es igual al subtotal', () => {
    const t = computeQuotationTotals(normalizeItems(cotizacionReal));
    expect(t.total).toBe(t.subtotal);
  });

  it('suma los descuentos de todas las líneas', () => {
    const t = computeQuotationTotals(normalizeItems([
      item({ id: '1', quantity: 1, unitPrice: 200, discount: 20 }),
      item({ id: '2', quantity: 1, unitPrice: 300, discount: 30 }),
    ]));
    expect(t.discountTotal).toBe(50);
    expect(t.subtotal).toBe(450);
  });

  it('una cotización vacía da todo en cero', () => {
    const t = computeQuotationTotals([]);
    expect(t.subtotal).toBe(0);
    expect(t.profit).toBe(0);
    expect(t.total).toBe(0);
  });

  it('avisa cuando se está vendiendo por debajo del costo', () => {
    const t = computeQuotationTotals(normalizeItems([
      item({ type: 'part', quantity: 1, unitCost: 500, unitPrice: 400 }),
    ]));
    expect(t.profit).toBe(-100);
  });
});

describe('normalizeItems', () => {
  it('pone en cero el costo de la mano de obra antes de guardar', () => {
    const [mo] = normalizeItems([item({ type: 'labor', quantity: 1, unitCost: 800, unitPrice: 450 })]);
    expect(mo.unitCost).toBe(0);
    expect(mo.costSubtotal).toBe(0);
  });

  it('rellena subtotal y costSubtotal de cada línea', () => {
    const [pieza] = normalizeItems([
      item({ type: 'part', quantity: 2, unitCost: 100, unitPrice: 180, discount: 30 }),
    ]);
    expect(pieza.subtotal).toBe(330);
    expect(pieza.costSubtotal).toBe(200);
  });
});
