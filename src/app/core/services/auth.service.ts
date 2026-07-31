import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { Role, User } from '../../models';
import { StorageService } from './storage.service';

interface MockCredential {
  email: string;
  password: string; // SÓLO DEMO. En producción jamás se guardan contraseñas en el cliente.
  userId: string;
}

/**
 * Autenticación MOCK para la demostración (sin backend).
 *
 * PRODUCCIÓN:
 *  - Reemplazar login() por POST /auth/login que devuelva un JWT.
 *  - Guardar el token (httpOnly cookie idealmente) y no las credenciales.
 *  - La autorización debe validarse SIEMPRE también en el servidor.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private storage = inject(StorageService);
  private readonly sessionKey = 'session-user-id';
  private readonly usersKey = 'users';

  // Credenciales simuladas. NO son contraseñas reales.
  private readonly credentials: MockCredential[] = [
    { email: 'mecanico@demo.com', password: 'Demo123!', userId: 'user-mechanic' },
    { email: 'cliente@demo.com', password: 'Demo123!', userId: 'user-client-1' },
  ];

  private currentUserSubject = new BehaviorSubject<User | null>(this.restoreSession());
  readonly currentUser$: Observable<User | null> = this.currentUserSubject.asObservable();

  get currentUser(): User | null {
    return this.currentUserSubject.value;
  }

  get isAuthenticated(): boolean {
    return this.currentUserSubject.value !== null;
  }

  get role(): Role | null {
    return this.currentUserSubject.value?.role ?? null;
  }

  isMechanic(): boolean {
    return this.role === 'mechanic';
  }

  login(email: string, password: string): Observable<User> {
    const cred = this.credentials.find(
      (c) => c.email.toLowerCase() === email.trim().toLowerCase() && c.password === password
    );
    if (!cred) {
      return throwError(() => new Error('Credenciales incorrectas.')).pipe(delay(400));
    }
    const user = this.findUser(cred.userId);
    if (!user || !user.active) {
      return throwError(() => new Error('El usuario no está disponible.')).pipe(delay(400));
    }
    this.storage.set(this.sessionKey, user.id);
    this.currentUserSubject.next(user);
    return of(user).pipe(delay(400));
  }

  logout(): void {
    this.storage.remove(this.sessionKey);
    this.currentUserSubject.next(null);
  }

  /** Llamar tras el seed para refrescar el usuario en sesión (demo). */
  refreshSession(): void {
    this.currentUserSubject.next(this.restoreSession());
  }

  private restoreSession(): User | null {
    const id = this.storage.get<string | null>(this.sessionKey, null);
    return id ? this.findUser(id) : null;
  }

  private findUser(id: string): User | null {
    const users = this.storage.get<User[]>(this.usersKey, []);
    return users.find((u) => u.id === id) ?? null;
  }
}
