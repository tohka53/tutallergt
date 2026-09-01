import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, from, of } from 'rxjs';
import { PartCatalogItem } from '../../models';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { PART_CATEGORIES } from './catalog.data';
import { fromPart, toPart } from './mappers';

@Injectable({ providedIn: 'root' })
export class PartsCatalogService {
  private sb = inject(SupabaseService);
  private auth = inject(AuthService);

  private subject = new BehaviorSubject<PartCatalogItem[]>([]);
  readonly items$ = this.subject.asObservable();
  readonly categories = PART_CATEGORIES;

  get snapshot(): PartCatalogItem[] { return this.subject.value; }
  clear(): void { this.subject.next([]); }

  async reload(): Promise<void> {
    const { data, error } = await this.sb.db
      .from('catalogo_items')
      .select('*')
      .order('nombre', { ascending: true });
    if (error) { throw new Error(this.sb.mensaje(error)); }
    this.subject.next((data ?? []).map(toPart));
  }

  /**
   * Copia el catálogo base la primera vez que entra un mecánico. La función
   * vive en la base (sembrar_catalogo) y no hace nada si ya hay ítems, así
   * que es seguro llamarla en cada inicio de sesión.
   */
  async seedIfEmpty(): Promise<void> {
    if (this.subject.value.length > 0) { return; }
    const { error } = await this.sb.db.rpc('sembrar_catalogo');
    if (!error) { await this.reload(); }
  }

  list(): Observable<PartCatalogItem[]> { return of([...this.subject.value]); }

  search(term: string): PartCatalogItem[] {
    const t = term.trim().toLowerCase();
    const active = this.subject.value.filter((i) => i.active);
    if (!t) { return active.slice(0, 20); }
    return active
      .filter((i) => [i.name, i.code, i.category, i.description].join(' ').toLowerCase().includes(t))
      .slice(0, 20);
  }

  create(data: Omit<PartCatalogItem, 'id'>): Observable<PartCatalogItem> {
    return from(
      (async () => {
        const mecanicoId = this.auth.mechanicId;
        if (!mecanicoId) { throw new Error('Sólo el mecánico puede editar el catálogo.'); }
        const { data: row, error } = await this.sb.db
          .from('catalogo_items')
          .insert({ ...fromPart(data), mecanico_id: mecanicoId })
          .select()
          .single();
        if (error || !row) { throw new Error(this.sb.mensaje(error)); }
        await this.reload();
        return toPart(row);
      })()
    );
  }

  update(id: string, changes: Partial<PartCatalogItem>): Observable<PartCatalogItem> {
    return from(
      (async () => {
        const { data: row, error } = await this.sb.db
          .from('catalogo_items')
          .update(fromPart(changes))
          .eq('id', id)
          .select()
          .single();
        if (error || !row) { throw new Error(this.sb.mensaje(error)); }
        await this.reload();
        return toPart(row);
      })()
    );
  }

  toggleActive(id: string): Observable<void> {
    const item = this.subject.value.find((i) => i.id === id);
    if (!item) { return of(void 0); }
    return from(
      this.update(id, { active: !item.active }).toPromise().then(() => undefined)
    );
  }
}
