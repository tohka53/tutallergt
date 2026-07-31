import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { delay, map } from 'rxjs/operators';
import { PartCatalogItem } from '../../models';
import { StorageService } from './storage.service';
import { PART_CATEGORIES } from './catalog.data';
import { uuid } from './id.util';

@Injectable({ providedIn: 'root' })
export class PartsCatalogService {
  private storage = inject(StorageService);
  private readonly key = 'parts-catalog';
  private subject = new BehaviorSubject<PartCatalogItem[]>(
    this.storage.get<PartCatalogItem[]>(this.key, [])
  );
  readonly items$ = this.subject.asObservable();

  readonly categories = PART_CATEGORIES;

  private persist(items: PartCatalogItem[]): void {
    this.storage.set(this.key, items);
    this.subject.next(items);
  }

  list(): Observable<PartCatalogItem[]> {
    return of([...this.subject.value]).pipe(delay(120));
  }

  search(term: string): PartCatalogItem[] {
    const t = term.trim().toLowerCase();
    const active = this.subject.value.filter((i) => i.active);
    if (!t) { return active.slice(0, 20); }
    return active
      .filter((i) => [i.name, i.code, i.category, i.description].join(' ').toLowerCase().includes(t))
      .slice(0, 20);
  }

  create(data: Omit<PartCatalogItem, 'id'>): Observable<PartCatalogItem> {
    const item: PartCatalogItem = { ...data, id: uuid() };
    this.persist([...this.subject.value, item]);
    return of(item).pipe(delay(120));
  }

  update(id: string, changes: Partial<PartCatalogItem>): Observable<PartCatalogItem> {
    const items = this.subject.value.map((i) => (i.id === id ? { ...i, ...changes, id } : i));
    this.persist(items);
    return of(items.find((i) => i.id === id) as PartCatalogItem).pipe(delay(120));
  }

  toggleActive(id: string): Observable<void> {
    const item = this.subject.value.find((i) => i.id === id);
    if (item) { this.update(id, { active: !item.active }); }
    return of(void 0);
  }
}
