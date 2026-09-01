import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, from, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { Client } from '../../models';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { fromClient, toClient } from './mappers';

/** Deja el teléfono en puros dígitos, igual que hace la base de datos. */
export function digitsOnly(phone: string): string {
  return (phone ?? '').replace(/[^0-9]/g, '');
}

@Injectable({ providedIn: 'root' })
export class ClientService {
  private sb = inject(SupabaseService);
  private auth = inject(AuthService);

  private subject = new BehaviorSubject<Client[]>([]);
  readonly clients$ = this.subject.asObservable();

  get snapshot(): Client[] { return this.subject.value; }
  setAll(items: Client[]): void { this.subject.next(items); }
  clear(): void { this.subject.next([]); }

  async reload(): Promise<void> {
    const { data, error } = await this.sb.db
      .from('clientes')
      .select('*')
      .order('nombre', { ascending: true });
    if (error) { throw new Error(this.sb.mensaje(error)); }
    this.subject.next((data ?? []).map(toClient));
  }

  list(): Observable<Client[]> { return of([...this.subject.value]); }

  getById(id: string): Observable<Client | undefined> {
    return this.clients$.pipe(map((l) => l.find((c) => c.id === id)));
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

  /**
   * El teléfono es la llave con la que el cliente entra al portal, así que no
   * puede repetirse. Se revisa aquí para dar un mensaje claro; la base tiene
   * además un índice único por si dos pestañas guardan a la vez.
   */
  phoneTaken(phone: string, exceptId?: string): boolean {
    const d = digitsOnly(phone).slice(-8);
    if (d.length < 8) { return false; }
    return this.subject.value.some(
      (c) => c.id !== exceptId && c.active && digitsOnly(c.phone).slice(-8) === d
    );
  }

  create(data: Omit<Client, 'id' | 'createdAt'>): Observable<Client> {
    return from(this.createAsync(data));
  }

  private async createAsync(data: Omit<Client, 'id' | 'createdAt'>): Promise<Client> {
    const mecanicoId = this.auth.mechanicId;
    if (!mecanicoId) { throw new Error('Sólo el mecánico puede crear clientes.'); }
    if (digitsOnly(data.phone).length < 8) {
      throw new Error('El teléfono debe tener al menos 8 dígitos: es la llave con la que el cliente entra.');
    }
    if (this.phoneTaken(data.phone)) {
      throw new Error('Ese número de teléfono ya lo tiene otro cliente.');
    }

    const { data: row, error } = await this.sb.db
      .from('clientes')
      .insert({ ...fromClient(data), mecanico_id: mecanicoId })
      .select()
      .single();
    if (error || !row) { throw new Error(this.sb.mensaje(error)); }

    await this.reload();
    return toClient(row);
  }

  update(id: string, changes: Partial<Client>): Observable<Client> {
    return from(this.updateAsync(id, changes));
  }

  private async updateAsync(id: string, changes: Partial<Client>): Promise<Client> {
    if (changes.phone !== undefined) {
      if (digitsOnly(changes.phone).length < 8) {
        throw new Error('El teléfono debe tener al menos 8 dígitos.');
      }
      if (this.phoneTaken(changes.phone, id)) {
        throw new Error('Ese número de teléfono ya lo tiene otro cliente.');
      }
    }
    const { data: row, error } = await this.sb.db
      .from('clientes')
      .update(fromClient(changes))
      .eq('id', id)
      .select()
      .single();
    if (error || !row) { throw new Error(this.sb.mensaje(error)); }

    await this.reload();
    return toClient(row);
  }

  /** No se borra: se marca inactivo, porque tiene historial colgando. */
  deactivate(id: string): Observable<void> {
    return from(this.updateAsync(id, { active: false }).then(() => undefined));
  }
}
