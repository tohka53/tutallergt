import { TestBed } from '@angular/core/testing';
import { WorkshopServiceService, computeServiceTotal } from './workshop-service.service';
import { QuotationService } from './quotation.service';
import { AuthService } from './auth.service';
import { Quotation, QuotationItem, User, WorkshopServiceItem } from '../../models';

const users: User[] = [
  { id: 'user-mechanic', email: 'mecanico@demo.com', displayName: 'Carlos', role: 'mechanic', active: true, createdAt: '2024-01-01' },
];

function sampleItems(): QuotationItem[] {
  return [
    { id: 'i1', type: 'part', name: 'Pastillas', quantity: 1, unitPrice: 320, discount: 0, subtotal: 320 },
    { id: 'i2', type: 'labor', name: 'Mano de obra', quantity: 1, unitPrice: 250, discount: 0, subtotal: 250 },
  ];
}

describe('WorkshopServiceService (conversión y estados)', () => {
  let services: WorkshopServiceService;
  let quotations: QuotationService;
  let auth: AuthService;

  beforeEach((done) => {
    localStorage.clear();
    localStorage.setItem('taller-control:users', JSON.stringify(users));
    TestBed.configureTestingModule({});
    services = TestBed.inject(WorkshopServiceService);
    quotations = TestBed.inject(QuotationService);
    auth = TestBed.inject(AuthService);
    auth.login('mecanico@demo.com', 'Demo123!').subscribe(() => done());
  });

  function createQuotation(): Promise<Quotation> {
    return new Promise((resolve) => {
      quotations.create({
        clientId: 'client-1', vehicleId: 'vehicle-1', date: new Date().toISOString(),
        validityDays: 15, mileage: 1000, paymentMethod: 'Efectivo', notes: '', considerations: '',
        applyTax: true, taxRate: 12, items: sampleItems(), status: 'sent',
      }).subscribe(resolve);
    });
  }

  it('genera correlativos de servicio ORD-0000', () => {
    expect(services.nextNumber()).toBe('ORD-0001');
    expect(services.nextNumber()).toBe('ORD-0002');
  });

  it('convierte una cotización en servicio copiando los artículos', async () => {
    const q = await createQuotation();
    const items: WorkshopServiceItem[] = q.items.map((it) => ({ ...it }));
    await new Promise<void>((resolve) => {
      services.createFromQuotation(q, items, {}).subscribe((svc) => {
        expect(svc.quotationId).toBe(q.id);
        expect(svc.items.length).toBe(2);
        expect(svc.total).toBe(computeServiceTotal(items));
        expect(svc.statusHistory.length).toBe(1);
        expect(svc.status).toBe('received');
        resolve();
      });
    });
  });

  it('evita conversiones duplicadas de la misma cotización', async () => {
    const q = await createQuotation();
    const items: WorkshopServiceItem[] = q.items.map((it) => ({ ...it }));
    await new Promise<void>((resolve) => {
      services.createFromQuotation(q, items, {}).subscribe((svc) => {
        quotations.setStatus(q.id, 'converted', svc.id).subscribe((updated) => {
          services.createFromQuotation(updated, items, {}).subscribe({
            next: () => resolve(fail('no debía convertir dos veces') as unknown as void),
            error: (e: Error) => { expect(e.message).toContain('ya fue convertida'); resolve(); },
          });
        });
      });
    });
  });

  it('registra el historial al cambiar de estado', async () => {
    const q = await createQuotation();
    const items: WorkshopServiceItem[] = q.items.map((it) => ({ ...it }));
    await new Promise<void>((resolve) => {
      services.createFromQuotation(q, items, {}).subscribe((svc) => {
        services.changeStatus(svc.id, 'repairing', 'Inicia reparación').subscribe((updated) => {
          expect(updated.status).toBe('repairing');
          expect(updated.statusHistory.length).toBe(2);
          expect(updated.statusHistory[1].fromStatus).toBe('received');
          expect(updated.statusHistory[1].toStatus).toBe('repairing');
          resolve();
        });
      });
    });
  });
});
