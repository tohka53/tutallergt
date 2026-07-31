import { computeItemSubtotal, computeQuotationTotals, round2 } from './quotation.service';
import { QuotationItem } from '../../models';

function item(part: Partial<QuotationItem>): QuotationItem {
  return {
    id: 'x', type: 'part', name: 'test', quantity: 1, unitPrice: 0, discount: 0, subtotal: 0, ...part,
  } as QuotationItem;
}

describe('Cálculos de cotización', () => {
  it('calcula el subtotal de una línea (cantidad * precio - descuento)', () => {
    expect(computeItemSubtotal({ quantity: 2, unitPrice: 100, discount: 20 })).toBe(180);
  });

  it('nunca devuelve subtotales negativos', () => {
    expect(computeItemSubtotal({ quantity: 1, unitPrice: 50, discount: 100 })).toBe(0);
    expect(computeItemSubtotal({ quantity: -3, unitPrice: 100, discount: 0 })).toBe(0);
  });

  it('separa repuestos y mano de obra en los subtotales', () => {
    const items = [
      item({ type: 'part', quantity: 2, unitPrice: 100 }),   // 200
      item({ type: 'labor', quantity: 1, unitPrice: 250 }),  // 250
    ];
    const t = computeQuotationTotals(items, false, 0);
    expect(t.partsSubtotal).toBe(200);
    expect(t.laborSubtotal).toBe(250);
    expect(t.total).toBe(450);
  });

  it('aplica el impuesto configurable sobre la base', () => {
    const items = [item({ quantity: 1, unitPrice: 1000 })];
    const t = computeQuotationTotals(items, true, 12);
    expect(t.taxAmount).toBe(120);
    expect(t.total).toBe(1120);
  });

  it('no aplica impuesto cuando applyTax es falso', () => {
    const items = [item({ quantity: 1, unitPrice: 1000 })];
    const t = computeQuotationTotals(items, false, 12);
    expect(t.taxAmount).toBe(0);
    expect(t.total).toBe(1000);
  });

  it('suma los descuentos totales', () => {
    const items = [
      item({ quantity: 1, unitPrice: 500, discount: 50 }),
      item({ quantity: 1, unitPrice: 300, discount: 30 }),
    ];
    const t = computeQuotationTotals(items, false, 0);
    expect(t.discountTotal).toBe(80);
    expect(t.total).toBe(720);
  });

  it('redondea a dos decimales', () => {
    expect(round2(10.005)).toBe(10.01);
    expect(round2(2.675)).toBe(2.68);
  });
});
