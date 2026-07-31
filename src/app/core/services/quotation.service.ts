import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { delay, map } from 'rxjs/operators';
import { Quotation, QuotationItem } from '../../models';
import { StorageService } from './storage.service';
import { uuid } from './id.util';

/** Calcula el subtotal de una línea evitando valores negativos. */
export function computeItemSubtotal(item: Pick<QuotationItem, 'quantity' | 'unitPrice' | 'discount'>): number {
  const qty = Math.max(0, item.quantity || 0);
  const price = Math.max(0, item.unitPrice || 0);
  const discount = Math.max(0, item.discount || 0);
  return Math.max(0, round2(qty * price - discount));
}

/** Calcula todos los totales de una cotización a partir de sus artículos. */
export function computeQuotationTotals(
  items: QuotationItem[],
  applyTax: boolean,
  taxRate: number
): Pick<Quotation, 'partsSubtotal' | 'laborSubtotal' | 'discountTotal' | 'taxAmount' | 'total'> {
  let partsSubtotal = 0;
  let laborSubtotal = 0;
  let discountTotal = 0;
  for (const it of items) {
    const sub = computeItemSubtotal(it);
    if (it.type === 'labor') { laborSubtotal += sub; } else { partsSubtotal += sub; }
    discountTotal += Math.max(0, it.discount || 0);
  }
  const base = round2(partsSubtotal + laborSubtotal);
  const taxAmount = applyTax ? round2(base * (Math.max(0, taxRate) / 100)) : 0;
  const total = round2(base + taxAmount);
  return {
    partsSubtotal: round2(partsSubtotal),
    laborSubtotal: round2(laborSubtotal),
    discountTotal: round2(discountTotal),
    taxAmount,
    total,
  };
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

@Injectable({ providedIn: 'root' })
export class QuotationService {
  private storage = inject(StorageService);
  private readonly key = 'quotations';
  private readonly seqKey = 'quotation-seq';
  private subject = new BehaviorSubject<Quotation[]>(this.storage.get<Quotation[]>(this.key, []));
  readonly quotations$ = this.subject.asObservable();

  private persist(items: Quotation[]): void {
    this.storage.set(this.key, items);
    this.subject.next(items);
  }

  /** Genera correlativo COT-0001, COT-0002, ... */
  nextNumber(): string {
    const current = this.storage.get<number>(this.seqKey, 0) + 1;
    this.storage.set(this.seqKey, current);
    return 'COT-' + current.toString().padStart(4, '0');
  }

  list(): Observable<Quotation[]> {
    return of([...this.subject.value]).pipe(delay(150));
  }

  listByClient(clientId: string): Observable<Quotation[]> {
    return this.quotations$.pipe(map((l) => l.filter((q) => q.clientId === clientId)));
  }

  listByVehicle(vehicleId: string): Observable<Quotation[]> {
    return this.quotations$.pipe(map((l) => l.filter((q) => q.vehicleId === vehicleId)));
  }

  getById(id: string): Observable<Quotation | undefined> {
    return of(this.subject.value.find((q) => q.id === id)).pipe(delay(100));
  }

  create(data: Omit<Quotation, 'id' | 'number' | 'createdAt' | 'updatedAt' | 'partsSubtotal' | 'laborSubtotal' | 'discountTotal' | 'taxAmount' | 'total'>): Observable<Quotation> {
    if (!data.items || data.items.length === 0) {
      return throwError(() => new Error('La cotización debe tener al menos un artículo.'));
    }
    const totals = computeQuotationTotals(data.items, data.applyTax, data.taxRate);
    const now = new Date().toISOString();
    const quotation: Quotation = {
      ...data,
      ...totals,
      id: uuid(),
      number: this.nextNumber(),
      createdAt: now,
      updatedAt: now,
    };
    this.persist([...this.subject.value, quotation]);
    return of(quotation).pipe(delay(150));
  }

  update(id: string, changes: Partial<Quotation>): Observable<Quotation> {
    const items = this.subject.value.map((q) => {
      if (q.id !== id) { return q; }
      const merged: Quotation = { ...q, ...changes, id };
      const totals = computeQuotationTotals(merged.items, merged.applyTax, merged.taxRate);
      return { ...merged, ...totals, updatedAt: new Date().toISOString() };
    });
    this.persist(items);
    return of(items.find((q) => q.id === id) as Quotation).pipe(delay(150));
  }

  setStatus(id: string, status: Quotation['status'], convertedServiceId?: string): Observable<Quotation> {
    return this.update(id, { status, ...(convertedServiceId ? { convertedServiceId } : {}) });
  }
}
