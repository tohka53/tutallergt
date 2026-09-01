import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, from, of, throwError } from 'rxjs';
import { map } from 'rxjs/operators';
import { Quotation, QuotationItem } from '../../models';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { fromQuotationItem, toQuotation } from './mappers';

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Lo que se le cobra al cliente por la línea. */
export function computeItemSubtotal(
  item: Pick<QuotationItem, 'quantity' | 'unitPrice' | 'discount'>
): number {
  const qty = Math.max(0, item.quantity || 0);
  const price = Math.max(0, item.unitPrice || 0);
  const discount = Math.max(0, item.discount || 0);
  return Math.max(0, round2(qty * price - discount));
}

/**
 * Lo que le costó la línea al taller.
 *
 * La mano de obra devuelve 0 aunque alguien escriba un costo: no se compra en
 * ningún lado, es tiempo del taller. Si contara como gasto, la ganancia
 * saldría más baja de lo que realmente es.
 */
export function computeItemCost(
  item: Pick<QuotationItem, 'quantity' | 'unitCost' | 'type'>
): number {
  if (item.type === 'labor') { return 0; }
  const qty = Math.max(0, item.quantity || 0);
  const cost = Math.max(0, item.unitCost || 0);
  return round2(qty * cost);
}

export interface QuotationTotals {
  partsSubtotal: number;
  laborSubtotal: number;
  discountTotal: number;
  subtotal: number;
  costTotal: number;
  profit: number;
  advance: number;
  total: number;
}

/**
 * Totales de la cotización.
 *
 *   subtotal  = repuestos + mano de obra (ya con descuentos)
 *   costTotal = lo que el taller pagó por los repuestos
 *   profit    = subtotal - costTotal   ← lo que realmente se gana
 *   total     = subtotal - anticipo    ← el saldo que va grande en el PDF
 *
 * La ganancia se calcula sobre el subtotal, NO sobre el total: el anticipo es
 * dinero del mismo trabajo que ya se cobró antes, no una rebaja.
 */
export function computeQuotationTotals(items: QuotationItem[], advance = 0): QuotationTotals {
  let partsSubtotal = 0;
  let laborSubtotal = 0;
  let discountTotal = 0;
  let costTotal = 0;

  for (const it of items) {
    const sub = computeItemSubtotal(it);
    if (it.type === 'labor') { laborSubtotal += sub; } else { partsSubtotal += sub; }
    discountTotal += Math.max(0, it.discount || 0);
    costTotal += computeItemCost(it);
  }

  const subtotal = round2(partsSubtotal + laborSubtotal);
  const anticipo = Math.max(0, round2(advance || 0));

  return {
    partsSubtotal: round2(partsSubtotal),
    laborSubtotal: round2(laborSubtotal),
    discountTotal: round2(discountTotal),
    subtotal,
    costTotal: round2(costTotal),
    profit: round2(subtotal - costTotal),
    advance: anticipo,
    total: round2(Math.max(0, subtotal - anticipo)),
  };
}

/** Rellena subtotal y costSubtotal de cada línea. */
export function normalizeItems(items: QuotationItem[]): QuotationItem[] {
  return items.map((it) => ({
    ...it,
    unitCost: it.type === 'labor' ? 0 : Math.max(0, it.unitCost || 0),
    subtotal: computeItemSubtotal(it),
    costSubtotal: computeItemCost(it),
  }));
}

/** Lo que hace falta para crear: todo menos lo que se calcula solo. `advance` sí va. */
type NewQuotation = Omit<
  Quotation,
  'id' | 'number' | 'createdAt' | 'updatedAt'
  | 'partsSubtotal' | 'laborSubtotal' | 'discountTotal'
  | 'subtotal' | 'costTotal' | 'profit' | 'total'
>;

@Injectable({ providedIn: 'root' })
export class QuotationService {
  private sb = inject(SupabaseService);
  private auth = inject(AuthService);

  private subject = new BehaviorSubject<Quotation[]>([]);
  readonly quotations$ = this.subject.asObservable();

  get snapshot(): Quotation[] { return this.subject.value; }
  setAll(items: Quotation[]): void { this.subject.next(items); }
  clear(): void { this.subject.next([]); }

  /** Vuelve a leer todas las cotizaciones del mecánico con sus líneas. */
  async reload(): Promise<void> {
    const { data, error } = await this.sb.db
      .from('cotizaciones')
      .select('*, cotizacion_items(*)')
      .order('fecha', { ascending: false });
    if (error) { throw new Error(this.sb.mensaje(error)); }

    this.subject.next(
      (data ?? []).map((row) => {
        const items = ((row['cotizacion_items'] as Record<string, unknown>[]) ?? [])
          .sort((a, b) => Number(a['orden'] ?? 0) - Number(b['orden'] ?? 0));
        return toQuotation(row, items);
      })
    );
  }

  list(): Observable<Quotation[]> { return of([...this.subject.value]); }

  listByClient(clientId: string): Observable<Quotation[]> {
    return this.quotations$.pipe(map((l) => l.filter((q) => q.clientId === clientId)));
  }

  listByVehicle(vehicleId: string): Observable<Quotation[]> {
    return this.quotations$.pipe(map((l) => l.filter((q) => q.vehicleId === vehicleId)));
  }

  getById(id: string): Observable<Quotation | undefined> {
    return this.quotations$.pipe(map((l) => l.find((q) => q.id === id)));
  }

  /** Correlativo generado en el servidor para que dos pestañas no choquen. */
  private async nextNumber(): Promise<string> {
    const { data, error } = await this.sb.db.rpc('siguiente_correlativo', { p_tipo: 'cotizacion' });
    if (error) { throw new Error(this.sb.mensaje(error)); }
    return 'COT-' + String(data ?? 1).padStart(4, '0');
  }

  create(data: NewQuotation): Observable<Quotation> {
    if (!data.items || data.items.length === 0) {
      return throwError(() => new Error('La cotización debe tener al menos un artículo.'));
    }
    return from(this.createAsync(data));
  }

  private async createAsync(data: NewQuotation): Promise<Quotation> {
    const mecanicoId = this.auth.mechanicId;
    if (!mecanicoId) { throw new Error('Sólo el mecánico puede crear cotizaciones.'); }

    const items = normalizeItems(data.items);
    const totals = computeQuotationTotals(items, data.advance);
    const numero = await this.nextNumber();

    const { data: row, error } = await this.sb.db
      .from('cotizaciones')
      .insert({
        mecanico_id: mecanicoId,
        cliente_id: data.clientId,
        vehiculo_id: data.vehicleId,
        numero,
        fecha: data.date,
        validez_dias: data.validityDays,
        kilometraje: data.mileage,
        metodo_pago: data.paymentMethod,
        notas: data.notes,
        consideraciones: data.considerations,
        anticipo: totals.advance,
        subtotal_repuestos: totals.partsSubtotal,
        subtotal_mano_obra: totals.laborSubtotal,
        descuento_total: totals.discountTotal,
        subtotal: totals.subtotal,
        costo_total: totals.costTotal,
        ganancia: totals.profit,
        total: totals.total,
        estado: data.status,
      })
      .select()
      .single();
    if (error || !row) { throw new Error(this.sb.mensaje(error)); }

    await this.replaceItems(String(row['id']), items);
    await this.reload();
    return this.subject.value.find((q) => q.id === row['id']) as Quotation;
  }

  update(id: string, changes: Partial<Quotation>): Observable<Quotation> {
    return from(this.updateAsync(id, changes));
  }

  private async updateAsync(id: string, changes: Partial<Quotation>): Promise<Quotation> {
    const current = this.subject.value.find((q) => q.id === id);
    if (!current) { throw new Error('Cotización no encontrada.'); }

    const merged = { ...current, ...changes };
    const items = normalizeItems(merged.items);
    const totals = computeQuotationTotals(items, merged.advance);

    const row: Record<string, unknown> = {
      cliente_id: merged.clientId,
      vehiculo_id: merged.vehicleId,
      fecha: merged.date,
      validez_dias: merged.validityDays,
      kilometraje: merged.mileage,
      metodo_pago: merged.paymentMethod,
      notas: merged.notes,
      consideraciones: merged.considerations,
      anticipo: totals.advance,
      subtotal_repuestos: totals.partsSubtotal,
      subtotal_mano_obra: totals.laborSubtotal,
      descuento_total: totals.discountTotal,
      subtotal: totals.subtotal,
      costo_total: totals.costTotal,
      ganancia: totals.profit,
      total: totals.total,
      estado: merged.status,
      servicio_id: merged.convertedServiceId ?? null,
      aceptada_en: merged.acceptedAt ?? null,
    };

    const { error } = await this.sb.db.from('cotizaciones').update(row).eq('id', id);
    if (error) { throw new Error(this.sb.mensaje(error)); }

    if (changes.items) { await this.replaceItems(id, items); }
    await this.reload();
    return this.subject.value.find((q) => q.id === id) as Quotation;
  }

  /**
   * Borra y vuelve a insertar las líneas. Es más simple y más seguro que
   * intentar casar altas, bajas y reordenamientos uno por uno, y el número de
   * líneas de una cotización siempre es pequeño.
   */
  private async replaceItems(quotationId: string, items: QuotationItem[]): Promise<void> {
    const del = await this.sb.db.from('cotizacion_items').delete().eq('cotizacion_id', quotationId);
    if (del.error) { throw new Error(this.sb.mensaje(del.error)); }
    if (!items.length) { return; }

    const rows = items.map((it, i) => fromQuotationItem(it, quotationId, i));
    const { error } = await this.sb.db.from('cotizacion_items').insert(rows);
    if (error) { throw new Error(this.sb.mensaje(error)); }
  }

  setStatus(id: string, status: Quotation['status'], convertedServiceId?: string): Observable<Quotation> {
    const changes: Partial<Quotation> = { status };
    if (convertedServiceId) { changes.convertedServiceId = convertedServiceId; }
    if (status === 'accepted' || status === 'converted') {
      const current = this.subject.value.find((q) => q.id === id);
      changes.acceptedAt = current?.acceptedAt ?? new Date().toISOString();
    }
    return this.update(id, changes);
  }

  delete(id: string): Observable<void> {
    return from(
      this.sb.db.from('cotizaciones').delete().eq('id', id).then(async ({ error }) => {
        if (error) { throw new Error(this.sb.mensaje(error)); }
        await this.reload();
      })
    );
  }
}
