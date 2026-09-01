import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Client, Role, User } from '../../models';
import { SupabaseService } from './supabase.service';

/** Sesión del cliente guardada en su propio navegador. */
interface PortalSession {
  phone: string;
  client: Client;
}

/**
 * Dos formas de entrar, muy distintas a propósito:
 *
 *  - MECÁNICO: usuario real de Supabase Auth (correo + contraseña). Recibe un
 *    JWT y RLS deja que lea y escriba solamente sus propias filas.
 *
 *  - CLIENTE: no tiene usuario ni contraseña. Escribe su teléfono y el
 *    servidor (portal_login) le responde sus datos SÓLO si ese número existe
 *    y además ya tiene vehículos registrados. Nunca toca las tablas: todo
 *    pasa por funciones del servidor que jamás devuelven costos ni ganancias.
 *
 * El teléfono es una credencial débil —quien lo sepa puede ver el historial
 * de ese vehículo— y por eso el cliente es de sólo lectura y no ve dinero
 * del taller. Para el mecánico, que sí ve costos y ganancias, se exige
 * contraseña.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private sb = inject(SupabaseService);
  private readonly portalKey = 'mundo-garage-portal';

  private currentUserSubject = new BehaviorSubject<User | null>(null);
  readonly currentUser$: Observable<User | null> = this.currentUserSubject.asObservable();

  /** Datos del cliente en sesión (null si es mecánico). */
  private portalSession: PortalSession | null = null;

  get currentUser(): User | null { return this.currentUserSubject.value; }
  get isAuthenticated(): boolean { return this.currentUserSubject.value !== null; }
  get role(): Role | null { return this.currentUserSubject.value?.role ?? null; }
  isMechanic(): boolean { return this.role === 'mechanic'; }

  /** id del mecánico autenticado (auth.uid). Null si el que entró es un cliente. */
  get mechanicId(): string | null {
    return this.isMechanic() ? (this.currentUserSubject.value?.id ?? null) : null;
  }

  /** Teléfono con el que entró el cliente; se usa en cada llamada al portal. */
  get portalPhone(): string | null { return this.portalSession?.phone ?? null; }
  get portalClient(): Client | null { return this.portalSession?.client ?? null; }

  // =========================================================================
  // Arranque
  // =========================================================================

  /**
   * Se ejecuta antes de mostrar la primera pantalla (APP_INITIALIZER). Si no
   * se esperara aquí, los guards preguntarían "¿hay sesión?" antes de que
   * Supabase terminara de leerla y mandarían al login a alguien ya conectado.
   */
  async restore(): Promise<void> {
    try {
      const { data } = await this.sb.db.auth.getSession();
      if (data.session?.user) {
        await this.loadMechanicProfile(data.session.user.id, data.session.user.email ?? '');
        return;
      }
    } catch {
      // sin conexión: se sigue e intenta la sesión del portal
    }

    const raw = localStorage.getItem(this.portalKey);
    if (raw) {
      try {
        const session = JSON.parse(raw) as PortalSession;
        // Se revalida contra el servidor: si al cliente le quitaron el último
        // vehículo o lo desactivaron, la sesión guardada deja de servir.
        const ok = await this.fetchPortalClient(session.phone);
        if (ok) { this.setPortalSession(session.phone, ok); return; }
      } catch {
        // queda fuera
      }
      localStorage.removeItem(this.portalKey);
    }
  }

  // =========================================================================
  // Mecánico
  // =========================================================================

  async loginMechanic(email: string, password: string): Promise<User> {
    const { data, error } = await this.sb.db.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error || !data.user) { throw new Error(this.sb.mensaje(error)); }
    this.clearPortalSession();
    return this.loadMechanicProfile(data.user.id, data.user.email ?? email);
  }

  // No hay pantalla de registro a propósito: las cuentas del taller se crean
  // desde Supabase (Authentication → Add user). Un registro abierto en la web
  // dejaría que cualquiera se hiciera "mecánico" con sólo abrir el enlace.

  private async loadMechanicProfile(id: string, email: string): Promise<User> {
    const { data } = await this.sb.db
      .from('profiles')
      .select('id, nombre, correo, telefono, activo, created_at')
      .eq('id', id)
      .maybeSingle();

    const user: User = {
      id,
      email: (data?.['correo'] as string) ?? email,
      phone: (data?.['telefono'] as string) ?? '',
      displayName: (data?.['nombre'] as string) || email.split('@')[0],
      role: 'mechanic',
      active: data ? data['activo'] !== 0 : true,
      createdAt: (data?.['created_at'] as string) ?? new Date().toISOString(),
    };
    this.portalSession = null;
    this.currentUserSubject.next(user);
    return user;
  }

  // =========================================================================
  // Cliente
  // =========================================================================

  /**
   * Devuelve el cliente si el número existe Y tiene vehículos. Lanza un error
   * explicando cuál de las dos condiciones falló, porque son problemas muy
   * distintos para quien está tratando de entrar.
   */
  async loginClient(phone: string): Promise<User> {
    const digits = phone.replace(/[^0-9]/g, '');
    if (digits.length < 8) {
      throw new Error('Escribe tu número completo (8 dígitos).');
    }

    const client = await this.fetchPortalClient(phone);
    if (!client) {
      throw new Error(
        'Ese número no está registrado en el taller. Pídele al taller que te ' +
        'registre con este mismo número.'
      );
    }

    await this.sb.db.auth.signOut().catch(() => undefined);
    return this.setPortalSession(phone, client);
  }

  /** null = no existe. Lanza error si existe pero no tiene vehículos. */
  private async fetchPortalClient(phone: string): Promise<Client | null> {
    const { data, error } = await this.sb.db.rpc('portal_login', { p_telefono: phone });
    if (error) { throw new Error(this.sb.mensaje(error)); }
    if (!data) { return null; }

    const payload = data as Record<string, unknown>;
    if (payload['sin_vehiculos']) {
      throw new Error(
        'Tu número sí está registrado, pero todavía no tienes ningún vehículo ' +
        'en el sistema. El taller debe registrar tu vehículo para que puedas entrar.'
      );
    }

    const c = payload['cliente'] as Record<string, string>;
    return {
      id: c['id'],
      firstName: c['nombre'] ?? '',
      lastName: c['apellido'] ?? '',
      taxId: c['nit'] ?? 'CF',
      phone: c['telefono'] ?? phone,
      whatsapp: c['whatsapp'] ?? c['telefono'] ?? phone,
      email: c['correo'] ?? '',
      address: c['direccion'] ?? '',
      notes: '',
      createdAt: new Date().toISOString(),
      active: true,
    };
  }

  private setPortalSession(phone: string, client: Client): User {
    this.portalSession = { phone, client };
    localStorage.setItem(this.portalKey, JSON.stringify(this.portalSession));

    const user: User = {
      id: 'portal-' + client.id,
      email: client.email,
      phone: client.phone,
      displayName: `${client.firstName} ${client.lastName}`.trim(),
      role: 'client',
      clientId: client.id,
      active: true,
      createdAt: client.createdAt,
    };
    this.currentUserSubject.next(user);
    return user;
  }

  private clearPortalSession(): void {
    this.portalSession = null;
    localStorage.removeItem(this.portalKey);
  }

  // =========================================================================

  async logout(): Promise<void> {
    this.clearPortalSession();
    await this.sb.db.auth.signOut().catch(() => undefined);
    this.currentUserSubject.next(null);
  }
}
