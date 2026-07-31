import { TestBed } from '@angular/core/testing';
import { QuotationService } from './quotation.service';

describe('QuotationService (correlativo)', () => {
  let service: QuotationService;
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(QuotationService);
  });

  it('genera correlativos consecutivos con formato COT-0000', () => {
    expect(service.nextNumber()).toBe('COT-0001');
    expect(service.nextNumber()).toBe('COT-0002');
    expect(service.nextNumber()).toBe('COT-0003');
  });

  it('no permite crear una cotización sin artículos', (done) => {
    service.create({
      clientId: 'c1', vehicleId: 'v1', date: new Date().toISOString(), validityDays: 15,
      mileage: 0, paymentMethod: '', notes: '', considerations: '', applyTax: false, taxRate: 0,
      items: [], status: 'draft',
    }).subscribe({
      next: () => done.fail('no debía crear sin artículos'),
      error: (e: Error) => { expect(e.message).toContain('al menos un artículo'); done(); },
    });
  });
});
