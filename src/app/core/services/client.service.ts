import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { delay, map } from 'rxjs/operators';
import { Client } from '../../models';
import { StorageService } from './storage.service';
import { uuid } from './id.util';

/**
 * PRODUCCIÓN: reemplazar el cuerpo de cada método por llamadas HttpClient
 * (GET/POST/PUT/DELETE) contra /api/clients. La firma pública no cambia.
 */
@Injectable({ providedIn: 'root' })
export class ClientService {
  private storage = inject(StorageService);
  private readonly key = 'clients';
  private subject = new BehaviorSubject<Client[]>(this.storage.get<Client[]>(this.key, []));
  readonly clients$ = this.subject.asObservable();

  private persist(items: Client[]): void {
    this.storage.set(this.key, items);
    this.subject.next(items);
  }

  list(): Observable<Client[]> {
    return of([...this.subject.value]).pipe(delay(150));
  }

  getById(id: string): Observable<Client | undefined> {
    return of(this.subject.value.find((c) => c.id === id)).pipe(delay(100));
  }

  search(term: string): Observable<Client[]> {
    const t = term.trim().toLowerCase();
    return this.clients$.pipe(
      map((list) =>
        !t
          ? list
          : list.filter((c) =>
              [c.firstName, c.lastName, c.taxId, c.phone, c.email, c.whatsapp]
                .join(' ')
                .toLowerCase()
                .includes(t)
            )
      )
    );
  }

  create(data: Omit<Client, 'id' | 'createdAt'>): Observable<Client> {
    const client: Client = { ...data, id: uuid(), createdAt: new Date().toISOString() };
    this.persist([...this.subject.value, client]);
    return of(client).pipe(delay(150));
  }

  update(id: string, changes: Partial<Client>): Observable<Client> {
    const items = this.subject.value.map((c) => (c.id === id ? { ...c, ...changes, id } : c));
    this.persist(items);
    return of(items.find((c) => c.id === id) as Client).pipe(delay(150));
  }

  /** No se elimina físicamente si tiene historial: se marca inactivo. */
  deactivate(id: string): Observable<void> {
    this.update(id, { active: false });
    return of(void 0).pipe(delay(120));
  }
}
