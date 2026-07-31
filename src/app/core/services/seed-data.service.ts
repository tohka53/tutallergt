import { Injectable, inject } from '@angular/core';
import { StorageService } from './storage.service';
import { SEED_PARTS } from './catalog.data';
import {
  Client, Quotation, User, Vehicle, WorkshopService,
} from '../../models';
import { computeItemSubtotal, computeQuotationTotals, round2 } from './quotation.service';
import { computeServiceTotal } from './workshop-service.service';

/**
 * Carga datos de demostración realistas la primera vez que se abre la app.
 * PRODUCCIÓN: eliminar este servicio; los datos vendrán del backend.
 */
@Injectable({ providedIn: 'root' })
export class SeedDataService {
  private storage = inject(StorageService);
  private readonly seededKey = 'seeded-v1';

  seedIfNeeded(): void {
    if (this.storage.get<boolean>(this.seededKey, false)) { return; }

    const now = new Date();
    const iso = (d: Date) => d.toISOString();
    const daysAgo = (n: number) => iso(new Date(now.getTime() - n * 86400000));

    const users: User[] = [
      { id: 'user-mechanic', email: 'mecanico@demo.com', displayName: 'Carlos Méndez', role: 'mechanic', active: true, createdAt: daysAgo(120) },
      { id: 'user-client-1', email: 'cliente@demo.com', displayName: 'Ana Ramírez', role: 'client', clientId: 'client-1', active: true, createdAt: daysAgo(90) },
      { id: 'user-client-2', email: 'jorge@demo.com', displayName: 'Jorge López', role: 'client', clientId: 'client-2', active: true, createdAt: daysAgo(60) },
    ];

    const clients: Client[] = [
      { id: 'client-1', firstName: 'Ana', lastName: 'Ramírez', taxId: '2456781-9', phone: '+502 5512-3344', whatsapp: '50255123344', email: 'cliente@demo.com', address: '10a. Calle 5-23, Zona 14, Guatemala', notes: 'Cliente frecuente. Prefiere contacto por WhatsApp.', createdAt: daysAgo(90), active: true, userId: 'user-client-1' },
      { id: 'client-2', firstName: 'Jorge', lastName: 'López', taxId: 'CF', phone: '+502 4423-8890', whatsapp: '50244238890', email: 'jorge@demo.com', address: '2a. Avenida 8-15, Zona 1, Mixco', notes: '', createdAt: daysAgo(60), active: true, userId: 'user-client-2' },
    ];

    const vehicles: Vehicle[] = [
      { id: 'vehicle-1', ownerId: 'client-1', plate: 'P-234ABC', vin: '5J6RE4H50BL000111', brand: 'Honda', model: 'CR-V', year: 2011, color: 'Gris plata', type: 'SUV', engineSize: '2.4L', fuelType: 'Gasolina', transmission: 'Automática', mileage: 148500, origin: 'agency', notes: 'Mantenimiento al día.', createdAt: daysAgo(85), active: true },
      { id: 'vehicle-2', ownerId: 'client-1', plate: 'P-889XYZ', vin: 'JTDBR32E730000222', brand: 'Toyota', model: 'Corolla', year: 2016, color: 'Blanco', type: 'Sedán', engineSize: '1.8L', fuelType: 'Gasolina', transmission: 'Automática', mileage: 92300, origin: 'agency', notes: '', createdAt: daysAgo(70), active: true },
      { id: 'vehicle-3', ownerId: 'client-2', plate: 'P-450DEF', vin: 'MMBJNKA10FD000333', brand: 'Mitsubishi', model: 'Lancer', year: 2013, color: 'Negro', type: 'Sedán', engineSize: '2.0L', fuelType: 'Gasolina', transmission: 'Manual', mileage: 118700, origin: 'imported', originCountry: 'Estados Unidos', engineNumber: '4B11-000333', notes: 'Vehículo rodado/importado.', createdAt: daysAgo(55), active: true },
    ];

    // ===== Cotización con repuestos y mano de obra (Honda CR-V) =====
    const q1Items = [
      { id: 'qi-1', type: 'part' as const, code: 'FRE-PAS-007', name: 'Pastillas de freno delanteras', quantity: 1, unitPrice: 320, discount: 0, note: '' },
      { id: 'qi-2', type: 'part' as const, code: 'FRE-DIS-009', name: 'Disco de freno delantero', quantity: 2, unitPrice: 420, discount: 40, note: 'Par delantero' },
      { id: 'qi-3', type: 'labor' as const, code: 'MO-FRE-031', name: 'Mano de obra: cambio de frenos', quantity: 1, unitPrice: 250, discount: 0, note: '' },
      { id: 'qi-4', type: 'part' as const, code: 'FIL-AC-001', name: 'Filtro de aceite', quantity: 1, unitPrice: 55, discount: 0, note: '' },
      { id: 'qi-5', type: 'lubricant' as const, code: 'LUB-5W30-005', name: 'Aceite sintético 5W-30 (litro)', quantity: 4, unitPrice: 78, discount: 0, note: '' },
      { id: 'qi-6', type: 'labor' as const, code: 'MO-CAMB-030', name: 'Mano de obra: cambio de aceite y filtro', quantity: 1, unitPrice: 120, discount: 0, note: '' },
    ].map((it) => ({ ...it, subtotal: computeItemSubtotal(it) }));

    const q1Totals = computeQuotationTotals(q1Items as Quotation['items'], true, 12);
    const quotations: Quotation[] = [
      {
        id: 'quotation-1', number: 'COT-0001', clientId: 'client-1', vehicleId: 'vehicle-1',
        date: daysAgo(10), validityDays: 15, mileage: 148500, paymentMethod: 'Efectivo / Transferencia',
        notes: 'Se recomienda revisar niveles en el próximo servicio.',
        considerations: 'Los precios pueden variar según disponibilidad de repuestos.',
        applyTax: true, taxRate: 12, items: q1Items as Quotation['items'], status: 'sent',
        ...q1Totals, createdAt: daysAgo(10), updatedAt: daysAgo(9),
      },
    ];

    // ===== Servicio en proceso (Toyota Corolla) =====
    const s1Items = [
      { id: 'si-1', type: 'part' as const, code: 'ELE-BAT-018', name: 'Batería 12V 60Ah', quantity: 1, unitPrice: 750, discount: 0 },
      { id: 'si-2', type: 'labor' as const, code: 'MO-DIAG-032', name: 'Mano de obra: diagnóstico con escáner', quantity: 1, unitPrice: 175, discount: 0 },
    ].map((it) => ({ ...it, subtotal: computeItemSubtotal(it) }));

    // ===== Servicio terminado (Mitsubishi Lancer) =====
    const s2Items = [
      { id: 'si-3', type: 'part' as const, code: 'SUS-AMO-011', name: 'Amortiguador delantero', quantity: 2, unitPrice: 650, discount: 0 },
      { id: 'si-4', type: 'labor' as const, code: 'MO-SUS-034', name: 'Mano de obra: cambio de amortiguadores', quantity: 1, unitPrice: 400, discount: 0 },
    ].map((it) => ({ ...it, subtotal: computeItemSubtotal(it) }));

    const services: WorkshopService[] = [
      {
        id: 'service-1', number: 'ORD-0001', clientId: 'client-1', vehicleId: 'vehicle-2',
        entryDate: daysAgo(3), estimatedDelivery: daysAgo(-1), entryMileage: 92300, fuelLevel: '1/2',
        reason: 'El vehículo no enciende por las mañanas.',
        diagnosis: 'Batería con baja carga, se confirma con escáner. Alternador en buen estado.',
        requestedWork: 'Diagnóstico y reemplazo de batería.',
        performedWork: 'Reemplazo de batería en proceso.',
        internalNotes: 'Verificar consumo parásito antes de entregar.',
        clientVisibleNotes: 'Estamos reemplazando la batería. Le avisaremos al terminar.',
        items: s1Items, total: computeServiceTotal(s1Items),
        mechanicName: 'Carlos Méndez', status: 'repairing',
        statusHistory: [
          { id: 'h1', fromStatus: null, toStatus: 'received', changedAt: daysAgo(3), userId: 'user-mechanic', userName: 'Carlos Méndez', comment: 'Vehículo recibido' },
          { id: 'h2', fromStatus: 'received', toStatus: 'diagnosis', changedAt: daysAgo(3), userId: 'user-mechanic', userName: 'Carlos Méndez', comment: 'Inicia diagnóstico' },
          { id: 'h3', fromStatus: 'diagnosis', toStatus: 'repairing', changedAt: daysAgo(2), userId: 'user-mechanic', userName: 'Carlos Méndez', comment: 'Autorizado por el cliente, inicia reparación' },
        ],
        createdAt: daysAgo(3), updatedAt: daysAgo(2),
      },
      {
        id: 'service-2', number: 'ORD-0002', clientId: 'client-2', vehicleId: 'vehicle-3',
        entryDate: daysAgo(20), estimatedDelivery: daysAgo(16), actualDelivery: daysAgo(15),
        entryMileage: 118700, fuelLevel: '3/4',
        reason: 'Ruido en la suspensión delantera al pasar topes.',
        diagnosis: 'Amortiguadores delanteros vencidos.',
        requestedWork: 'Cambio de amortiguadores delanteros.',
        performedWork: 'Se reemplazaron ambos amortiguadores delanteros y se realizó prueba de manejo.',
        internalNotes: '',
        clientVisibleNotes: 'Trabajo terminado y entregado. Gracias por su preferencia.',
        items: s2Items, total: computeServiceTotal(s2Items),
        mechanicName: 'Carlos Méndez', status: 'delivered',
        statusHistory: [
          { id: 'h4', fromStatus: null, toStatus: 'received', changedAt: daysAgo(20), userId: 'user-mechanic', userName: 'Carlos Méndez', comment: 'Vehículo recibido' },
          { id: 'h5', fromStatus: 'received', toStatus: 'repairing', changedAt: daysAgo(19), userId: 'user-mechanic', userName: 'Carlos Méndez', comment: 'Inicia reparación' },
          { id: 'h6', fromStatus: 'repairing', toStatus: 'testing', changedAt: daysAgo(17), userId: 'user-mechanic', userName: 'Carlos Méndez', comment: 'Prueba de manejo' },
          { id: 'h7', fromStatus: 'testing', toStatus: 'done', changedAt: daysAgo(16), userId: 'user-mechanic', userName: 'Carlos Méndez', comment: 'Trabajo terminado' },
          { id: 'h8', fromStatus: 'done', toStatus: 'delivered', changedAt: daysAgo(15), userId: 'user-mechanic', userName: 'Carlos Méndez', comment: 'Entregado al cliente' },
        ],
        createdAt: daysAgo(20), updatedAt: daysAgo(15),
      },
    ];

    void round2; // referencia para evitar tree-shake en algunos linters

    this.storage.set('users', users);
    this.storage.set('clients', clients);
    this.storage.set('vehicles', vehicles);
    this.storage.set('parts-catalog', SEED_PARTS);
    this.storage.set('quotations', quotations);
    this.storage.set('quotation-seq', 1);
    this.storage.set('workshop-services', services);
    this.storage.set('service-seq', 2);
    this.storage.set(this.seededKey, true);
  }
}
